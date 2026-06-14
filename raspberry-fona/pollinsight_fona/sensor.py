from __future__ import annotations

import os
import statistics
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class SensorReading:
    status: str
    temperature_c: float | None
    humidity_percent: float | None
    error: str | None = None


def read_sht40(mode: str, samples: int = 5, interval_seconds: float = 0.5) -> SensorReading:
    if mode == "mock":
        return SensorReading(
            status="online",
            temperature_c=float(os.getenv("MOCK_TEMPERATURE_C", "24.6")),
            humidity_percent=float(os.getenv("MOCK_HUMIDITY_PERCENT", "54.2")),
        )

    try:
        import adafruit_sht4x
        import board

        sensor = adafruit_sht4x.SHT4x(board.I2C())
        sensor.mode = adafruit_sht4x.Mode.NOHEAT_HIGHPRECISION
        temperatures: list[float] = []
        humidities: list[float] = []

        for index in range(samples):
            temperature, humidity = sensor.measurements
            if -40 <= temperature <= 125 and 0 <= humidity <= 100:
                temperatures.append(float(temperature))
                humidities.append(float(humidity))
            if index < samples - 1:
                time.sleep(interval_seconds)

        required_valid_samples = min(3, samples)
        if len(temperatures) < required_valid_samples:
            raise RuntimeError(f"Only {len(temperatures)} valid SHT40 readings")

        return SensorReading(
            status="online",
            temperature_c=round(statistics.median(temperatures), 2),
            humidity_percent=round(statistics.median(humidities), 2),
        )
    except Exception as exc:
        return SensorReading(
            status="offline",
            temperature_c=None,
            humidity_percent=None,
            error=str(exc),
        )
