// UpdateTigersParking — GitHub Auto-Updater
// Run this script in Scriptable to pull the latest TigersParking.js from GitHub.
//
// Setup:
//   1. Copy this file into Scriptable as a script named "UpdateTigersParking".
//   2. Tap it any time you want to update TigersParking to the newest version.
//   3. Optionally wire it to a Shortcut or schedule via the Shortcuts automation tab.

const REPO   = "VersatileVariable/ClemsonParkingWidget";
const BRANCH = "main";
const FILE   = "TigersParking.js";
const URL    = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE}`;

const alert = new Alert();
try {
  const req  = new Request(URL);
  const code = await req.loadString();

  if (!code || code.trim().length === 0) throw new Error("Empty response from GitHub");

  // Prefer iCloud so the update propagates across devices; fall back to local
  let fm;
  try { fm = FileManager.iCloud(); } catch { fm = FileManager.local(); }

  fm.writeString(fm.joinPath(fm.documentsDirectory(), FILE), code);

  alert.title   = "Update Successful ✓";
  alert.message = `${FILE} has been updated to the latest version from the "${BRANCH}" branch.`;
} catch (e) {
  alert.title   = "Update Failed ✗";
  alert.message = `Could not fetch update:\n${e.message}`;
}

alert.addAction("OK");
await alert.present();
Script.complete();
