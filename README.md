# ClemsonParkingWidget

A **large Scriptable widget for iPhone** that displays real-time Clemson University commuter parking lot availability, powered by the Tigers Commute API.

## Features

- **Real-time occupancy** — fetches live data from `tigerscommute.com` every 5 minutes
- **Top 7 least-full lots** — sorted by availability so you always see the best options first
- **Color-coded status** — green (available), yellow (getting full ≥ 78%), red (nearly full ≥ 95%)
- **Occupancy bar** — visual bar showing how full each lot is
- **Sparkline chart** — 4-hour history chart for the second-least-full lot
- **Campus total** — overall campus-wide open space count
- **Best lot recommendation** — highlights the most available lot at a glance
- **Offline support** — falls back to cached data when the network is unavailable; shows a Wi-Fi slash icon
- **History cache** — stores up to 288 snapshots (~24 hours at 5-minute intervals) in a local JSON file

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
- The history chart appears after the widget has refreshed at least **3 times**.
- Cached history is stored at `<Documents>/tigers_parking_history.json`.