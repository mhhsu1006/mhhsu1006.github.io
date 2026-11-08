// Build ../index.html from index.src.html and ../assets/data/results.json.
//   cd tools && npm install && node build.mjs            # preview build (warnings for TODO)
//   STRICT=1 node build.mjs                               # delivery build (TODO / template data = error)
//   SITE_URL="https://<user>.github.io/<repo>/" node build.mjs   # absolute social-preview links
// Only this file and index.src.html are project-specific; lib/ is shared.
import { loadPage, finish, embedJSON, esc, f1, minus } from "./lib/core.mjs";
import { both, hbars } from "./lib/charts.mjs";

const CONFIG = {
  PAPER_URL: "https://arxiv.org/abs/2611.04480",
  PDF_URL: "https://arxiv.org/pdf/2611.04480",
  VIDEO: "relisten",          // assets/video/<VIDEO>.mp4 and <VIDEO>.en.vtt
  // [file in assets/img, alt text, height in px]; files that do not exist are skipped
  LOGOS: [
    ["cuhk-shenzhen.png", "The Chinese University of Hong Kong, Shenzhen", 40],
    ["microsoft.png", "Microsoft", 26],
  ],
};

const page = loadPage(import.meta.url);
const D = page.data;

// ---------------------------------------------------------------- helpers
const scale = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
const textW = (s, px = 13) => String(s).length * px * 0.56;
const open = (W, H, cls) => `<svg viewBox="0 0 ${W} ${H.toFixed(0)}" class="chart ${cls}" aria-hidden="true">`;
const P = (n) => n.toFixed(1);
const mmss = (m) => { const t = Math.round(m * 60); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
// window i of a scan: start 10 i s, centre 10 i + 10 s (20 s windows every 10 s)
const centre = (sc, i) => (i * sc.hop + sc.win / 2) / 60;
const start = (sc, i) => (i * sc.hop) / 60;
// drawn check and cross, same size and baseline (no font glyphs)
const check = (x, y, r, cls = "mk-ok") => `<path d="M${P(x - r)} ${P(y - r * 0.05)}l${P(r * 0.7)} ${P(r * 0.7)}l${P(r * 1.3)} ${P(-r * 1.5)}" class="${cls}"/>`;
const cross = (x, y, r, cls = "mk-no") => `<path d="M${P(x - r * 0.8)} ${P(y - r * 0.8)}l${P(r * 1.6)} ${P(r * 1.6)}M${P(x + r * 0.8)} ${P(y - r * 0.8)}l${P(-r * 1.6)} ${P(r * 1.6)}" class="${cls}"/>`;

// legend that wraps into centred rows no wider than W; returns { svg, h }
function legendRows(items, W, y0, px = 13) {
  const parts = items.map((it) => ({ ...it, w: 18 + 6 + textW(it.name, px) + 16 }));
  const rows = [[]]; let w = 0;
  for (const p of parts) { if (w + p.w - 16 > W && rows.at(-1).length) { rows.push([]); w = 0; } rows.at(-1).push(p); w += p.w; }
  let s = "";
  rows.forEach((row, r) => {
    const tot = row.reduce((a, p) => a + p.w, 0) - 16;
    let x = (W - tot) / 2; const y = y0 + r * 22;
    for (const p of row) {
      s += p.kind === "dot" ? p.mark(x + 9, y - 4) : `<rect x="${P(x + 3)}" y="${y - 10}" width="12" height="12" class="${p.cls}"/>`;
      s += `<text x="${P(x + 24)}" y="${y}" class="lab-t sm">${esc(p.name)}</text>`;
      x += p.w;
    }
  });
  return { svg: s, h: rows.length * 22 };
}

// ---------------------------------------------------------------- grouped bars with a wrapping legend
// o = { groups: [..], series: [{ name, short, cls, values, ours }], domain, ticks }
function gbars(W, o, cls) {
  const narrow = W < 500, nS = o.series.length, ph = narrow ? 170 : 210;
  const [d0, d1] = o.domain || [0, 100], ticks = o.ticks || [0, 25, 50, 75, 100];
  const items = o.series.map((s) => ({ name: narrow && s.short ? s.short : s.name, cls: s.cls }));
  const lg = legendRows(items, W, 16);
  const top = lg.h + 22, left = 34, right = W - 4, base = top + ph;
  const Y = scale(d0, d1, base, top);
  const H = base + (narrow ? 48 : 40);
  let s = open(W, H, cls) + lg.svg;
  for (const v of ticks) s += `<line x1="${left}" x2="${right}" y1="${P(Y(v))}" y2="${P(Y(v))}" class="${v === d0 ? "axis" : "grid"}"/><text x="${left - 6}" y="${P(Y(v) + 4)}" text-anchor="end" class="tick-t">${minus(v)}</text>`;
  const gw = (right - left) / o.groups.length;
  const bw = Math.min(nS <= 2 ? (narrow ? 34 : 56) : (narrow ? 22 : 36), (gw * 0.8 - (nS - 1) * 3) / nS);
  const room = bw + 3 >= textW("88.5", 12) + 2;
  o.groups.forEach((g, gi) => {
    const cx = left + gw * (gi + 0.5), x0 = cx - (nS * bw + (nS - 1) * 3) / 2;
    o.series.forEach((se, si) => {
      const v = se.values[gi], x = x0 + si * (bw + 3);
      s += `<rect x="${P(x)}" y="${P(Y(v))}" width="${P(bw)}" height="${P(base - Y(v))}" class="${se.cls}"/>`;
      if (room || se.ours) s += `<text x="${P(x + bw / 2)}" y="${P(Y(v) - 6)}" text-anchor="middle" class="val-t sm${se.ours ? " ours" : ""}">${f1(v)}</text>`;
    });
    // group label, split in two on phones at the space nearest the middle
    let lines = [g];
    if (narrow && g.length > 12 && g.includes(" ")) {
      const cuts = [...g.matchAll(/ /g)].map((m) => m.index);
      const k = cuts.reduce((a, b) => (Math.abs(b - g.length / 2) < Math.abs(a - g.length / 2) ? b : a));
      lines = [g.slice(0, k).replace(/,$/, ""), g.slice(k + 1)];
    }
    lines.forEach((l, j) => (s += `<text x="${P(cx)}" y="${base + 20 + j * 15}" text-anchor="middle" class="lab-t sm b">${esc(l)}</text>`));
  });
  return s + "</svg>";
}

// ---------------------------------------------------------------- Figure 1: the scan of one recording, with a zoom
function scanZoom(W, sc, cls) {
  const narrow = W < 500, left = narrow ? 30 : 40, right = W - 6;
  const yd = [-3.4, 3.8], z = [26 + 40 / 60, 31 + 20 / 60];
  // row 1: whole recording
  const r1t = 30, r1h = narrow ? 84 : 104;
  const X1 = scale(0, sc.minutes, left, right), Y1 = scale(yd[0], yd[1], r1t + r1h, r1t);
  let s = "";
  s += `<text x="${left}" y="14" class="panel-t">Scan of the whole recording</text>`;
  if (!narrow) s += `<text x="${right}" y="14" text-anchor="end" class="note-t">score of every 20 s window, one forward pass each</text>`;
  s += `<rect x="${P(X1(z[0]))}" y="${r1t - 4}" width="${P(X1(z[1]) - X1(z[0]))}" height="${r1h + 8}" class="zoom-band"/>`;
  for (const v of [-2, 0, 2]) s += `<line x1="${left}" x2="${right}" y1="${P(Y1(v))}" y2="${P(Y1(v))}" class="${v === 0 ? "grid zero dot" : "grid"}"/><text x="${left - 6}" y="${P(Y1(v) + 4)}" text-anchor="end" class="tick-t">${minus(v)}</text>`;
  s += `<polyline points="${sc.s.map((v, i) => `${P(X1(centre(sc, i)))},${P(Y1(v))}`).join(" ")}" class="scan-ln"/>`;
  for (const i of sc.top) s += `<circle cx="${P(X1(centre(sc, i)))}" cy="${P(Y1(sc.s[i]))}" r="${narrow ? 2.8 : 3.4}" class="pick"/>`;
  const xt = narrow ? [0, 20, 40, 60, 80] : [0, 10, 20, 30, 40, 50, 60, 70, 80];
  for (const v of xt) s += `<text x="${P(X1(v))}" y="${r1t + r1h + 18}" text-anchor="middle" class="tick-t">${v}${v === 80 ? " min" : ""}</text>`;
  // connector to the zoom
  const r2t = r1t + r1h + (narrow ? 84 : 92), r2h = narrow ? 92 : 108;
  s += `<path d="M${P(X1(z[0]))} ${r1t + r1h + 24}L${left} ${r2t - 46}H${right}L${P(X1(z[1]))} ${r1t + r1h + 24}Z" class="zoom-cone"/>`;
  // row 2: zoom 26:40-31:20, one stem per window
  const X2 = scale(z[0], z[1], left, right), Y2 = scale(yd[0], yd[1], r2t + r2h, r2t);
  s += `<text x="${left}" y="${r2t - 28}" class="panel-t">The three best windows</text>`;
  if (!narrow) s += `<text x="${right}" y="${r2t - 28}" text-anchor="end" class="note-t">non-overlapping, 60 s in total</text>`;
  for (const i of sc.top) {
    const a = start(sc, i);
    s += `<rect x="${P(X2(a))}" y="${r2t - 4}" width="${P(X2(a + sc.win / 60) - X2(a))}" height="${r2h + 8}" class="pick-span"/>`;
  }
  // annotated evidence bracket
  const [e0, e1] = sc.evidence, ey = r2t - 10;
  s += `<path d="M${P(X2(e0))} ${ey + 5}V${ey}H${P(X2(e1))}V${ey + 5}" class="ev-br"/>`;
  s += `<text x="${P(X2(e1) + 6)}" y="${ey + 4}" class="note-t">annotated evidence</text>`;
  s += `<line x1="${left}" x2="${right}" y1="${P(Y2(0))}" y2="${P(Y2(0))}" class="grid zero"/>`;
  const sel = new Set(sc.top);
  sc.s.forEach((v, i) => {
    const t = centre(sc, i);
    if (t < z[0] - 1e-6 || t > z[1] + 1e-6) return;
    const on = sel.has(i);
    s += `<line x1="${P(X2(t))}" x2="${P(X2(t))}" y1="${P(Y2(0))}" y2="${P(Y2(v))}" class="${on ? "stem-on" : "stem-off"}"/>`;
    s += `<circle cx="${P(X2(t))}" cy="${P(Y2(v))}" r="${on ? (narrow ? 3.6 : 4.4) : (narrow ? 2.4 : 3)}" class="${on ? "pick" : "dot-off"}"/>`;
  });
  if (narrow) {
    const a = start(sc, sc.top[0]), b = start(sc, sc.top.at(-1)) + sc.win / 60;
    s += `<text x="${P((X2(a) + X2(b)) / 2)}" y="${r2t + r2h + 22}" text-anchor="middle" class="val-t ours sm">${mmss(a)}–${mmss(b)}</text>`;
  } else for (const i of sc.top) s += `<text x="${P(X2(start(sc, i) + sc.win / 120))}" y="${r2t + r2h + 22}" text-anchor="middle" class="val-t ours">${mmss(start(sc, i))}</text>`;
  for (const v of [27, 30, 31]) s += `<text x="${P(X2(v))}" y="${r2t + r2h + 22}" text-anchor="middle" class="tick-t">${mmss(v)}</text>`;
  // row 3: the answers
  const r3 = r2t + r2h + (narrow ? 58 : 60);
  let H;
  if (narrow) {
    s += `<text x="${W / 2 - 8}" y="${r3}" text-anchor="middle" class="lab-t sm">answer from these 60 s: <tspan class="b">${sc.answer}</tspan></text>` + check(W / 2 + 86, r3 - 4.5, 5);
    s += `<text x="${W / 2 - 8}" y="${r3 + 22}" text-anchor="middle" class="lab-t sm muted">from three evenly spaced windows: ${sc.uniform_answer}</text>` + cross(W / 2 + 121, r3 + 17.5, 4.2);
    H = r3 + 32;
  } else {
    s += `<text x="${W / 2 - 170}" y="${r3}" text-anchor="middle" class="lab-t">answer from these 60 s: <tspan class="b">${sc.answer}</tspan></text>` + check(W / 2 - 68, r3 - 5, 5.5);
    s += `<text x="${W / 2 + 140}" y="${r3}" text-anchor="middle" class="lab-t muted">from three evenly spaced windows: ${sc.uniform_answer}</text>` + cross(W / 2 + 278, r3 - 5, 4.6);
    H = r3 + 12;
  }
  return open(W, H, cls) + s + "</svg>";
}

// ---------------------------------------------------------------- whole-recording scan (switcher views)
function scanFull(W, sc, cls) {
  const narrow = W < 500, left = narrow ? 30 : 44, right = W - 8;
  const lo = Math.min(...sc.s), hi = Math.max(...sc.s);
  const yd = [Math.floor(lo) - 0.6, Math.ceil(hi) + 0.8];
  const step = yd[1] - yd[0] > 10 ? 4 : 2;
  const top = 26, ph = narrow ? 120 : 170;
  const X = scale(0, sc.minutes, left, right), Y = scale(yd[0], yd[1], top + ph, top);
  let s = "";
  const [e0, e1] = sc.evidence, w0 = X(e1) - X(e0), ew = Math.max(3, w0), ex = X(e0) - (ew - w0) / 2;
  s += `<rect x="${P(ex)}" y="${top}" width="${P(ew)}" height="${ph}" class="ev-band"/>`;
  s += `<text x="${P(ex + ew / 2)}" y="${top - 8}" text-anchor="middle" class="note-t">annotated evidence</text>`;
  for (let v = Math.ceil(yd[0] / step) * step; v <= yd[1]; v += step) s += `<line x1="${left}" x2="${right}" y1="${P(Y(v))}" y2="${P(Y(v))}" class="${v === 0 ? "grid zero dot" : "grid"}"/><text x="${left - 6}" y="${P(Y(v) + 4)}" text-anchor="end" class="tick-t">${minus(v)}</text>`;
  s += `<polyline points="${sc.s.map((v, i) => `${P(X(centre(sc, i)))},${P(Y(v))}`).join(" ")}" class="scan-ln"/>`;
  for (const i of sc.top) s += `<circle cx="${P(X(centre(sc, i)))}" cy="${P(Y(sc.s[i]))}" r="${narrow ? 4.5 : 6}" class="pick-ring"/>`;
  const xt = narrow ? [0, 20, 40, 60, 80] : [0, 10, 20, 30, 40, 50, 60, 70, 80];
  for (const v of xt) if (v <= sc.minutes) s += `<text x="${P(X(v))}" y="${top + ph + 18}" text-anchor="middle" class="tick-t">${v}</text>`;
  s += `<text x="${(left + right) / 2}" y="${top + ph + 38}" text-anchor="middle" class="note-t">time in the recording (min)</text>`;
  return open(W, top + ph + 46, cls) + s + "</svg>";
}

// ---------------------------------------------------------------- accuracy against seconds per question (log x)
function costScatter(W, o, cls) {
  const narrow = W < 500, left = 38, right = W - (narrow ? 10 : 20);
  const mk = {
    ours1: (x, y, r = 6) => `<circle cx="${P(x)}" cy="${P(y)}" r="${r}" class="pt-ours"/>`,
    ours4: (x, y, r = 6) => `<circle cx="${P(x)}" cy="${P(y)}" r="${r - 0.8}" class="pt-ours-open"/>`,
    fast1: (x, y, r = 6) => `<path d="M${P(x)} ${P(y - r - 1)}l${r + 1} ${r + 1}l${-r - 1} ${r + 1}l${-r - 1} ${-r - 1}Z" class="pt-ours"/>`,
    fast4: (x, y, r = 6) => `<path d="M${P(x)} ${P(y - r)}l${r} ${r}l${-r} ${r}l${-r} ${-r}Z" class="pt-ours-open"/>`,
    text: (x, y, r = 6) => `<path d="M${P(x)} ${P(y - r - 1)}l${r + 1} ${P((r + 1) * 1.6)}h${-2 * (r + 1)}Z" class="pt-base"/>`,
    full: (x, y, r = 6) => `<rect x="${P(x - r + 0.5)}" y="${P(y - r + 0.5)}" width="${2 * r - 1}" height="${2 * r - 1}" class="pt-base"/>`,
  };
  const items = [
    { name: "ReListen", kind: "dot", mark: (x, y) => mk.ours1(x, y, 5) },
    { name: "ReListen-Fast", kind: "dot", mark: (x, y) => mk.fast1(x, y, 4.5) },
    { name: "four GPUs", kind: "dot", mark: (x, y) => mk.ours4(x, y, 5) },
    { name: "text-mediated", kind: "dot", mark: (x, y) => mk.text(x, y - 2, 4.5) },
    { name: "full recording", kind: "dot", mark: (x, y) => mk.full(x, y, 5) },
  ];
  const lg = legendRows(items, W, 16);
  const top = lg.h + 34, ph = narrow ? 210 : 260;
  const lx = (v) => Math.log10(v);
  const X = scale(lx(2), lx(2000), left, right), Y = scale(49, 64, top + ph, top);
  let s = open(W, top + ph + 48, cls) + lg.svg;
  for (const v of [50, 54, 58, 62]) s += `<line x1="${left}" x2="${right}" y1="${P(Y(v))}" y2="${P(Y(v))}" class="grid"/><text x="${left - 6}" y="${P(Y(v) + 4)}" text-anchor="end" class="tick-t">${v}</text>`;
  for (const v of [10, 100, 1000]) s += `<line x1="${P(X(lx(v)))}" x2="${P(X(lx(v)))}" y1="${top}" y2="${top + ph}" class="grid"/><text x="${P(X(lx(v)))}" y="${top + ph + 18}" text-anchor="middle" class="tick-t">${v.toLocaleString("en-US")}</text>`;
  s += `<text x="${(left + right) / 2}" y="${top + ph + 40}" text-anchor="middle" class="note-t">seconds per question (log scale)</text>`;
  s += `<text x="${left - 32}" y="${top - 10}" class="note-t">accuracy (%)</text>`;
  const pos = {
    "Reader transcript": narrow ? [0, -14, "middle"] : [0, 22, "middle"], "Echo-style": [0, -14, "middle"], "Speaker-Reasoner": [narrow ? 4 : 0, -14, narrow ? "end" : "middle"],
    "Full recording": [12, 5, "start"],
  };
  for (const p of o.points) {
    const x = X(lx(p.s)), y = Y(p.acc);
    const k = p.kind === "ours" ? (p.gpus === 4 ? "ours4" : "ours1") : p.kind === "fast" ? (p.gpus === 4 ? "fast4" : "fast1") : p.kind;
    s += mk[k](x, y, narrow ? 5 : 6);
    const lp = pos[p.label];
    if (lp) s += `<text x="${P(x + lp[0])}" y="${P(y + lp[1])}" text-anchor="${lp[2]}" class="lab-t sm">${esc(p.label)}</text>`;
  }
  // one label above the two ReListen points and one below the two ReListen-Fast points
  const pick = (kind, g) => o.points.find((p) => p.kind === kind && p.gpus === g);
  const r1 = pick("ours", 1), r4 = pick("ours", 4), q1 = pick("fast", 1), q4 = pick("fast", 4);
  s += `<text x="${P((X(lx(r1.s)) + X(lx(r4.s))) / 2)}" y="${P(Y(r1.acc) - 14)}" text-anchor="middle" class="lab-t sm ours">ReListen</text>`;
  s += `<text x="${P((X(lx(q1.s)) + X(lx(q4.s))) / 2)}" y="${P(Y(q1.acc) + 24)}" text-anchor="middle" class="lab-t sm ours">ReListen-Fast</text>`;
  return s + "</svg>";
}

// ---------------------------------------------------------------- tables with section rows
const ck = '<span class="ck" aria-label="yes">✓</span>', no = '<span class="no" aria-label="no">–</span>', na = '<span class="na">–</span>';
const tcell = (v) => (v === null || v === undefined ? na : v === true ? ck : v === false ? no : typeof v === "number" ? f1(v) : esc(v));
function table(cols, rows) {
  const th = (c, i) => (c === "Training" ? ' class="c"' : i ? ' class="num"' : "");
  let t = '<table class="results"><thead><tr>' + cols.map((c, i) => `<th${th(c, i)}>${esc(c)}</th>`).join("") + "</tr></thead><tbody>";
  for (const r of rows) {
    if (r.sec) { t += `<tr class="sec"><th colspan="${cols.length}" scope="colgroup">${esc(r.sec)}</th></tr>`; continue; }
    t += `<tr${r.ours ? ' class="ours"' : ""}><th scope="row">${esc(r.cells[0])}${r.note ? `<sup>${r.note}</sup>` : ""}</th>`;
    r.cells.slice(1).forEach((v, i) => (t += cols[i + 1] === "Training" ? `<td class="c">${tcell(v)}</td>` : `<td class="num">${tcell(v)}</td>`));
    t += "</tr>";
  }
  return t + "</tbody></table>";
}

// ---------------------------------------------------------------- Figure 2: method diagram (desktop and phone)
// The waveform is illustrative. The score curve is the real scan of Figure 1, downsampled.
function wave(x0, x1, yc, amp, step = 2.2, seed = 7) {
  let s = "", r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let x = x0; x <= x1; x += step) {
    const env = 0.45 + 0.35 * Math.sin(x / 23) * Math.sin(x / 7.3) + 0.2 * rnd();
    const h = Math.max(1.2, amp * Math.abs(env));
    s += `M${P(x)} ${P(yc - h)}V${P(yc + h)}`;
  }
  return `<path d="${s}" class="dg-wave"/>`;
}
function miniCurve(x0, x1, y0, y1, sc, every = 3) {
  const lo = -3.4, hi = 3.8, X = scale(0, sc.minutes, x0, x1), Y = scale(lo, hi, y1, y0);
  const pts = sc.s.filter((_, i) => i % every === 0 || sc.top.includes(i)).map((v, k, a) => v);
  const idx = sc.s.map((_, i) => i).filter((i) => i % every === 0 || sc.top.includes(i));
  let s = `<line x1="${x0}" x2="${x1}" y1="${P(Y(0))}" y2="${P(Y(0))}" class="grid zero dot"/>`;
  s += `<polyline points="${idx.map((i) => `${P(X(centre(sc, i)))},${P(Y(sc.s[i]))}`).join(" ")}" class="dg-curve"/>`;
  s += `<circle cx="${P(X(centre(sc, sc.top[1])))}" cy="${P(Y(sc.s[sc.top[1]]))}" r="3.6" class="pick"/>`;
  return s;
}
function methodDiagram(sc) {
  const ah = (id, accent) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="${accent ? "#4f74b8" : "#97a1b1"}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker>`;
  const step = (x, y, n, t) => `<circle cx="${x + 8}" cy="${y - 4}" r="8" class="dg-num"/><text x="${x + 8}" y="${y}" text-anchor="middle" class="dg-num-t">${n}</text><text x="${x + 22}" y="${y}" class="dg-step">${t}</text>`;
  const chips = (x, y, w, h, gap, labels) => labels.map((l, k) => `<rect x="${x + k * (w + gap)}" y="${y}" width="${w}" height="${h}" rx="4" class="dg-token-accent"/>${wave(x + k * (w + gap) + 5, x + k * (w + gap) + w - 5, y + h / 2, h * 0.3, 2.2, 11 + k)}<text x="${x + k * (w + gap) + w / 2}" y="${y + h + 16}" text-anchor="middle" class="dg-time">${l}</text>`).join("");
  const times = sc.top.map((i) => mmss(start(sc, i)));
  // desktop, 1080 x 290
  let d = `<svg class="diagram diagram-desktop" viewBox="0 0 1080 290" role="img" aria-labelledby="dg-title"><title id="dg-title">The recording is cut into 20-second windows. A frozen reader scores each window by the log-odds that it helps answer the question. The three best windows, 60 seconds with their times, go back to the same frozen reader, which answers.</title><defs>${ah("dg-ah")}${ah("dg-ah-b", true)}</defs>`;
  // question route to both readers
  d += `<rect x="10" y="20" width="96" height="28" rx="14" class="dg-node"/><text x="58" y="39" text-anchor="middle" class="dg-label">question</text>`;
  d += `<path d="M106 34H900V100" class="dg-route" marker-end="url(#dg-ah)"/><path d="M285 34V104" class="dg-route" marker-end="url(#dg-ah)"/>`;
  // 1 recording
  d += `<text x="10" y="94" class="dg-label">hour-long recording</text>`;
  d += wave(12, 172, 138, 15);
  for (let k = 0; k < 7; k++) { const x = 12 + k * 22; d += `<path d="M${x} ${166 + (k % 2) * 7}h40" class="dg-win${k === 3 ? " on" : ""}"/>`; }
  d += `<text x="10" y="200" class="dg-note">20 s windows every 10 s</text>`;
  d += `<path d="M180 138H206" class="dg-route" marker-end="url(#dg-ah)"/>`;
  // 2 frozen reader, scan
  d += `<rect x="210" y="108" width="150" height="60" rx="10" class="dg-node"/><text x="285" y="135" text-anchor="middle" class="dg-label">Frozen reader</text><text x="285" y="154" text-anchor="middle" class="dg-note">one pass per window</text>`;
  d += `<text x="285" y="192" text-anchor="middle" class="dg-q">“Does this audio excerpt contain</text><text x="285" y="208" text-anchor="middle" class="dg-q">information that helps answer</text><text x="285" y="224" text-anchor="middle" class="dg-q">the question? Answer yes or no.”</text>`;
  d += `<path d="M364 138H400" class="dg-route dg-route-accent" marker-end="url(#dg-ah-b)"/>`;
  // 3 score of every window
  d += `<rect x="404" y="92" width="226" height="96" rx="10" class="dg-node dg-node-accent"/>`;
  d += `<text x="517" y="113" text-anchor="middle" class="dg-label">score of every window</text>`;
  d += miniCurve(418, 616, 122, 176, sc);
  d += `<text x="517" y="212" text-anchor="middle" class="dg-formula"><tspan font-style="italic">ℓ</tspan><tspan font-style="italic" font-size="10" dy="3">i</tspan><tspan dy="-3"> = log </tspan><tspan font-style="italic">p</tspan><tspan>(yes) − log </tspan><tspan font-style="italic">p</tspan><tspan>(no)</tspan></text>`;
  d += `<path d="M634 138H664" class="dg-route dg-route-accent" marker-end="url(#dg-ah-b)"/>`;
  // 4 select
  d += `<text x="740" y="113" text-anchor="middle" class="dg-label">best three windows</text>`;
  d += chips(668, 124, 44, 28, 6, times);
  d += `<text x="740" y="200" text-anchor="middle" class="dg-note">60 s, with time labels</text>`;
  d += `<path d="M818 138H836" class="dg-route dg-route-accent" marker-end="url(#dg-ah-b)"/>`;
  // 5 listen again
  d += `<rect x="840" y="108" width="140" height="60" rx="10" class="dg-node"/><text x="910" y="135" text-anchor="middle" class="dg-label">Frozen reader</text><text x="910" y="154" text-anchor="middle" class="dg-note">the same model</text>`;
  d += `<path d="M984 138H1010" class="dg-route" marker-end="url(#dg-ah)"/><text x="1016" y="143" class="dg-label">answer</text>`;
  d += step(350, 262, 1, "Score every window") + step(660, 262, 2, "Select") + step(840, 262, 3, "Listen again");
  d += `</svg>`;
  // phone, 420 x 640
  let m = `<svg class="diagram diagram-mobile" viewBox="0 0 420 640" role="img" aria-labelledby="dg-title-m"><title id="dg-title-m">The recording is cut into 20-second windows. A frozen reader scores each window. The three best windows go back to the same frozen reader, which answers.</title><defs>${ah("dg-ah-m")}${ah("dg-ah-mb", true)}</defs>`;
  m += `<text x="20" y="22" class="dg-label">hour-long recording</text>` + wave(20, 400, 52, 15, 2.6);
  for (let k = 0; k < 15; k++) { const x = 20 + k * 24; m += `<path d="M${x} ${80 + (k % 2) * 7}h44" class="dg-win${k === 7 ? " on" : ""}"/>`; }
  m += `<text x="20" y="112" class="dg-note">20 s windows every 10 s</text>`;
  m += `<path d="M210 118V140" class="dg-route" marker-end="url(#dg-ah-m)"/>`;
  m += `<rect x="110" y="144" width="200" height="58" rx="10" class="dg-node"/><text x="210" y="170" text-anchor="middle" class="dg-label">Frozen reader</text><text x="210" y="189" text-anchor="middle" class="dg-note">one pass per window</text>`;
  m += `<rect x="330" y="160" width="80" height="26" rx="13" class="dg-node"/><text x="370" y="177" text-anchor="middle" class="dg-note">question</text><path d="M330 173H314" class="dg-route" marker-end="url(#dg-ah-m)"/>`;
  m += `<text x="210" y="222" text-anchor="middle" class="dg-q">“Does this audio excerpt contain information</text><text x="210" y="238" text-anchor="middle" class="dg-q">that helps answer the question? Yes or no.”</text>`;
  m += `<path d="M210 246V266" class="dg-route dg-route-accent" marker-end="url(#dg-ah-mb)"/>`;
  m += `<rect x="40" y="270" width="340" height="108" rx="10" class="dg-node dg-node-accent"/><text x="210" y="292" text-anchor="middle" class="dg-label">score of every window</text>`;
  m += miniCurve(56, 364, 302, 350, sc);
  m += `<text x="210" y="370" text-anchor="middle" class="dg-formula"><tspan font-style="italic">ℓ</tspan><tspan font-style="italic" font-size="10" dy="3">i</tspan><tspan dy="-3"> = log </tspan><tspan font-style="italic">p</tspan><tspan>(yes) − log </tspan><tspan font-style="italic">p</tspan><tspan>(no)</tspan></text>`;
  m += `<path d="M210 382V402" class="dg-route dg-route-accent" marker-end="url(#dg-ah-mb)"/>`;
  m += `<text x="210" y="420" text-anchor="middle" class="dg-label">best three windows</text>` + chips(130, 430, 50, 28, 10, times);
  m += `<text x="210" y="494" text-anchor="middle" class="dg-note">60 s, with time labels</text>`;
  m += `<path d="M210 502V522" class="dg-route dg-route-accent" marker-end="url(#dg-ah-mb)"/>`;
  m += `<rect x="110" y="526" width="200" height="58" rx="10" class="dg-node"/><text x="210" y="552" text-anchor="middle" class="dg-label">Frozen reader</text><text x="210" y="571" text-anchor="middle" class="dg-note">the same model</text>`;
  m += `<path d="M210 588V608" class="dg-route" marker-end="url(#dg-ah-m)"/><text x="210" y="630" text-anchor="middle" class="dg-label">answer</text>`;
  m += `</svg>`;
  return d + m;
}

// ---------------------------------------------------------------- fill the page
page.fill("FIG1", both(scanZoom, D.scan_pizza, 860, 358));
page.fill("METHOD", methodDiagram(D.scan_pizza));

const grays = ["g1", "g2", "g3", "g4"];
const short = { "Learned audio retriever": "Learned", "BM25 on transcript": "BM25", "BGE-M3 on transcript": "BGE-M3" };
page.fill("FIG_HIT", both(gbars, {
  groups: D.hit.groups, domain: [0, 100], ticks: [0, 25, 50, 75, 100],
  series: D.hit.series.map((s, i) => ({ ...s, cls: s.ours ? "s1" : grays[i], short: short[s.name] })),
}, 1032, 358));

const vgRow = (l) => D.vg.rows.find((r) => r.label === l);
const vgSeries = [["Uniform excerpts", "Uniform", "g1"], ["Full recording", "Full", "g2"], ["Reader transcript", "Transcript", "g3"], ["Echo-style", "Echo-style", "g4"], ["ReListen", "ReListen", "s1"]];
page.fill("FIG_VG", both(gbars, {
  groups: ["All questions", "Sounds and voices", "Content"], domain: [0, 80], ticks: [0, 20, 40, 60, 80],
  series: vgSeries.map(([l, sh, c]) => { const r = vgRow(l); return { name: l, short: sh, cls: c, ours: c === "s1", values: [r.all, r.sound, r.content] }; }),
}, 1032, 358));

const secRows = (rows, cells) => { const out = []; let g = null; for (const r of rows) { if (r.group !== g) { out.push({ sec: r.group }); g = r.group; } out.push({ cells: cells(r), ours: r.ours }); } return out; };
page.fill("TABLE_VG", table(["Method", "Training", "All", "Sound", "Content"],
  secRows(D.vg.rows, (r) => [r.label, r.trained, r.all, r.sound, r.content])));

page.fill("TABLE_LAT", table(["Method", "Training", "mIoU", "R@0.3"],
  D.latbench.rows.map((r) => ({ cells: [r.label, r.trained, r.miou, r.r3], ours: r.ours, note: r.reported ? "†" : "" }))));

page.fill("FIG_COST", both(costScatter, D.cost, 860, 358));

page.fill("FIG_LISTEN", both(gbars, {
  groups: D.listen.groups, domain: [0, 80], ticks: [0, 20, 40, 60, 80],
  series: [{ name: "Read its transcript", short: "Read", cls: "g2", values: D.listen.read }, { name: "Listen to the audio", short: "Listen", cls: "s1", ours: true, values: D.listen.listen }],
}, 860, 358));

page.fill("SCAN_PIZZA", both(scanFull, D.scan_pizza, 1000, 312));
page.fill("SCAN_LENS", both(scanFull, D.scan_lens, 1000, 312));

page.fill("FIG_CHAINS", hbars({
  domain: [0, 70], ticks: [0, 20, 40, 60], ref: { value: D.chains.random, label: "random guessing" },
  rows: D.chains.rows.map((r) => ({ label: r.label, value: r.value, kind: r.ours ? "ours" : "base" })),
}));

page.fill("PAGE_DATA", embedJSON("page-data", {}));

finish(page, CONFIG);
