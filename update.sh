#!/usr/bin/env bash
# update.sh — Sync TigersParking.js from GitHub to Scriptable (macOS + iCloud Drive)
#
# Usage:
#   chmod +x update.sh      # make executable (first run only)
#   ./update.sh             # run manually
#
# Automate with cron — to update every day at 06:00:
#   crontab -e
#   Add:  0 6 * * * /path/to/ClemsonParkingWidget/update.sh >> /tmp/tigers_parking_update.log 2>&1
#
# Prerequisites:
#   • macOS with iCloud Drive enabled (System Settings → Apple ID → iCloud → iCloud Drive)
#   • Scriptable installed on at least one device signed into the same Apple ID
#   • curl (included with macOS)

set -euo pipefail

REPO="${TIGERS_REPO:-VersatileVariable/ClemsonParkingWidget}"
BRANCH="${TIGERS_BRANCH:-main}"
SCRIPT_FILE="TigersParking.js"
RAW_URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}/${SCRIPT_FILE}"

SCRIPTABLE_DIR="${HOME}/Library/Mobile Documents/iCloud~dk~simonbs~scriptable/Documents"

# ── Preflight ──────────────────────────────────────────────────────────────────
if [ ! -d "$SCRIPTABLE_DIR" ]; then
  echo "ERROR: Scriptable iCloud directory not found:"
  echo "  $SCRIPTABLE_DIR"
  echo ""
  echo "Checklist:"
  echo "  1. Install Scriptable on an iPhone or iPad signed into your iCloud account."
  echo "  2. Enable iCloud Drive on this Mac:"
  echo "       System Settings → [Your Name] → iCloud → iCloud Drive → ON"
  echo "  3. Open Scriptable on your device at least once so the folder is created."
  exit 1
fi

# ── Download ────────────────────────────────────────────────────────────────────
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
echo "[${TIMESTAMP}] Downloading ${SCRIPT_FILE} from github.com/${REPO} (branch: ${BRANCH})..."

TMP_FILE="$(mktemp /tmp/tigers_parking_XXXXXX.js)"
trap 'rm -f "$TMP_FILE"' EXIT

curl -fsSL "$RAW_URL" -o "$TMP_FILE"

# Sanity-check: make sure we didn't download a GitHub 404 HTML page
if ! grep -q "Scriptable" "$TMP_FILE"; then
  echo "ERROR: Downloaded file does not look like a Scriptable script."
  echo "       Check that the repository and branch are correct."
  exit 1
fi

# ── Install ─────────────────────────────────────────────────────────────────────
cp "$TMP_FILE" "${SCRIPTABLE_DIR}/${SCRIPT_FILE}"

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
echo "[${TIMESTAMP}] Done — ${SCRIPT_FILE} synced to Scriptable (iCloud will propagate to your device shortly)."
