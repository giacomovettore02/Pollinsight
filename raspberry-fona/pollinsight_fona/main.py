from __future__ import annotations

import argparse
import logging
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

from .backend import BackendError, SupabaseBackend
from .classifier import Classification, QuantizedClassifier
from .config import Config
from .inbox import archive_image, discover_ready_images
from .sensor import SensorReading, read_sht40
from .state import RuntimeState


LOGGER = logging.getLogger("pollinsight-fona")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def base_payload(device_id: str) -> dict:
    started_at = utc_now()
    return {
        "boot_id": device_id,
        "status": "connecting",
        "progress_current": 0,
        "progress_total": 0,
        "total_bees": None,
        "healthy_bees": None,
        "infected_bees": None,
        "temperature_c": None,
        "humidity_percent": None,
        "sensor_status": "pending",
        "device_status": "online",
        "evidence": [],
        "model_name": "MobileNetV2 TFLite 160x160",
        "processing_ms": None,
        "error_code": None,
        "error_message": None,
        "started_at": started_at,
        "completed_at": None,
        "last_heartbeat_at": started_at,
    }


def publish(
    backend: SupabaseBackend,
    state: RuntimeState,
    state_path: Path,
    payload: dict,
) -> bool:
    payload["last_heartbeat_at"] = utc_now()
    payload["device_status"] = "online"
    state.payload = payload
    state.save(state_path)
    try:
        backend.upsert_run(payload)
        return True
    except (BackendError, requests.RequestException) as exc:
        LOGGER.warning("Supabase unavailable over FONA: %s", exc)
        return False


def apply_sensor_reading(payload: dict, reading: SensorReading) -> None:
    payload["sensor_status"] = reading.status
    payload["temperature_c"] = reading.temperature_c
    payload["humidity_percent"] = reading.humidity_percent
    if reading.error:
        LOGGER.warning("SHT40 unavailable: %s", reading.error)


def seed_sample_images(config: Config) -> None:
    config.inbox_dir.mkdir(parents=True, exist_ok=True)
    if not config.seed_sample_images or any(config.inbox_dir.iterdir()):
        return
    for source in sorted(config.sample_images_dir.iterdir()):
        if source.is_file():
            shutil.copy2(source, config.inbox_dir / source.name)
    LOGGER.info("Seeded sample images into %s", config.inbox_dir)


def process_pending_uploads(
    backend: SupabaseBackend,
    config: Config,
    state: RuntimeState,
    state_path: Path,
    payload: dict,
) -> int:
    uploaded = 0
    remaining: list[dict] = []
    evidence = list(payload.get("evidence") or [])
    evidence_paths = {item.get("path") for item in evidence}

    for item in state.pending_uploads:
        image_path = Path(item["local_path"])
        if not image_path.exists():
            LOGGER.error("Pending evidence is missing: %s", image_path)
            remaining.append(item)
            continue
        try:
            object_path, public_url = backend.upload_evidence(
                config.device_id,
                item["batch_date"],
                image_path,
            )
        except (BackendError, requests.RequestException) as exc:
            LOGGER.warning("Evidence upload remains pending for %s: %s", image_path, exc)
            remaining.append(item)
            continue

        if object_path not in evidence_paths:
            evidence.append(
                {
                    "filename": item["filename"],
                    "path": object_path,
                    "public_url": public_url,
                    "confidence": item["confidence"],
                    "captured_at": item["captured_at"],
                }
            )
            evidence_paths.add(object_path)
        uploaded += 1

    state.pending_uploads = remaining
    payload["evidence"] = evidence
    state.payload = payload
    state.save(state_path)
    return uploaded


def run_classification_batch(
    backend: SupabaseBackend,
    classifier: QuantizedClassifier,
    config: Config,
    state: RuntimeState,
    state_path: Path,
    batch_date: str,
) -> bool:
    ready, unreadable = discover_ready_images(
        config.inbox_dir,
        config.minimum_file_age_seconds,
    )
    for path in unreadable:
        LOGGER.warning("Image is incomplete or unreadable and will be retried: %s", path)

    if not ready:
        LOGGER.info("No complete images available for the %s batch", batch_date)
        state.last_batch_attempt_date = batch_date
        state.save(state_path)
        return False

    payload = state.payload or base_payload(config.device_id)
    started_at = utc_now()
    started_clock = time.perf_counter()
    payload.update(
        status="classifying",
        progress_current=0,
        progress_total=len(ready),
        started_at=started_at,
        completed_at=None,
        error_code=None,
        error_message=None,
        evidence=[],
    )
    publish(backend, state, state_path, payload)

    results: list[tuple[Path, Classification, str]] = []
    for index, image_path in enumerate(ready, start=1):
        captured_at = datetime.fromtimestamp(
            image_path.stat().st_mtime,
            tz=timezone.utc,
        ).isoformat()
        result = classifier.classify(image_path)
        results.append((image_path, result, captured_at))
        payload["progress_current"] = index
        state.payload = payload
        state.save(state_path)

    reading = read_sht40(config.sensor_mode)
    apply_sensor_reading(payload, reading)

    infected_count = sum(result.infected for _, result, _ in results)
    payload.update(
        status="uploading",
        progress_current=0,
        progress_total=infected_count,
        total_bees=len(results),
        healthy_bees=len(results) - infected_count,
        infected_bees=infected_count,
    )

    for image_path, result, captured_at in results:
        archived_path = archive_image(
            image_path,
            config.archive_dir,
            batch_date,
            result.infected,
        )
        if result.infected:
            state.pending_uploads.append(
                {
                    "batch_date": batch_date,
                    "filename": archived_path.name,
                    "local_path": str(archived_path),
                    "confidence": round(result.score, 6),
                    "captured_at": captured_at,
                }
            )

    state.last_batch_attempt_date = batch_date
    state.payload = payload
    state.save(state_path)
    publish(backend, state, state_path, payload)

    process_pending_uploads(backend, config, state, state_path, payload)
    pending_count = len(state.pending_uploads)
    current_batch_pending = sum(
        item.get("batch_date") == batch_date for item in state.pending_uploads
    )
    payload.update(
        status="complete",
        progress_current=max(0, infected_count - current_batch_pending),
        progress_total=infected_count,
        processing_ms=round((time.perf_counter() - started_clock) * 1000),
        completed_at=utc_now(),
        error_code="evidence_pending" if pending_count else None,
        error_message=(
            f"{pending_count} infected images are queued for cellular retry"
            if pending_count
            else None
        ),
    )
    publish(backend, state, state_path, payload)
    LOGGER.info(
        "Batch %s complete: %d bees, %d infected, %d uploads pending",
        batch_date,
        len(results),
        infected_count,
        pending_count,
    )
    return True


def scheduled_batch_is_due(config: Config, state: RuntimeState, now: datetime) -> bool:
    date_key = now.date().isoformat()
    scheduled = now.replace(
        hour=config.classification_hour,
        minute=config.classification_minute,
        second=0,
        microsecond=0,
    )
    return now >= scheduled and state.last_batch_attempt_date != date_key


def run_service(config: Config, run_once: bool) -> int:
    config.inbox_dir.mkdir(parents=True, exist_ok=True)
    config.archive_dir.mkdir(parents=True, exist_ok=True)
    config.state_dir.mkdir(parents=True, exist_ok=True)
    seed_sample_images(config)

    state_path = config.state_dir / "runtime.json"
    state = RuntimeState.load(state_path)
    if not state.payload:
        state.payload = base_payload(config.device_id)
    backend = SupabaseBackend(
        config.supabase_url,
        config.supabase_secret_key,
        config.request_timeout_seconds,
        required_interface=config.ppp_interface,
    )
    classifier = QuantizedClassifier(
        config.model_path,
        config.classification_threshold,
    )
    local_timezone = ZoneInfo(config.timezone_name)

    if run_once:
        date_key = datetime.now(local_timezone).date().isoformat()
        run_classification_batch(
            backend,
            classifier,
            config,
            state,
            state_path,
            date_key,
        )
        return 0

    next_telemetry = 0.0
    next_upload_retry = 0.0
    while True:
        monotonic_now = time.monotonic()
        local_now = datetime.now(local_timezone)

        if state.pending_uploads and monotonic_now >= next_upload_retry:
            payload = state.payload or base_payload(config.device_id)
            uploaded = process_pending_uploads(
                backend,
                config,
                state,
                state_path,
                payload,
            )
            if uploaded:
                payload["progress_current"] = len(payload.get("evidence") or [])
                if not state.pending_uploads:
                    payload["error_code"] = None
                    payload["error_message"] = None
                publish(backend, state, state_path, payload)
            next_upload_retry = monotonic_now + config.upload_retry_seconds

        if scheduled_batch_is_due(config, state, local_now):
            run_classification_batch(
                backend,
                classifier,
                config,
                state,
                state_path,
                local_now.date().isoformat(),
            )

        if monotonic_now >= next_telemetry:
            payload = state.payload or base_payload(config.device_id)
            reading = read_sht40(config.sensor_mode)
            apply_sensor_reading(payload, reading)
            success = publish(backend, state, state_path, payload)
            retry_delay = (
                config.telemetry_interval_seconds
                if success
                else min(60, config.telemetry_interval_seconds)
            )
            next_telemetry = monotonic_now + retry_delay

        time.sleep(5)


def run_preflight(config: Config, skip_backend: bool) -> int:
    sample_images = sorted(
        path
        for path in config.sample_images_dir.iterdir()
        if path.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )
    if not sample_images:
        raise RuntimeError("No sample image is available for model validation")
    classifier = QuantizedClassifier(config.model_path, config.classification_threshold)
    first = classifier.classify(sample_images[0])
    reading = read_sht40(config.sensor_mode)

    print(f"Model: loaded, first score={first.score:.6f}")
    print(f"SHT40: {reading.status}")
    if not skip_backend:
        backend = SupabaseBackend(
            config.supabase_url,
            config.supabase_secret_key,
            config.request_timeout_seconds,
        )
        backend.check()
        print("Supabase: reachable")
    if config.sensor_mode == "real" and reading.status != "online":
        raise RuntimeError(
            f"SHT40 preflight failed: {reading.error or 'sensor unavailable'}"
        )
    return 0


def configure_logging(config: Config) -> None:
    logs_dir = config.state_dir.parent / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(logs_dir / "pollinsight-fona.log"),
        ],
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PollinSight Adafruit FONA runtime"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Classify the current inbox immediately and exit",
    )
    parser.add_argument(
        "--preflight",
        action="store_true",
        help="Validate the local installation",
    )
    parser.add_argument(
        "--skip-backend",
        action="store_true",
        help="Do not contact Supabase during preflight",
    )
    parser.add_argument("--sensor-mode", choices=["real", "mock"])
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = Config.load(args.sensor_mode)
    configure_logging(config)
    try:
        if args.preflight:
            return run_preflight(config, args.skip_backend)
        return run_service(config, args.once)
    except KeyboardInterrupt:
        return 130
    except Exception:
        LOGGER.exception("Fatal PollinSight FONA error")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
