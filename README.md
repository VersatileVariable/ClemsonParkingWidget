# ClemsonParkingWidget

A **large Scriptable widget for iPhone** that displays real-time Clemson University commuter parking lot availability, powered by the Tigers Commute API.

## Features

- **Real-time occupancy** — fetches live data from `tigerscommute.com` every 5 minutes
- **Top 7 least-full lots** — sorted by availability so you always see the best options first
- **Color-coded status** — green (available), yellow (getting full ≥ 78%), red (nearly full ≥ 95%)
- **Occupancy bar** — visual bar showing how full each lot is
- **Daily chart with day-of-week trendline** — the chart X-axis spans the full day (12 AM → 11 PM). Today's live occupancy builds from midnight and resets automatically each night. A dimmed overlay shows the historical average for the same weekday (e.g., all past Tuesdays averaged), so you can instantly compare today's traffic against the usual pattern
- **Campus total** — overall campus-wide open space count
- **Best lot recommendation** — highlights the most available lot at a glance
- **Offline support** — falls back to cached data when the network is unavailable; shows a Wi-Fi slash icon
- **All-time archive** — every snapshot is stored persistently; nothing is ever discarded
- **Weekly trend engine** — running per-slot averages (by day of week) power the trendline overlay automatically

## Covered Lots

| Zone ID | Lot Name  |
|---------|-----------|
| 2       | C-01      |
| 4       | C-03      |
| 5       | C-07      |
| 6       | C-09      |
| 7       | C-11      |
| 25      | C-15      |
| 56      | C-01 Ext  |
| 57      | C-04      |
| 87      | P-05      |
| 198     | P-04      |
| 202     | P-06      |
| 203     | P-07      |
| 204     | P-08      |

## Installation

1. Install [Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188) from the App Store.
2. Copy the contents of [`TigersParking.js`](TigersParking.js) into a new Scriptable script.
3. Add a **large** Scriptable widget to your iPhone home screen.
4. Edit the widget and select the **TigersParking** script.

## Usage

- The widget refreshes automatically every **5 minutes**.
- Run the script inside Scriptable to preview it in large widget mode.
- The history chart appears after the widget has refreshed at least **2 times** today.
- Today's data point count is shown in the top-right corner of the widget.
- All snapshots are stored at `<Documents>/tigers_parking_archive.json`.
- Weekly trend data is stored at `<Documents>/tigers_parking_weekly.json`.

## Automation

### Option A — Scriptable Updater (iOS / iPadOS / macOS)

[`UpdateTigersParking.js`](UpdateTigersParking.js) is a companion Scriptable script that downloads
the latest `TigersParking.js` directly from GitHub without leaving your device.

1. Copy [`UpdateTigersParking.js`](UpdateTigersParking.js) into Scriptable as a script named
   **UpdateTigersParking**.
2. Tap **UpdateTigersParking** to run it — it will replace your existing `TigersParking.js` with
   the newest version from the `main` branch and show a confirmation alert.
3. *(Optional)* Create an iOS Shortcut that runs this script on a schedule (e.g., weekly) via
   **Shortcuts → Automation → Time of Day → Run Script → UpdateTigersParking**.

### Option B — Shell Script (macOS + iCloud Drive)

[`update.sh`](update.sh) downloads the latest script and installs it into the Scriptable iCloud
Drive folder on your Mac. iCloud then propagates the change to all your devices automatically.

```bash
# Make executable once
chmod +x update.sh

# Run manually
./update.sh
```

**Schedule automatic updates with cron** (e.g., every day at 06:00):

```bash
crontab -e
```

Add this line (replace the path with the actual location of your clone):

```
0 6 * * * /path/to/ClemsonParkingWidget/update.sh >> /tmp/tigers_parking_update.log 2>&1
```

**Prerequisites for Option B:**
- macOS with iCloud Drive enabled (**System Settings → [Your Name] → iCloud → iCloud Drive → ON**)
- Scriptable installed on at least one device signed into the same Apple ID
- `curl` (included with macOS)

> **Environment overrides** — you can point the script at a different fork or branch without
> editing the file:
> ```bash
> TIGERS_REPO=myorg/MyFork TIGERS_BRANCH=dev ./update.sh
> ```