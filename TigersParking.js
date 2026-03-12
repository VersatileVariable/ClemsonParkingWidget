// Tigers Parking — Scriptable Widget
// Large widget · Commuter lots · iPhone

const API_URL     = "https://www.tigerscommute.com/api/ElevenX/ZonesOccupancyStatus";
const ARCHIVE_KEY = "tigers_parking_archive";  // All historical snapshots (unbounded)
const WEEKLY_KEY  = "tigers_parking_weekly";   // Running averages by day-of-week + time slot
const DEFAULT_CHART_LOT_ID = 4; // C-03 fallback when no lots are loaded

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const C_LOTS = {
  2:  "C-01",
  4:  "C-03",
  5:  "C-07",
  6:  "C-09",
  7:  "C-11",
  25: "C-15",
  56: "C-01 Ext",
  57: "C-04",
};

// ── Palette — muted, low saturation ─────────────────
const C = {
  bg:      new Color("#111111"),
  surface: new Color("#1c1c1c"),
  border:  new Color("#2c2c2c"),
  text:    new Color("#d4d4d4"),
  dim:     new Color("#666666"),
  dimmer:  new Color("#444444"),
  accent:  new Color("#c96a2a"),
  ok:      new Color("#5a8a5a"),
  warn:    new Color("#9a8a40"),
  full:    new Color("#8a4040"),
  line:    new Color("#c96a2a"),
  fill:    new Color("#c96a2a", 0.15),
};

// ── Helpers ──────────────────────────────────────────
function pct(o, v) {
  const t = o + v;
  return t > 0 ? Math.round(o / t * 100) : 0;
}

function statusColor(p) {
  if (p >= 95) return C.full;
  if (p >= 78) return C.warn;
  return C.ok;
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Returns the 5-minute slot index (0–287) for a given timestamp
function timeSlotOf(ts) {
  const d = new Date(ts);
  return Math.floor((d.getHours() * 60 + d.getMinutes()) / 5);
}

// Returns midnight timestamp for the day containing ts
function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ── Archive (all historical snapshots, never trimmed) ─
function loadArchive() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), ARCHIVE_KEY + ".json");
  if (!fm.fileExists(path)) return [];
  try { return JSON.parse(fm.readString(path)); }
  catch { return []; }
}

function saveArchive(archive) {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), ARCHIVE_KEY + ".json");
  fm.writeString(path, JSON.stringify(archive));
}

// Filter archive to snapshots taken today (since midnight)
function getTodayHistory(archive) {
  const todayStart = startOfDay(Date.now());
  return archive.filter(s => s.ts >= todayStart);
}

// ── Weekly Trends (running avg per day-of-week + time slot + zone) ──
function loadWeeklyTrends() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), WEEKLY_KEY + ".json");
  if (!fm.fileExists(path)) return {};
  try { return JSON.parse(fm.readString(path)); }
  catch { return {}; }
}

function saveWeeklyTrends(trends) {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), WEEKLY_KEY + ".json");
  fm.writeString(path, JSON.stringify(trends));
}

// Update incremental running averages from a new snapshot
function updateWeeklyTrends(snap, trends) {
  const d    = new Date(snap.ts);
  const dow  = d.getDay();
  const slot = timeSlotOf(snap.ts);
  Object.entries(snap.lots).forEach(([zoneId, data]) => {
    const p   = pct(data.o, data.v);
    const key = `${dow}_${slot}_${zoneId}`;
    if (!trends[key]) trends[key] = { sum: 0, count: 0 };
    trends[key].sum   += p;
    trends[key].count += 1;
  });
  return trends;
}

// Returns array of { slot, avg } for the given day-of-week and zone
function getTrendlineForDow(trends, dow, zoneId) {
  const points = [];
  for (let slot = 0; slot < 288; slot++) {
    const key = `${dow}_${slot}_${zoneId}`;
    if (trends[key] && trends[key].count > 0) {
      points.push({ slot, avg: Math.round(trends[key].sum / trends[key].count) });
    }
  }
  return points;
}

function appendSnapshot(data) {
  const archive = loadArchive();
  const snap = { ts: Date.now(), lots: {} };
  data.forEach(z => {
    if (C_LOTS[z.zone_id] && z.subzone_id === null)
      snap.lots[z.zone_id] = { o: z.occupied, v: z.vacant };
  });
  archive.push(snap);
  saveArchive(archive);

  const trends = loadWeeklyTrends();
  updateWeeklyTrends(snap, trends);
  saveWeeklyTrends(trends);

  return archive;
}

// ── Fetch ────────────────────────────────────────────
async function fetchParking() {
  const req = new Request(API_URL);
  req.method = "POST";
  req.headers = { "Content-Type": "application/json" };
  req.body = JSON.stringify({});
  const json = await req.loadJSON();
  if (!json.IsSuccessful) throw new Error("API error");
  return json.Result;
}

// ── Chart (today's live data + day-of-week trendline) ────────────
// todayHistory : snapshots from midnight to now (live data line)
// trends       : weekly trend object from loadWeeklyTrends()
// zoneId       : lot to chart
// dow          : day of week (0 = Sunday)
function drawChart(todayHistory, trends, zoneId, dow, w, h) {
  // Live points: slot index + occupancy % for today's snapshots
  const livePts = todayHistory
    .filter(s => s.lots && s.lots[zoneId])
    .map(s => ({ slot: timeSlotOf(s.ts), p: pct(s.lots[zoneId].o, s.lots[zoneId].v) }));

  // Historical trendline points for the current day-of-week (full day, 0–287)
  const trendPts = getTrendlineForDow(trends, dow, zoneId);

  if (livePts.length < 2 && trendPts.length < 2) return null;

  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const pad = { t: 6, r: 6, b: 16, l: 26 };
  const cW = w - pad.l - pad.r;
  const cH = h - pad.t - pad.b;

  // X maps a 5-min slot (0–287) across the full day width
  const xS = slot => pad.l + (slot / 287) * cW;
  const yS = p    => pad.t + cH - (p / 100 * cH);

  // Grid lines
  [25, 50, 75, 100].forEach(v => {
    const y = yS(v);
    const gp = new Path();
    gp.move(new Point(pad.l, y));
    gp.addLine(new Point(pad.l + cW, y));
    ctx.setStrokeColor(new Color("#2c2c2c"));
    ctx.setLineWidth(0.5);
    ctx.addPath(gp);
    ctx.strokePath();
    ctx.setTextColor(new Color("#444444"));
    ctx.setFont(Font.systemFont(7));
    ctx.drawTextInRect(String(v), new Rect(0, y - 5, 24, 10));
  });

  // ── Trendline (dimmed, drawn first so live data sits on top) ──
  if (trendPts.length >= 2) {
    const tp = new Path();
    tp.move(new Point(xS(trendPts[0].slot), yS(trendPts[0].avg)));
    trendPts.forEach((pt, i) => {
      if (i > 0) tp.addLine(new Point(xS(pt.slot), yS(pt.avg)));
    });
    ctx.setStrokeColor(new Color("#c96a2a", 0.45));
    ctx.setLineWidth(1.0);
    ctx.addPath(tp);
    ctx.strokePath();
  }

  // ── Live fill ──
  if (livePts.length >= 2) {
    const fp = new Path();
    fp.move(new Point(xS(livePts[0].slot), yS(livePts[0].p)));
    livePts.forEach((pt, i) => { if (i > 0) fp.addLine(new Point(xS(pt.slot), yS(pt.p))); });
    fp.addLine(new Point(xS(livePts[livePts.length - 1].slot), pad.t + cH));
    fp.addLine(new Point(xS(livePts[0].slot), pad.t + cH));
    fp.closeSubpath();
    ctx.setFillColor(new Color("#c96a2a", 0.15));
    ctx.addPath(fp);
    ctx.fillPath();
  }

  // ── Live line ──
  if (livePts.length >= 2) {
    const lp = new Path();
    lp.move(new Point(xS(livePts[0].slot), yS(livePts[0].p)));
    livePts.forEach((pt, i) => { if (i > 0) lp.addLine(new Point(xS(pt.slot), yS(pt.p))); });
    ctx.setStrokeColor(new Color("#c96a2a"));
    ctx.setLineWidth(1.5);
    ctx.addPath(lp);
    ctx.strokePath();
  }

  // ── End dot on live data ──
  if (livePts.length > 0) {
    const last = livePts[livePts.length - 1];
    const dp = new Path();
    dp.addEllipse(new Rect(xS(last.slot) - 3, yS(last.p) - 3, 6, 6));
    ctx.setFillColor(new Color("#c96a2a"));
    ctx.addPath(dp);
    ctx.fillPath();
  }

  // Time labels: 12 AM | 12 PM | 11 PM
  ctx.setFont(Font.systemFont(7));
  ctx.setTextColor(new Color("#444444"));
  ctx.drawTextInRect("12 AM", new Rect(pad.l,              h - 13, 34, 12));
  ctx.drawTextInRect("12 PM", new Rect(pad.l + cW / 2 - 17, h - 13, 34, 12));
  ctx.drawTextInRect("11 PM", new Rect(w - 36,             h - 13, 36, 12));

  return ctx.getImage();
}

// ── Widget ───────────────────────────────────────────

// Renders the "chart not ready yet" placeholder
function addNoChartPlaceholder(widget) {
  const row = widget.addStack();
  row.backgroundColor = C.surface;
  row.cornerRadius = 4;
  row.setPadding(5, 8, 5, 8);
  const txt = row.addText("Chart builds after a few refreshes");
  txt.textColor = C.dimmer;
  txt.font = Font.systemFont(8);
}

async function buildWidget() {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 12, 14);
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

  let data, archive, todayHistory, weeklyTrends, offline = false;

  try {
    data         = await fetchParking();
    archive      = appendSnapshot(data);
    weeklyTrends = loadWeeklyTrends();
  } catch {
    offline      = true;
    archive      = loadArchive();
    weeklyTrends = loadWeeklyTrends();
    data         = archive.length
      ? Object.entries(archive[archive.length - 1].lots).map(([id, d]) => ({
          zone_id: parseInt(id), subzone_id: null, occupied: d.o, vacant: d.v
        }))
      : [];
  }

  todayHistory = getTodayHistory(archive);
  const now = new Date();
  const dow = now.getDay();

  // ── Header ──
  const hdr = w.addStack();
  hdr.layoutHorizontally();
  hdr.centerAlignContent();

  const parkIcon = SFSymbol.named("parkingsign.circle");
  parkIcon.applyFont(Font.systemFont(15));
  const parkImg = hdr.addImage(parkIcon.image);
  parkImg.imageSize = new Size(17, 17);
  parkImg.tintColor = C.accent;
  hdr.addSpacer(6);

  const titleCol = hdr.addStack();
  titleCol.layoutVertically();
  const t1 = titleCol.addText("CLEMSON PARKING");
  t1.textColor = C.text;
  t1.font = Font.boldSystemFont(11);
  const t2 = titleCol.addText("commuter lots");
  t2.textColor = C.dim;
  t2.font = Font.systemFont(8);

  hdr.addSpacer();

  const timeCol = hdr.addStack();
  timeCol.layoutVertically();

  if (offline) {
    const wifiIcon = SFSymbol.named("wifi.slash");
    wifiIcon.applyFont(Font.systemFont(10));
    const wifiImg = timeCol.addImage(wifiIcon.image);
    wifiImg.imageSize = new Size(13, 13);
    wifiImg.tintColor = C.warn;
  } else {
    const tTxt = timeCol.addText(fmtTime(new Date()));
    tTxt.textColor = C.dim;
    tTxt.font = Font.systemFont(9);
    tTxt.rightAlignText();
  }

  const ptsTxt = timeCol.addText(`${todayHistory.length} pts`);
  ptsTxt.textColor = C.dimmer;
  ptsTxt.font = Font.systemFont(7);
  ptsTxt.rightAlignText();

  w.addSpacer(8);

  // Divider
  const divRow = w.addStack();
  divRow.backgroundColor = C.border;
  divRow.size = new Size(-1, 1);
  w.addSpacer(8);

  // ── Campus total ──
  const total = data.find(z => z.zone_id === 16 && z.subzone_id === null);
  if (total) {
    const tp = pct(total.occupied, total.vacant);
    const sumRow = w.addStack();
    sumRow.layoutHorizontally();
    sumRow.centerAlignContent();

    const carIcon = SFSymbol.named("car.2");
    carIcon.applyFont(Font.systemFont(9));
    const carImg = sumRow.addImage(carIcon.image);
    carImg.imageSize = new Size(12, 12);
    carImg.tintColor = statusColor(tp);
    sumRow.addSpacer(5);

    const sumTxt = sumRow.addText(`${total.vacant} open  ·  ${tp}% full`);
    sumTxt.textColor = C.dim;
    sumTxt.font = Font.systemFont(9);
    w.addSpacer(8);
  }

  // ── Lot rows ──
  const lots = data
    .filter(z => C_LOTS[z.zone_id] && z.subzone_id === null)
    .sort((a, b) => pct(a.occupied, a.vacant) - pct(b.occupied, b.vacant))
    .slice(0, 7);

  for (const lot of lots) {
    const p   = pct(lot.occupied, lot.vacant);
    const col = statusColor(p);

    const row = w.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();

    // Status indicator
    const dotSym = SFSymbol.named("circle.fill");
    dotSym.applyFont(Font.systemFont(5));
    const dotImg = row.addImage(dotSym.image);
    dotImg.imageSize = new Size(5, 5);
    dotImg.tintColor = col;
    row.addSpacer(6);

    const nameTxt = row.addText(C_LOTS[lot.zone_id]);
    nameTxt.textColor = C.text;
    nameTxt.font = Font.boldSystemFont(10);
    nameTxt.minimumScaleFactor = 0.8;
    row.addSpacer();

    // Bar track
    const barBg = row.addStack();
    barBg.size = new Size(58, 4);
    barBg.backgroundColor = C.border;
    barBg.cornerRadius = 2;
    const barFg = barBg.addStack();
    barFg.size = new Size(Math.max(1, 58 * p / 100), 4);
    barFg.backgroundColor = col;
    barFg.cornerRadius = 2;
    barBg.addSpacer();
    row.addSpacer(6);

    const pTxt = row.addText(`${p}%`);
    pTxt.textColor = col;
    pTxt.font = Font.regularMonospacedSystemFont(9);
    row.addSpacer(5);

    const vTxt = row.addText(`${lot.vacant}`);
    vTxt.textColor = C.dim;
    vTxt.font = Font.regularMonospacedSystemFont(9);

    w.addSpacer(4);
  }

  w.addSpacer(5);

  // ── Chart ──
  const chartLotId   = lots.length > 1 ? lots[1].zone_id : (lots[0]?.zone_id || DEFAULT_CHART_LOT_ID);
  const chartLotName = C_LOTS[chartLotId] || "";

  const chartHdr = w.addStack();
  chartHdr.layoutHorizontally();
  chartHdr.centerAlignContent();

  const chartSym = SFSymbol.named("chart.xyaxis.line");
  chartSym.applyFont(Font.systemFont(8));
  const chartSymImg = chartHdr.addImage(chartSym.image);
  chartSymImg.imageSize = new Size(10, 10);
  chartSymImg.tintColor = C.dim;
  chartHdr.addSpacer(4);

  const chartLblTxt = chartHdr.addText(`${chartLotName}  ·  ${DAY_NAMES[dow]} today + trend`);
  chartLblTxt.textColor = C.dim;
  chartLblTxt.font = Font.systemFont(8);

  w.addSpacer(3);

  if (todayHistory.length >= 2 || Object.keys(weeklyTrends).length > 0) {
    const chartImg = drawChart(todayHistory, weeklyTrends, chartLotId, dow, 268, 56);
    if (chartImg) {
      const imgEl = w.addImage(chartImg);
      imgEl.resizable = true;
      imgEl.imageSize = new Size(268, 56);
    } else {
      addNoChartPlaceholder(w);
    }
  } else {
    addNoChartPlaceholder(w);
  }

  w.addSpacer(6);

  // ── Recommendation row ──
  if (lots.length > 0) {
    const best = lots[0];
    const bp   = pct(best.occupied, best.vacant);

    const recRow = w.addStack();
    recRow.layoutHorizontally();
    recRow.centerAlignContent();
    recRow.backgroundColor = C.surface;
    recRow.cornerRadius = 5;
    recRow.setPadding(5, 8, 5, 8);

    const recSym = SFSymbol.named("arrow.turn.up.right");
    recSym.applyFont(Font.systemFont(9));
    const recSymImg = recRow.addImage(recSym.image);
    recSymImg.imageSize = new Size(11, 11);
    recSymImg.tintColor = C.accent;
    recRow.addSpacer(5);

    const recTxt = recRow.addText(`${C_LOTS[best.zone_id]}  —  ${best.vacant} open  (${bp}%)`);
    recTxt.textColor = C.text;
    recTxt.font = Font.boldSystemFont(10);
  }

  return w;
}

// ── Run ──────────────────────────────────────────────
const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentLarge();
}
Script.complete();
