from __future__ import annotations

import time
from pathlib import Path

from PIL import Image


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def discover_ready_images(
    inbox_dir: Path,
    minimum_age_seconds: float,
    now: float | None = None,
) -> tuple[list[Path], list[Path]]:
    inbox_dir.mkdir(parents=True, exist_ok=True)
    current_time = time.time() if now is None else now
    ready: list[Path] = []
    unreadable: list[Path] = []

    for path in sorted(inbox_dir.iterdir()):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        if current_time - path.stat().st_mtime < minimum_age_seconds:
            continue
        try:
            with Image.open(path) as image:
                image.verify()
        except Exception:
            unreadable.append(path)
            continue
        ready.append(path)

    return ready, unreadable


def archive_image(
    image_path: Path,
    archive_dir: Path,
    batch_date: str,
    infected: bool,
) -> Path:
    classification = "infected" if infected else "healthy"
    destination_dir = archive_dir / batch_date / classification
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / image_path.name
    counter = 1
    while destination.exists():
        destination = destination_dir / (
            f"{image_path.stem}_{counter}{image_path.suffix.lower()}"
        )
        counter += 1
    image_path.replace(destination)
    return destination
