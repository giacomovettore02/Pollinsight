from __future__ import annotations

import argparse
import pathlib
import sys
import time

import paramiko


PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
ACCESS_FILE = PROJECT_ROOT / ".raspberry-access.txt"


def load_access() -> tuple[str, str]:
    values: dict[str, str] = {}
    for line in ACCESS_FILE.read_text(encoding="utf-8").splitlines():
        key, value = line.split("=", 1)
        values[key] = value
    return values["username"], values["password"]


def run(client: paramiko.SSHClient, command: str, check: bool = True) -> str:
    _, stdout, stderr = client.exec_command(command, get_pty=True)
    output = stdout.read().decode("utf-8", errors="replace")
    error = stderr.read().decode("utf-8", errors="replace")
    status = stdout.channel.recv_exit_status()
    combined = output + error
    printable = combined.encode(
        sys.stdout.encoding or "utf-8",
        errors="backslashreplace",
    ).decode(sys.stdout.encoding or "utf-8")
    print(printable, end="")
    if check and status != 0:
        raise RuntimeError(f"Remote command failed ({status}): {command}")
    return combined


def connect(host: str, timeout_seconds: int) -> paramiko.SSHClient:
    username, password = load_access()
    deadline = time.monotonic() + timeout_seconds
    while True:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                host,
                username=username,
                password=password,
                timeout=10,
                auth_timeout=10,
                banner_timeout=10,
            )
            return client
        except Exception as exc:
            client.close()
            if time.monotonic() >= deadline:
                raise TimeoutError(f"Could not connect to {host}: {exc}") from exc
            print(f"Waiting for {host}...")
            time.sleep(5)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="pollinsight-pi.local")
    parser.add_argument("--wait", type=int, default=300)
    args = parser.parse_args()

    client = connect(args.host, args.wait)
    _, password = load_access()
    try:
        print("Connected to Raspberry Pi.")
        run(client, "uname -a && hostname && ip -brief address")
        install_command = (
            "if [ -d /boot/firmware/pollinsight-fona ]; then "
            "payload=/boot/firmware/pollinsight-fona; "
            "elif [ -d /boot/pollinsight-fona ]; then "
            "payload=/boot/pollinsight-fona; "
            "else echo 'PollinSight FONA payload missing'; exit 41; fi; "
            f"printf '%s\\n' '{password}' | sudo -S "
            "env POLLINSIGHT_RUN_USER=pollinsight-fona "
            "POLLINSIGHT_SKIP_REBOOT=1 bash \"$payload/install.sh\""
        )
        run(client, install_command)
        run(
            client,
            f"printf '%s\\n' '{password}' | sudo -S systemctl reboot",
            check=False,
        )
        print("PollinSight FONA installed; the Raspberry Pi is rebooting.")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
