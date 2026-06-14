from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_secret_key: str
    device_id: str
    model_path: Path
    inbox_dir: Path
    sample_images_dir: Path
    archive_dir: Path
    state_dir: Path
    sensor_mode: str
    telemetry_interval_seconds: float
    classification_hour: int
    classification_minute: int
    timezone_name: str
    minimum_file_age_seconds: float
    upload_retry_seconds: float
    request_timeout_seconds: float
    classification_threshold: float
    ppp_interface: str
    seed_sample_images: bool

    @classmethod
    def load(cls, sensor_mode_override: str | None = None) -> "Config":
        load_dotenv(PACKAGE_ROOT / ".env")
        url = os.getenv("SUPABASE_URL", "").rstrip("/")
        secret = os.getenv("SUPABASE_SECRET_KEY", "")
        if not url or not secret:
            raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY are required")

        sensor_mode = sensor_mode_override or os.getenv("SENSOR_MODE", "real")
        if sensor_mode not in {"real", "mock"}:
            raise ValueError("SENSOR_MODE must be real or mock")

        classification_hour = int(os.getenv("CLASSIFICATION_HOUR", "20"))
        classification_minute = int(os.getenv("CLASSIFICATION_MINUTE", "0"))
        if not 0 <= classification_hour <= 23:
            raise ValueError("CLASSIFICATION_HOUR must be between 0 and 23")
        if not 0 <= classification_minute <= 59:
            raise ValueError("CLASSIFICATION_MINUTE must be between 0 and 59")

        return cls(
            supabase_url=url,
            supabase_secret_key=secret,
            device_id=os.getenv("DEVICE_ID", "pollinsight-fona-01"),
            model_path=PACKAGE_ROOT / "model" / "varroa_mobilenetv2_160.tflite",
            inbox_dir=PACKAGE_ROOT / "images" / "inbox",
            sample_images_dir=PACKAGE_ROOT / "sample-images",
            archive_dir=PACKAGE_ROOT / "archive",
            state_dir=PACKAGE_ROOT / "state",
            sensor_mode=sensor_mode,
            telemetry_interval_seconds=float(
                os.getenv("TELEMETRY_INTERVAL_SECONDS", "900")
            ),
            classification_hour=classification_hour,
            classification_minute=classification_minute,
            timezone_name=os.getenv("POLLINSIGHT_TIMEZONE", "Europe/Rome"),
            minimum_file_age_seconds=float(
                os.getenv("MINIMUM_FILE_AGE_SECONDS", "30")
            ),
            upload_retry_seconds=float(os.getenv("UPLOAD_RETRY_SECONDS", "300")),
            request_timeout_seconds=float(
                os.getenv("REQUEST_TIMEOUT_SECONDS", "60")
            ),
            classification_threshold=float(
                os.getenv("CLASSIFICATION_THRESHOLD", "0.5")
            ),
            ppp_interface=os.getenv("FONA_PPP_INTERFACE", "ppp0"),
            seed_sample_images=env_bool("SEED_SAMPLE_IMAGES", True),
        )
