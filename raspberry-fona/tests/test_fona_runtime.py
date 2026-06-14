from __future__ import annotations

import json
import shutil
import tempfile
import time
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from PIL import Image

from pollinsight_fona.backend import BackendError
from pollinsight_fona.classifier import QuantizedClassifier
from pollinsight_fona.config import PACKAGE_ROOT
from pollinsight_fona.inbox import archive_image, discover_ready_images
from pollinsight_fona.main import (
    base_payload,
    publish,
    run_classification_batch,
    run_preflight,
    scheduled_batch_is_due,
)
from pollinsight_fona.sensor import SensorReading, read_sht40
from pollinsight_fona.state import RuntimeState


class FailingBackend:
    def upsert_run(self, payload: dict) -> None:
        raise BackendError("offline")


class RecordingBackend:
    def __init__(self):
        self.payloads: list[dict] = []
        self.uploaded: list[Path] = []

    def upsert_run(self, payload: dict) -> None:
        self.payloads.append(dict(payload))

    def upload_evidence(
        self,
        device_id: str,
        batch_date: str,
        image_path: Path,
    ) -> tuple[str, str]:
        self.uploaded.append(image_path)
        object_path = f"{device_id}/{batch_date}/{image_path.name}"
        return object_path, f"https://example.invalid/{object_path}"


class FonaRuntimeTest(unittest.TestCase):
    def test_sample_images_and_model_keep_known_split(self) -> None:
        classifier = QuantizedClassifier(
            PACKAGE_ROOT / "model" / "varroa_mobilenetv2_160.tflite"
        )
        results = [
            classifier.classify(path)
            for path in sorted((PACKAGE_ROOT / "sample-images").glob("*.png"))
        ]
        infected = [result for result in results if result.infected]
        healthy = [result for result in results if not result.infected]
        self.assertEqual(15, len(healthy))
        self.assertEqual(5, len(infected))

    def test_inbox_accepts_stable_supported_images(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            inbox = Path(temporary)
            image_path = inbox / "bee.jpg"
            Image.new("RGB", (8, 8), "white").save(image_path)
            ready, unreadable = discover_ready_images(
                inbox,
                minimum_age_seconds=30,
                now=time.time() + 31,
            )
            self.assertEqual([image_path], ready)
            self.assertEqual([], unreadable)

    def test_inbox_skips_files_still_being_written(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            inbox = Path(temporary)
            image_path = inbox / "bee.png"
            Image.new("RGB", (8, 8), "white").save(image_path)
            ready, unreadable = discover_ready_images(
                inbox,
                minimum_age_seconds=30,
                now=image_path.stat().st_mtime + 10,
            )
            self.assertEqual([], ready)
            self.assertEqual([], unreadable)

    def test_inbox_keeps_unreadable_image_for_retry(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            inbox = Path(temporary)
            image_path = inbox / "broken.png"
            image_path.write_bytes(b"not-an-image")
            ready, unreadable = discover_ready_images(
                inbox,
                minimum_age_seconds=0,
                now=time.time() + 1,
            )
            self.assertEqual([], ready)
            self.assertEqual([image_path], unreadable)
            self.assertTrue(image_path.exists())

    def test_archive_uses_date_and_classification(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "bee.png"
            Image.new("RGB", (8, 8), "white").save(source)
            destination = archive_image(
                source,
                root / "archive",
                "2026-06-14",
                infected=True,
            )
            self.assertEqual(
                root / "archive" / "2026-06-14" / "infected" / "bee.png",
                destination,
            )
            self.assertTrue(destination.exists())

    def test_scheduler_runs_once_after_20(self) -> None:
        config = SimpleNamespace(classification_hour=20, classification_minute=0)
        state = RuntimeState(last_batch_attempt_date=None)
        now = datetime(2026, 6, 14, 20, 1, tzinfo=timezone.utc)
        self.assertTrue(scheduled_batch_is_due(config, state, now))
        state.last_batch_attempt_date = "2026-06-14"
        self.assertFalse(scheduled_batch_is_due(config, state, now))

    def test_runtime_state_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "runtime.json"
            state = RuntimeState(
                last_batch_attempt_date="2026-06-14",
                payload={"status": "complete"},
                pending_uploads=[{"filename": "bee.png"}],
            )
            state.save(path)
            loaded = RuntimeState.load(path)
            self.assertEqual(state.last_batch_attempt_date, loaded.last_batch_attempt_date)
            self.assertEqual(state.payload, loaded.payload)
            self.assertEqual(state.pending_uploads, loaded.pending_uploads)

    @patch("pollinsight_fona.main.read_sht40")
    def test_batch_processes_entire_ready_inbox(
        self,
        sensor_reader: Mock,
    ) -> None:
        sensor_reader.return_value = SensorReading(
            status="online",
            temperature_c=24.5,
            humidity_percent=55.0,
        )
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            inbox = root / "images" / "inbox"
            inbox.mkdir(parents=True)
            shutil.copy2(
                PACKAGE_ROOT / "sample-images" / "healthy_01.png",
                inbox / "healthy.png",
            )
            shutil.copy2(
                PACKAGE_ROOT / "sample-images" / "infected_01.png",
                inbox / "infected.png",
            )
            config = SimpleNamespace(
                inbox_dir=inbox,
                minimum_file_age_seconds=0,
                archive_dir=root / "archive",
                device_id="test-fona",
                sensor_mode="mock",
            )
            state_path = root / "state" / "runtime.json"
            state = RuntimeState(payload=base_payload(config.device_id))
            backend = RecordingBackend()
            classifier = QuantizedClassifier(
                PACKAGE_ROOT / "model" / "varroa_mobilenetv2_160.tflite"
            )

            completed = run_classification_batch(
                backend,
                classifier,
                config,
                state,
                state_path,
                "2026-06-14",
            )

            self.assertTrue(completed)
            self.assertEqual(2, state.payload["total_bees"])
            self.assertEqual(1, state.payload["healthy_bees"])
            self.assertEqual(1, state.payload["infected_bees"])
            self.assertEqual("complete", state.payload["status"])
            self.assertEqual(1, len(state.payload["evidence"]))
            self.assertEqual([], state.pending_uploads)
            self.assertTrue(
                (root / "archive" / "2026-06-14" / "healthy" / "healthy.png").exists()
            )
            self.assertTrue(
                (root / "archive" / "2026-06-14" / "infected" / "infected.png").exists()
            )

    def test_failed_backend_write_preserves_local_state(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "runtime.json"
            state = RuntimeState()
            payload = base_payload("test-device")
            self.assertFalse(publish(FailingBackend(), state, path, payload))
            saved = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual("connecting", saved["payload"]["status"])
            self.assertIn("last_heartbeat_at", saved["payload"])

    def test_mock_sensor_is_available_for_desktop_validation(self) -> None:
        reading = read_sht40("mock")
        self.assertEqual("online", reading.status)
        self.assertIsNotNone(reading.temperature_c)
        self.assertIsNotNone(reading.humidity_percent)

    @patch("pollinsight_fona.main.read_sht40")
    @patch("pollinsight_fona.main.SupabaseBackend")
    @patch("pollinsight_fona.main.QuantizedClassifier")
    def test_real_sensor_preflight_fails_when_sht40_is_offline(
        self,
        classifier_type: Mock,
        backend_type: Mock,
        sensor_reader: Mock,
    ) -> None:
        classifier_type.return_value.classify.return_value = SimpleNamespace(score=0.0)
        backend_type.return_value.check.return_value = None
        sensor_reader.return_value = SensorReading(
            status="offline",
            temperature_c=None,
            humidity_percent=None,
            error="I2C device not found",
        )
        config = SimpleNamespace(
            sample_images_dir=PACKAGE_ROOT / "sample-images",
            model_path=PACKAGE_ROOT / "model" / "varroa_mobilenetv2_160.tflite",
            classification_threshold=0.5,
            supabase_url="https://example.supabase.co",
            supabase_secret_key="test",
            request_timeout_seconds=1,
            sensor_mode="real",
        )
        with self.assertRaisesRegex(RuntimeError, "SHT40 preflight failed"):
            run_preflight(config, skip_backend=False)


if __name__ == "__main__":
    unittest.main()
