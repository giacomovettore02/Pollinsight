from __future__ import annotations

import json
import mimetypes
from pathlib import Path
from urllib.parse import quote

import requests


class BackendError(RuntimeError):
    pass


class SupabaseBackend:
    def __init__(
        self,
        url: str,
        secret_key: str,
        timeout_seconds: float = 10,
        required_interface: str | None = None,
    ):
        self.url = url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.required_interface = required_interface
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": secret_key,
                "Authorization": f"Bearer {secret_key}",
            }
        )

    def _ensure_cellular_link(self) -> None:
        if not self.required_interface:
            return
        interface_path = Path("/sys/class/net") / self.required_interface
        if not interface_path.exists():
            raise BackendError(
                f"Required FONA interface {self.required_interface} is unavailable"
            )
        operstate = interface_path / "operstate"
        if operstate.exists():
            state = operstate.read_text(encoding="ascii").strip()
            if state not in {"up", "unknown"}:
                raise BackendError(
                    f"Required FONA interface {self.required_interface} is {state}"
                )

    def upsert_run(self, payload: dict) -> None:
        self._ensure_cellular_link()
        response = self.session.post(
            f"{self.url}/rest/v1/demo_runs",
            params={"on_conflict": "boot_id"},
            headers={
                "Prefer": "resolution=merge-duplicates,return=minimal",
                "Content-Type": "application/json",
            },
            data=json.dumps(payload),
            timeout=self.timeout_seconds,
        )
        if response.status_code not in {200, 201, 204}:
            raise BackendError(f"Run update failed: {response.status_code} {response.text}")

    def upload_evidence(
        self,
        device_id: str,
        batch_date: str,
        image_path: Path,
    ) -> tuple[str, str]:
        self._ensure_cellular_link()
        object_path = f"{device_id}/{batch_date}/{image_path.name}"
        encoded_path = quote(object_path, safe="/")
        content_type = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
        response = self.session.post(
            f"{self.url}/storage/v1/object/demo-evidence/{encoded_path}",
            headers={
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            data=image_path.read_bytes(),
            timeout=self.timeout_seconds,
        )
        if response.status_code not in {200, 201}:
            raise BackendError(f"Image upload failed: {response.status_code} {response.text}")
        public_url = f"{self.url}/storage/v1/object/public/demo-evidence/{encoded_path}"
        return object_path, public_url

    def check(self) -> None:
        self._ensure_cellular_link()
        response = self.session.get(
            f"{self.url}/rest/v1/demo_runs",
            params={"select": "id", "limit": "1"},
            timeout=self.timeout_seconds,
        )
        if response.status_code != 200:
            raise BackendError(f"Backend check failed: {response.status_code} {response.text}")
