#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo: sudo ./install.sh"
  exit 1
fi

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="/opt/pollinsight-fona"
APP_SERVICE="/etc/systemd/system/pollinsight-fona.service"
PPP_SERVICE="/etc/systemd/system/pollinsight-fona-ppp.service"
PEER_FILE="/etc/ppp/peers/pollinsight-fona"
CHAT_FILE="/etc/chatscripts/pollinsight-fona"
RUN_USER="${POLLINSIGHT_RUN_USER:-pollinsight-fona}"

if [[ ! -f "${SOURCE_DIR}/.env" ]]; then
  echo "Missing ${SOURCE_DIR}/.env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "${SOURCE_DIR}/.env"
set +a

: "${SUPABASE_URL:?SUPABASE_URL is required in .env}"
: "${SUPABASE_SECRET_KEY:?SUPABASE_SECRET_KEY is required in .env}"
: "${FONA_APN:?FONA_APN is required in .env}"

if [[ ! "${FONA_APN}" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "FONA_APN contains unsupported characters"
  exit 1
fi

if ! id "${RUN_USER}" >/dev/null 2>&1; then
  useradd --create-home --user-group --shell /usr/sbin/nologin "${RUN_USER}"
  passwd --lock "${RUN_USER}"
fi
RUN_GROUP="$(id -gn "${RUN_USER}")"

apt-get -o Acquire::Retries=10 -o DPkg::Lock::Timeout=180 update
if ! apt-get -o Acquire::Retries=10 -o DPkg::Lock::Timeout=180 install -y \
  python3-venv python3-pip i2c-tools libopenblas0-pthread openssh-server \
  ppp; then
  apt-get -o Acquire::Retries=10 -o DPkg::Lock::Timeout=180 install -y \
    python3-venv python3-pip i2c-tools libopenblas0 openssh-server \
    ppp
fi

if command -v raspi-config >/dev/null 2>&1; then
  raspi-config nonint do_i2c 0
  raspi-config nonint do_boot_behaviour B2
fi

BOOT_DIR="/boot"
if [[ -d /boot/firmware ]]; then
  BOOT_DIR="/boot/firmware"
fi

if ! grep -q '^enable_uart=1$' "${BOOT_DIR}/config.txt"; then
  printf '\nenable_uart=1\n' >> "${BOOT_DIR}/config.txt"
fi
if ! grep -q '^dtoverlay=disable-bt$' "${BOOT_DIR}/config.txt"; then
  printf 'dtoverlay=disable-bt\n' >> "${BOOT_DIR}/config.txt"
fi
sed -E -i \
  's/(^| )console=(serial0|ttyAMA0|ttyS0),[0-9]+//g; s/ +/ /g; s/^ //; s/ $//' \
  "${BOOT_DIR}/cmdline.txt"

systemctl disable hciuart.service 2>/dev/null || true
systemctl unmask ssh.service
systemctl enable --now ssh.service

usermod -aG i2c "${RUN_USER}"
install -d -m 0755 "${TARGET_DIR}"
cp -a "${SOURCE_DIR}/." "${TARGET_DIR}/"
rm -rf \
  "${TARGET_DIR}/.venv" \
  "${TARGET_DIR}/state" \
  "${TARGET_DIR}/logs" \
  "${TARGET_DIR}/archive" \
  "${TARGET_DIR}/images/inbox"

python3 -m venv "${TARGET_DIR}/.venv"
"${TARGET_DIR}/.venv/bin/python" -m pip install --upgrade pip
"${TARGET_DIR}/.venv/bin/python" -m pip install -r "${TARGET_DIR}/requirements.txt"

install -d -o "${RUN_USER}" -g "${RUN_GROUP}" -m 0755 \
  "${TARGET_DIR}/state" \
  "${TARGET_DIR}/logs" \
  "${TARGET_DIR}/archive" \
  "${TARGET_DIR}/images/inbox"
chown -R "${RUN_USER}:${RUN_GROUP}" "${TARGET_DIR}"
chmod 0600 "${TARGET_DIR}/.env"

sed "s/__POLLINSIGHT_USER__/${RUN_USER}/g" \
  "${TARGET_DIR}/pollinsight-fona.service" > "${APP_SERVICE}"
install -m 0644 \
  "${TARGET_DIR}/pollinsight-fona-ppp.service" \
  "${PPP_SERVICE}"

install -d -m 0755 /etc/chatscripts /etc/ppp/peers
cat > "${CHAT_FILE}" <<EOF
ABORT 'BUSY'
ABORT 'NO CARRIER'
ABORT 'NO DIALTONE'
ABORT 'ERROR'
TIMEOUT 15
'' AT
OK ATE0
OK AT+CGDCONT=1,"IP","${FONA_APN}"
OK ATD*99***1#
CONNECT ''
EOF
chmod 0600 "${CHAT_FILE}"

cat > "${PEER_FILE}" <<EOF
${FONA_SERIAL_PORT:-/dev/serial0}
${FONA_BAUD_RATE:-115200}
connect "/usr/sbin/chat -s -v -f ${CHAT_FILE}"
noauth
noipdefault
ipcp-accept-local
ipcp-accept-remote
defaultroute
replacedefaultroute
usepeerdns
persist
holdoff 10
maxfail 0
local
lock
novj
nobsdcomp
nodeflate
EOF

if [[ -n "${FONA_APN_USER:-}" ]]; then
  printf 'user "%s"\n' "${FONA_APN_USER}" >> "${PEER_FILE}"
  printf '"%s" * "%s" *\n' \
    "${FONA_APN_USER}" "${FONA_APN_PASSWORD:-}" >> /etc/ppp/pap-secrets
fi
chmod 0600 "${PEER_FILE}"

runuser -u "${RUN_USER}" -- \
  bash -c "cd '${TARGET_DIR}' && exec '${TARGET_DIR}/.venv/bin/python' \
    -m pollinsight_fona.main --preflight --skip-backend --sensor-mode mock"

systemctl daemon-reload
systemctl enable pollinsight-fona-ppp.service
systemctl enable pollinsight-fona.service
touch "${TARGET_DIR}/.installed"
systemctl disable pollinsight-fona-bootstrap.service 2>/dev/null || true

echo "Installation complete. Rebooting to activate the UART and FONA services."
if [[ "${POLLINSIGHT_SKIP_REBOOT:-0}" != "1" ]]; then
  systemctl reboot
fi
