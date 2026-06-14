from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class RuntimeState:
    last_batch_attempt_date: str | None = None
    payload: dict = field(default_factory=dict)
    pending_uploads: list[dict] = field(default_factory=list)

    @classmethod
    def load(cls, path: Path) -> "RuntimeState":
        if not path.exists():
            return cls()
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return cls()
        return cls(
            last_batch_attempt_date=raw.get("last_batch_attempt_date"),
            payload=raw.get("payload") or {},
            pending_uploads=raw.get("pending_uploads") or [],
        )

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(
                {
                    "last_batch_attempt_date": self.last_batch_attempt_date,
                    "payload": self.payload,
                    "pending_uploads": self.pending_uploads,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        temporary.replace(path)
