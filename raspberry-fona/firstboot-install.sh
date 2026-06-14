#!/bin/sh
set -eu

if [ -d /boot/firmware ]; then
  BOOT_DIR="/boot/firmware"
else
  BOOT_DIR="/boot"
fi

SOURCE_DIR="${BOOT_DIR}/pollinsight-fona"
BOOTSTRAP_DIR="/opt/pollinsight-fona-bootstrap"
BOOTSTRAP_SERVICE="/etc/systemd/system/pollinsight-fona-bootstrap.service"

if [ ! -d "${SOURCE_DIR}" ]; then
  echo "PollinSight FONA payload missing from boot partition" >&2
  exit 1
fi

rm -rf "${BOOTSTRAP_DIR}"
install -d -m 0755 "${BOOTSTRAP_DIR}"
cp -a "${SOURCE_DIR}/." "${BOOTSTRAP_DIR}/"
chmod 0700 "${BOOTSTRAP_DIR}/install.sh"

install -m 0644 \
  "${BOOTSTRAP_DIR}/pollinsight-fona-bootstrap.service" \
  "${BOOTSTRAP_SERVICE}"

systemctl daemon-reload
systemctl enable pollinsight-fona-bootstrap.service
