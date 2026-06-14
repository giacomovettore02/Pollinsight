# PollinSight Adafruit FONA 800

This folder is the self-contained Raspberry Pi 3 package for PollinSight using
an Adafruit FONA 800 Shield and a 2G GPRS connection.

It:

- reads an SHT40 every 15 minutes;
- updates the existing Supabase `demo_runs` row without changing the database;
- classifies every complete image in `images/inbox` at 20:00 Europe/Rome;
- catches up once after boot when the 20:00 batch was missed;
- uploads every infected image to the existing `demo-evidence` bucket;
- archives processed images by date and classification;
- retries Supabase data and evidence uploads after cellular failures;
- starts automatically after every reboot.

## Hardware

Target:

- Raspberry Pi 3 Model B;
- Raspberry Pi OS Legacy Lite 64-bit;
- Adafruit FONA 800 Shield, product 2468;
- 500 mAh or larger 3.7 V LiPo battery;
- compatible 2G Mini SIM with a data plan;
- GSM antenna;
- SHT40 temperature and humidity sensor.

SHT40 wiring:

| SHT40 | Raspberry Pi physical pin |
| --- | --- |
| VIN | 1, 3.3 V |
| SDA | 3, GPIO2 |
| SCL | 5, GPIO3 |
| GND | 6 |

FONA wiring:

| FONA | Raspberry Pi physical pin |
| --- | --- |
| RX | 8, GPIO14/TXD |
| TX | 10, GPIO15/RXD |
| GND | 9 |
| KEY | 11, GPIO17 |

The FONA TX signal must use 3.3 V logic. Cut the shield VCCIO trace from 5 V
and solder the VCCIO selector to 3 V before connecting TX to the Raspberry Pi.
Raspberry Pi GPIO inputs are not 5 V tolerant.

To control KEY from GPIO17, cut the FONA KEY-to-GND jumper. The application
uses a two-second LOW pulse only when the modem does not answer. RST is not
connected.

## Configuration

Copy `.env.example` to `.env` and provide:

- the Supabase project URL;
- the Supabase secret key;
- a unique device ID;
- the APN required by the installed SIM.

The APN and keys are intentionally absent from this repository. `.env`,
runtime state, logs, inbox images, and archives are ignored by Git.

## Image Flow

A future camera should write one-bee images to:

```text
images/inbox/
```

Supported formats are `.jpg`, `.jpeg`, and `.png`. The scheduler only accepts
files that have not changed for at least 30 seconds and that Pillow can open.
Incomplete or unreadable files remain in the inbox for a later attempt.

Successful batches are archived as:

```text
archive/YYYY-MM-DD/healthy/
archive/YYYY-MM-DD/infected/
```

The repository includes sample images in `sample-images/`. With
`SEED_SAMPLE_IMAGES=true`, they are copied into an empty inbox on the first
application start. Set it to `false` for a real camera deployment.

## Installation

The first installation needs temporary Internet access to download Debian and
Python packages. Normal operation uses the Adafruit FONA PPP connection.

Manual installation:

```bash
cd raspberry-fona
cp .env.example .env
# Fill in .env.
chmod +x install.sh
sudo ./install.sh
```

The installer:

- installs Python, I2C, SSH, PPP, and runtime libraries;
- enables I2C and the primary UART;
- removes the serial console from the UART;
- assigns the stable PL011 UART to `/dev/serial0`;
- installs the PPP peer and chat configuration;
- installs `pollinsight-fona-ppp.service`;
- installs `pollinsight-fona.service`;
- reboots the Raspberry Pi.

## Runtime

Useful commands:

```bash
sudo systemctl status pollinsight-fona-ppp
sudo systemctl status pollinsight-fona
sudo journalctl -u pollinsight-fona-ppp -f
sudo journalctl -u pollinsight-fona -f
tail -f /opt/pollinsight-fona/logs/pollinsight-fona.log
```

Run the current inbox immediately:

```bash
cd /opt/pollinsight-fona
sudo -u pollinsight-fona .venv/bin/python -m pollinsight_fona.main --once
```

Validate the local model and mocked sensor:

```bash
.venv/bin/python -m pollinsight_fona.main \
  --preflight --skip-backend --sensor-mode mock
```

## Failure Behaviour

- FONA absent: the PPP service retries automatically.
- GSM registration exceeds 90 seconds: the PPP service restarts and retries.
- GPRS or Supabase unavailable: readings and batch state remain on disk.
- Evidence upload fails: all infected images stay in the dated archive and
  remain queued for retry.
- SHT40 unavailable: classification continues and the payload reports the
  sensor as offline.
- Inbox empty at 20:00: no artificial batch is created.
- Raspberry Pi boots after 20:00: one missed batch is attempted immediately.
