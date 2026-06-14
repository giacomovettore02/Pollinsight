from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

import serial


LOGGER = logging.getLogger("pollinsight-fona")
REGISTERED_STATUSES = {"1", "5"}


class FonaError(RuntimeError):
    pass


class FonaModem:
    def __init__(
        self,
        serial_port: str,
        baud_rate: int,
        power_key_gpio: int,
        registration_timeout_seconds: float,
    ):
        self.serial_port = serial_port
        self.baud_rate = baud_rate
        self.power_key_gpio = power_key_gpio
        self.registration_timeout_seconds = registration_timeout_seconds

    def command(
        self,
        port: serial.Serial,
        command: str,
        timeout_seconds: float = 3,
    ) -> str:
        port.reset_input_buffer()
        port.write(f"{command}\r".encode("ascii"))
        port.flush()
        deadline = time.monotonic() + timeout_seconds
        response = bytearray()
        while time.monotonic() < deadline:
            waiting = port.in_waiting
            if waiting:
                response.extend(port.read(waiting))
                text = response.decode("ascii", errors="replace")
                if "\r\nOK\r\n" in text or "\r\nERROR\r\n" in text:
                    return text
            time.sleep(0.05)
        return response.decode("ascii", errors="replace")

    def responds(self) -> bool:
        try:
            with serial.Serial(
                self.serial_port,
                self.baud_rate,
                timeout=0.2,
                write_timeout=1,
            ) as port:
                for _ in range(4):
                    if "OK" in self.command(port, "AT", 1):
                        self.command(port, "ATE0", 1)
                        return True
        except (OSError, serial.SerialException):
            return False
        return False

    def pulse_power_key(self) -> None:
        pinctrl = shutil.which("pinctrl")
        if pinctrl:
            subprocess.run(
                [pinctrl, "set", str(self.power_key_gpio), "op", "dl"],
                check=True,
            )
            time.sleep(2.2)
            subprocess.run(
                [pinctrl, "set", str(self.power_key_gpio), "ip"],
                check=True,
            )
            return

        gpio_root = Path("/sys/class/gpio")
        gpio_path = gpio_root / f"gpio{self.power_key_gpio}"
        if not gpio_path.exists():
            (gpio_root / "export").write_text(
                str(self.power_key_gpio),
                encoding="ascii",
            )
            time.sleep(0.2)
        (gpio_path / "direction").write_text("out", encoding="ascii")
        (gpio_path / "value").write_text("0", encoding="ascii")
        time.sleep(2.2)
        (gpio_path / "direction").write_text("in", encoding="ascii")

    def prepare(self) -> None:
        if not self.responds():
            LOGGER.info("FONA did not answer; pulsing KEY on GPIO%d", self.power_key_gpio)
            self.pulse_power_key()
            time.sleep(5)
        if not self.responds():
            raise FonaError(f"FONA did not answer on {self.serial_port}")

        deadline = time.monotonic() + self.registration_timeout_seconds
        with serial.Serial(
            self.serial_port,
            self.baud_rate,
            timeout=0.2,
            write_timeout=1,
        ) as port:
            sim_status = self.command(port, "AT+CPIN?", 3)
            if "READY" not in sim_status:
                raise FonaError(f"SIM is not ready: {sim_status.strip()}")

            while time.monotonic() < deadline:
                response = self.command(port, "AT+CREG?", 3)
                match = re.search(r"\+CREG:\s*\d,(\d)", response)
                if match and match.group(1) in REGISTERED_STATUSES:
                    signal = self.command(port, "AT+CSQ", 3).strip()
                    LOGGER.info("FONA registered on GSM network; %s", signal)
                    return
                time.sleep(2)

        raise FonaError(
            f"FONA did not register within {self.registration_timeout_seconds:.0f} seconds"
        )


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    modem = FonaModem(
        serial_port=os.getenv("FONA_SERIAL_PORT", "/dev/serial0"),
        baud_rate=int(os.getenv("FONA_BAUD_RATE", "115200")),
        power_key_gpio=int(os.getenv("FONA_POWER_KEY_GPIO", "17")),
        registration_timeout_seconds=float(
            os.getenv("FONA_REGISTRATION_TIMEOUT_SECONDS", "90")
        ),
    )
    modem.prepare()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
