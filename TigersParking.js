// Tigers Parking — Scriptable Widget
// Large widget · Commuter lots · iPhone

const API_URL = "https://www.tigerscommute.com/api/ElevenX/ZonesOccupancyStatus";
const CACHE_KEY = "tigers_parking_history";
const MAX_HISTORY = 288;
const DEFAULT_CHART_LOT_ID = 4; // C-03 fallback when no lots are loaded

const C_LOTS = {
  2:   "C-01",
  4:   "C-03",
  5:   "C-07",
  6:   "C-09",
  7:   "C-11",
  25:  "C-15",
  56:  "C-01 Ext",
  57:  "C-04",
  87:  "P-05",
  198: "P-04",
  202: "P-06",
  203: "P-07",
  204: "P-08",
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

// ── Cache ────────────────────────────────────────────
function loadHistory() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), CACHE_KEY + ".json");
  if (!fm.fileExists(path)) return [];
  try { return JSON.parse(fm.readString(path)); }
  catch { return []; }
}

function saveHistory(history) {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), CACHE_KEY + ".json");
  fm.writeString(path, JSON.stringify(history));
}

function appendSnapshot(data) {
  const history = loadHistory();
  const snap = { ts: Date.now(), lots: {} };
  data.forEach(z => {
    if (C_LOTS[z.zone_id] && z.subzone_id === null)
      snap.lots[z.zone_id] = { o: z.occupied, v: z.vacant };
  });
  history.push(snap);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  saveHistory(history);
  return history;
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

// ── Sparkline ────────────────────────────────────────
function drawChart(history, zoneId, w, h) {
  const points = history
    .filter(s => s.lots && s.lots[zoneId])
    .slice(-48)
    .map(s => { const d = s.lots[zoneId]; return pct(d.o, d.v); });

  if (points.length < 2) return null;

  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const pad = { t: 6, r: 6, b: 16, l: 26 };
  const cW = w - pad.l - pad.r;
  const cH = h - pad.t - pad.b;

  // Grid lines
  [25, 50, 75, 100].forEach(v => {
    const y = pad.t + cH - (v / 100 * cH);
    const path = new Path();
    path.move(new Point(pad.l, y));
    path.addLine(new Point(pad.l + cW, y));
    ctx.setStrokeColor(new Color("#2c2c2c"));
    ctx.setLineWidth(0.5);
    ctx.addPath(path);
    ctx.strokePath();
    ctx.setTextColor(new Color("#444444"));
    ctx.setFont(Font.systemFont(7));
    ctx.drawTextInRect(String(v), new Rect(0, y - 5, 24, 10));
  });

  const gX = i => pad.l + (i / (points.length - 1)) * cW;
  const gY = p => pad.t + cH - (p / 100 * cH);

  // Fill
  const fillPath = new Path();
  fillPath.move(new Point(gX(0), gY(points[0])));
  points.forEach((p, i) => { if (i > 0) fillPath.addLine(new Point(gX(i), gY(p))); });
  fillPath.addLine(new Point(gX(points.length - 1), pad.t + cH));
  fillPath.addLine(new Point(gX(0), pad.t + cH));
  fillPath.closeSubpath();
  ctx.setFillColor(new Color("#c96a2a", 0.15));
  ctx.addPath(fillPath);
  ctx.fillPath();

  // Line
  const linePath = new Path();
  linePath.move(new Point(gX(0), gY(points[0])));
  points.forEach((p, i) => { if (i > 0) linePath.addLine(new Point(gX(i), gY(p))); });
  ctx.setStrokeColor(new Color("#c96a2a"));
  ctx.setLineWidth(1.5);
  ctx.addPath(linePath);
  ctx.strokePath();

  // End dot
  const lx = gX(points.length - 1);
  const ly = gY(points[points.length - 1]);
  const dotPath = new Path();
  dotPath.addEllipse(new Rect(lx - 3, ly - 3, 6, 6));
  ctx.setFillColor(new Color("#c96a2a"));
  ctx.addPath(dotPath);
  ctx.fillPath();

  // Time labels
  const snaps = history.filter(s => s.lots && s.lots[zoneId]).slice(-48);
  ctx.setFont(Font.systemFont(7));
  ctx.setTextColor(new Color("#444444"));
  if (snaps.length > 0) {
    ctx.drawTextInRect(fmtTime(new Date(snaps[0].ts)), new Rect(pad.l, h - 13, 36, 12));
    ctx.drawTextInRect(fmtTime(new Date(snaps[snaps.length - 1].ts)), new Rect(w - 34, h - 13, 36, 12));
  }

  return ctx.getImage();
}

// ── Widget ───────────────────────────────────────────
async function buildWidget() {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 12, 14);
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

  let data, history, offline = false;

  try {
    data    = await fetchParking();
    history = appendSnapshot(data);
  } catch {
    offline = true;
    history = loadHistory();
    data    = history.length
      ? Object.entries(history[history.length - 1].lots).map(([id, d]) => ({
          zone_id: parseInt(id), subzone_id: null, occupied: d.o, vacant: d.v
        }))
      : [];
  }

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

  const ptsTxt = timeCol.addText(`${history.length} pts`);
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

  const chartLblTxt = chartHdr.addText(`${chartLotName}  ·  last 4 hrs`);
  chartLblTxt.textColor = C.dim;
  chartLblTxt.font = Font.systemFont(8);

  w.addSpacer(3);

  if (history.length >= 3) {
    const chartImg = drawChart(history, chartLotId, 268, 56);
    if (chartImg) {
      const imgEl = w.addImage(chartImg);
      imgEl.resizable = true;
      imgEl.imageSize = new Size(268, 56);
    }
  } else {
    const noChartRow = w.addStack();
    noChartRow.backgroundColor = C.surface;
    noChartRow.cornerRadius = 4;
    noChartRow.setPadding(5, 8, 5, 8);
    const noTxt = noChartRow.addText("Chart builds after a few refreshes");
    noTxt.textColor = C.dimmer;
    noTxt.font = Font.systemFont(8);
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
