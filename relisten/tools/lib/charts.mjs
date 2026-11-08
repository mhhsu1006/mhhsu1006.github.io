// Reusable charts for project pages. All output is static HTML/SVG made at build time.
//
// SVG charts take (W, options, cls) and are drawn at the width they are displayed at, so
// their text stays at the CSS size (13–14 px) instead of shrinking with the viewBox.
// Use both() to emit the desktop and the phone version; CSS shows one of them:
//
//   page.fill("FIG2", both(groupedBars, opts));          // 860 px desktop, 358 px phone
//   page.fill("FIG3", both(lineChart, opts, 1032, 358));  // full-width figure
//
// Widths that match the layout: Figure 1 beside the highlights 672; .figure.mid 860;
// .figure.wide 1032; inside a .panel 1000. Phone: 358 (390 px screen minus 2 x 16 px gutter),
// inside a .panel 312 (the panel adds its own margin and padding).
// Colours come from CSS classes s1..s5 (variables --s1..--s5 in style.css).
// Layout rules: panel titles are centred over their panel, legends sit centred in their own row,
// and adjacent small multiples keep enough gap that their end ticks do not touch.
import { esc, f1, minus } from "./core.mjs";

const poly = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const scale = (d0, d1, r0, r1) => (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
const textW = (s, px = 13) => String(s).length * px * 0.56;  // rough Inter width
const open = (W, H, cls) => `<svg viewBox="0 0 ${W} ${H}" class="chart ${cls}" aria-hidden="true">`;

export function both(fn, o, desktop = 860, mobile = 358) {
  return fn(desktop, o, "chart-desktop") + fn(mobile, o, "chart-mobile");
}

// Split a label in two on phones, at the hyphen or space nearest its middle.
export function split(s, narrow, max = 11) {
  if (!narrow || s.length <= max) return [s];
  const cut = [];
  for (let i = 1; i < s.length; i++) if (s[i - 1] === "-" || s[i] === " ") cut.push(i);
  if (!cut.length) return [s];
  const k = cut.reduce((a, b) => (Math.abs(b - s.length / 2) < Math.abs(a - s.length / 2) ? b : a));
  return [s.slice(0, k).trim(), s.slice(k).trim()];
}

// Legend row. items: [{ name, cls, kind: "bar" | "line", dash }]; returns { svg, width }.
function legend(items, x, y, align = "start") {
  const parts = items.map((it) => ({ ...it, w: 18 + 6 + textW(it.name) + 16 }));
  const total = parts.reduce((a, p) => a + p.w, 0) - 16;
  let cx = align === "end" ? x - total : x, s = "";
  for (const p of parts) {
    s += p.kind === "line"
      ? `<line x1="${cx}" x2="${cx + 18}" y1="${y - 4}" y2="${y - 4}" class="ln ${p.cls}${p.dash ? " dash" : ""}"/>`
      : `<rect x="${cx + 3}" y="${y - 10}" width="12" height="12" class="${p.cls}"/>`;
    s += `<text x="${cx + 24}" y="${y}" class="lab-t sm">${esc(p.name)}</text>`;
    cx += p.w;
  }
  return { svg: s, width: total };
}

// ------------------------------------------------------------------ grouped bars
// o = {
//   panels: [{ title, groups: [{ label, values: [..] }] }],   // one panel per benchmark
//   series: [{ name, short, cls }],                            // short: legend name on phones
//   domain: [0, 100], ticks: [0, 25, 50, 75, 100], fmt: f1, tickFmt,
//   height: 200, ours: "group label to set in the accent",
//   highlight: { panel: 1, group: 0, note: "72.7 → 59.9" },
// }
// Desktop: panels side by side. Phone: stacked. Value labels are dropped when bars get too narrow.
export function groupedBars(W, o, cls) {
  const narrow = W < 500, P = o.panels, nS = o.series.length;
  const ph = o.height || (narrow ? 170 : 200);
  const [d0, d1] = o.domain || [0, 100], ticks = o.ticks || [0, 25, 50, 75, 100];
  const fmt = o.fmt || f1, tfmt = o.tickFmt || ((v) => minus(v));
  const cols = narrow ? 1 : P.length, gapX = 40;
  const pw = (W - gapX * (cols - 1)) / cols;
  // legend centred in its own row above all panels, panel titles centred over their panel
  const items = o.series.map((s) => ({ name: narrow && s.short ? s.short : s.name, cls: s.cls, kind: "bar" }));
  const lg = 30, top = 44;
  const rowH = top + ph + (narrow ? 62 : 56);
  const H = lg + Math.ceil(P.length / cols) * rowH;
  let s = open(W, H, cls);
  const lw = legend(items, 0, 0).width;
  s += legend(items, (W - lw) / 2, 16).svg;
  P.forEach((p, pi) => {
    const ox = (pi % cols) * (pw + gapX), oy = lg + Math.floor(pi / cols) * rowH;
    const left = ox + 36, right = ox + pw - 4, base = oy + top + ph;
    const Y = scale(d0, d1, base, oy + top);
    if (p.title) s += `<text x="${(left + right) / 2}" y="${oy + 22}" text-anchor="middle" class="panel-t">${esc(p.title)}</text>`;
    for (const v of ticks) s += `<line x1="${left}" x2="${right}" y1="${Y(v)}" y2="${Y(v)}" class="${v === d0 ? "axis" : "grid"}"/><text x="${left - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick-t">${tfmt(v)}</text>`;
    const gw = (right - left) / p.groups.length;
    const bw = Math.min(narrow ? 26 : 34, (gw * 0.78 - (nS - 1) * 3) / nS);
    const showVals = bw + 3 >= textW(fmt(d1), 12) + 2;
    p.groups.forEach((g, gi) => {
      const cx = left + gw * (gi + 0.5), x0 = cx - (nS * bw + (nS - 1) * 3) / 2;
      g.values.forEach((v, si) => {
        if (v === null || v === undefined) return;
        const x = x0 + si * (bw + 3);
        s += `<rect x="${x.toFixed(1)}" y="${Y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - Y(v)).toFixed(1)}" class="${o.series[si].cls}"/>`;
        if (showVals) s += `<text x="${(x + bw / 2).toFixed(1)}" y="${(Y(v) - 6).toFixed(1)}" text-anchor="middle" class="val-t sm">${fmt(v)}</text>`;
      });
      const ours = o.ours && g.label === o.ours;
      split(g.label, narrow).forEach((l, j) => (s += `<text x="${cx.toFixed(1)}" y="${base + 20 + j * 15}" text-anchor="middle" class="lab-t sm${ours ? " ours" : ""}">${esc(l)}</text>`));
      const h = o.highlight;
      if (h && h.panel === pi && h.group === gi) {
        const top_ = Math.min(...g.values.filter((v) => v !== null).map(Y)) - (showVals ? 22 : 8);
        s += `<rect x="${(x0 - 6).toFixed(1)}" y="${top_.toFixed(1)}" width="${(nS * bw + (nS - 1) * 3 + 12).toFixed(1)}" height="${(base - top_).toFixed(1)}" rx="4" class="hl-box"/>`;
        if (h.note) s += `<text x="${cx.toFixed(1)}" y="${(top_ - 8).toFixed(1)}" text-anchor="middle" class="lab-t sm b">${esc(h.note)}</text>`;
      }
    });
  });
  return s + "</svg>";
}

// ------------------------------------------------------------------ line chart / small multiples
// o = {
//   panels: [{ title, sub, series: [{ values: [..], cls, dash }], bands: [{ from, to, label, accent }],
//              notes: [{ x, y, text, anchor }] }],
//   x: { min: 0, max: 28, ticks: [0, 7, 14, 21, 28], label: "layer", values },   // values: x per point
//   y: { min, max, ticks, fmt, zero: true },
//   legend: [{ name, cls, dash }], height: 150, cols: [4, 2],                       // [desktop, phone]
// }
// null in values breaks the line. Y tick labels are drawn on the first column only.
export function lineChart(W, o, cls) {
  const narrow = W < 500, P = o.panels;
  const cols = Math.min(P.length, (o.cols || [P.length, 1])[narrow ? 1 : 0]);
  const yfmt = o.y.fmt || ((v) => minus(v));
  const left0 = 40, gapX = narrow ? 24 : 44, ph = o.height || (narrow ? 120 : 150);
  const hasTitle = P.some((p) => p.title), hasSub = P.some((p) => p.sub);
  const legH = o.legend ? 22 : 0;
  const top = legH + (hasTitle ? 22 : 8) + (hasSub ? 16 : 0) + 8;
  const rowH = top + ph + (o.x.label ? 44 : 30);
  const pw = (W - left0 - 8 - gapX * (cols - 1)) / cols;
  const H = Math.ceil(P.length / cols) * rowH;
  let s = open(W, H, cls);
  if (o.legend) { const it = o.legend.map((l) => ({ ...l, kind: "line" })); s += legend(it, (W - legend(it, 0, 0).width) / 2, 14).svg; }
  P.forEach((p, k) => {
    const c = k % cols, r = Math.floor(k / cols);
    const ox = left0 + c * (pw + gapX), oy = r * rowH + top;
    const X = scale(o.x.min, o.x.max, ox, ox + pw), Y = scale(o.y.min, o.y.max, oy + ph, oy);
    if (p.title) s += `<text x="${ox + pw / 2}" y="${oy - (hasSub ? 24 : 10)}" text-anchor="middle" class="panel-t">${esc(p.title)}</text>`;
    if (p.sub) s += `<text x="${ox + pw / 2}" y="${oy - 9}" text-anchor="middle" class="panel-sub">${esc(p.sub)}</text>`;
    for (const b of p.bands || []) {
      s += `<rect x="${X(b.from)}" y="${oy}" width="${X(b.to) - X(b.from)}" height="${ph}" class="band${b.accent ? " accent" : ""}"/>`;
      if (b.label) s += `<text x="${(X(b.from) + X(b.to)) / 2}" y="${oy + ph - 8}" text-anchor="middle" class="band-t">${esc(narrow && b.short ? b.short : b.label)}</text>`;
    }
    for (const v of o.y.ticks) {
      s += `<line x1="${ox}" x2="${ox + pw}" y1="${Y(v)}" y2="${Y(v)}" class="${v === 0 && o.y.zero !== false && o.y.min < 0 ? "grid zero" : "grid"}"/>`;
      if (c === 0) s += `<text x="${ox - 8}" y="${Y(v) + 4}" text-anchor="end" class="tick-t">${yfmt(v)}</text>`;
    }
    for (const se of p.series) {
      const n = se.values.length, xs = o.x.values || se.values.map((_, i) => o.x.min + i * (o.x.max - o.x.min) / (n - 1));
      let run = [];
      const flush = () => { if (run.length > 1) s += `<polyline points="${poly(run)}" class="ln ${se.cls}${se.dash ? " dash" : ""}"/>`; run = []; };
      se.values.forEach((v, i) => (v === null ? flush() : run.push([X(xs[i]), Y(v)])));
      flush();
    }
    for (const t of p.notes || []) s += `<text x="${X(t.x)}" y="${Y(t.y)}" text-anchor="${t.anchor || "middle"}" class="note-t">${esc(narrow && t.short ? t.short : t.text)}</text>`;
    for (const v of o.x.ticks) s += `<text x="${X(v)}" y="${oy + ph + 18}" text-anchor="middle" class="tick-t">${minus(v)}</text>`;
    if (o.x.label) s += `<text x="${ox + pw / 2}" y="${oy + ph + 36}" text-anchor="middle" class="note-t">${esc(o.x.label)}</text>`;
  });
  return s + "</svg>";
}

// ------------------------------------------------------------------ dot strip (one value per row)
// o = { rows: [{ label, value, ours }], domain: [0.9, 1], ticks, fmt, tickFmt, ref: { value, label },
//       labelWidth: [200, 150] }
export function dotStrip(W, o, cls) {
  const narrow = W < 500, rowH = narrow ? 30 : 32, top = 30;
  const left = (o.labelWidth || [200, 150])[narrow ? 1 : 0], right = narrow ? 46 : 60;
  const H = top + o.rows.length * rowH + 30, fmt = o.fmt || ((v) => v.toFixed(3)), tfmt = o.tickFmt || ((v) => minus(v));
  const X = scale(o.domain[0], o.domain[1], left, W - right);
  const ticks = narrow && o.ticks.length > 3 ? [o.ticks[0], o.ticks[Math.floor(o.ticks.length / 2)], o.ticks.at(-1)] : o.ticks;
  let s = open(W, H, cls);
  for (const v of ticks) {
    s += `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 10}" y2="${H - 26}" class="${o.ref && v === o.ref.value ? "grid ref" : "grid"}"/>`;
    s += `<text x="${X(v)}" y="${H - 8}" text-anchor="middle" class="tick-t">${tfmt(v)}</text>`;
  }
  if (o.ref) s += `<line x1="${X(o.ref.value)}" x2="${X(o.ref.value)}" y1="${top - 10}" y2="${H - 26}" class="grid ref"/><text x="${X(o.ref.value)}" y="${top - 16}" text-anchor="middle" class="note-t">${esc(o.ref.label)}</text>`;
  o.rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    s += `<text x="${left - 12}" y="${y + 5}" text-anchor="end" class="lab-t${r.ours ? " ours" : ""}">${esc(narrow && r.short ? r.short : r.label)}</text>`;
    s += `<line x1="${X(o.domain[0])}" x2="${X(r.value)}" y1="${y}" y2="${y}" class="stem"/>`;
    s += `<circle cx="${X(r.value)}" cy="${y}" r="${narrow ? 5.5 : 6.5}" class="${r.ours ? "s1" : "s4"}"/>`;
    s += `<text x="${X(r.value) + 11}" y="${y + 5}" class="val-t${r.ours ? " ours" : ""}">${fmt(r.value)}</text>`;
  });
  return s + "</svg>";
}

// ------------------------------------------------------------------ forest plot (mean and interval)
// o = { groups: [{ label, sub, cls, rows: [{ label, mean, lo, hi }] }], domain: [-0.04, 0.04],
//       ticks, tickFmt, xLabel, labelWidth: [330, 96] }
// Desktop: group names in a left column, row names beside the intervals. Phone: group name above.
export function forest(W, o, cls) {
  const narrow = W < 500, rowH = 17, top = 22;
  const anyRowLabel = o.groups.some((g) => g.rows.some((r) => r.label));
  const left = narrow ? (anyRowLabel ? (o.labelWidth || [330, 96])[1] : 8) : (o.labelWidth || [330, 96])[0];
  const right = 22, X = scale(o.domain[0], o.domain[1], left, W - right);
  const tfmt = o.tickFmt || ((v) => minus(v));
  let y = top, body = "";
  o.groups.forEach((g) => {
    const n = g.rows.length;
    if (narrow) { body += `<text x="0" y="${y + 12}" class="lab-t sm b">${esc(g.label)}</text>`; y += 20; }
    else {
      const cy = y + n * rowH / 2;
      body += `<text x="${left - (anyRowLabel ? 118 : 14)}" y="${cy + (g.sub ? -3 : 4)}" text-anchor="end" class="lab-t sm b">${esc(g.label)}</text>`;
      if (g.sub) body += `<text x="${left - (anyRowLabel ? 118 : 14)}" y="${cy + 13}" text-anchor="end" class="note-t">${esc(g.sub)}</text>`;
    }
    g.rows.forEach((r, i) => {
      const cy = y + i * rowH + rowH / 2;
      if (r.label) body += `<text x="${narrow ? 0 : left - 104}" y="${cy + 4}" class="tick-t" style="font-size:11.5px">${esc(r.label)}</text>`;
      body += `<line x1="${X(r.lo)}" x2="${X(r.hi)}" y1="${cy}" y2="${cy}" class="ci ${g.cls || "s1"}"/>`;
      body += `<circle cx="${X(r.mean)}" cy="${cy}" r="4" class="${g.cls || "s1"}"/>`;
    });
    y += n * rowH + (narrow ? 22 : 18);
  });
  const H = y + 30 + (o.xLabel ? 18 : 0);
  let s = open(W, H, cls);
  for (const v of o.ticks) {
    s += `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 8}" y2="${y}" class="${v === 0 ? "grid zero" : "grid"}"/>`;
    s += `<text x="${X(v)}" y="${y + 18}" text-anchor="middle" class="tick-t">${tfmt(v)}</text>`;
  }
  if (o.xLabel) s += `<text x="${(left + W - right) / 2}" y="${y + 38}" text-anchor="middle" class="note-t">${o.xLabel}</text>`;
  return s + body + "</svg>";
}

// ------------------------------------------------------------------ horizontal bars (HTML)
// Responsive by CSS grid, so one version serves every width. Good for Figure 1 under the highlight numbers
// (an SVG Figure 1 there is 860 px wide on desktop: both(fn, opts, 860, 358)).
// o = { rows: [{ label, sub, value, err, kind: "ours" | "base" }], domain: [0, 100],
//       ticks: [0, 20, 40, 60, 80, 100], ref: { value, label }, fmt }
export function hbars(o) {
  const [d0, d1] = o.domain || [0, 100], fmt = o.fmt || f1;
  const pct = (v) => ((v - d0) / (d1 - d0) * 100).toFixed(2) + "%";
  let b = '<div class="bars">';
  for (const r of o.rows) {
    b += `<div class="bar-row${r.kind ? " " + r.kind : ""}"><span class="bar-name">${esc(r.label)}${r.sub ? `<i>${esc(r.sub)}</i>` : ""}</span>` +
      `<span class="bar-track"><span class="bar" style="width:${pct(r.value)}"></span>` +
      (r.err ? `<span class="whisk" style="left:${pct(r.value - r.err)};width:${((2 * r.err) / (d1 - d0) * 100).toFixed(2)}%"></span>` : "") +
      (o.ref ? `<span class="ref-line" style="left:${pct(o.ref.value)}"></span>` : "") +
      `</span><span class="bar-val">${fmt(r.value)}</span></div>`;
  }
  b += '<div class="bar-row axis" aria-hidden="true"><span class="bar-name"></span><span class="bar-track">' +
    (o.ticks || []).map((v) => `<span class="tick" style="left:${pct(v)}">${minus(v)}</span>`).join("") +
    (o.ref?.label ? `<span class="ref-label" style="left:${pct(o.ref.value)}">${esc(o.ref.label)}</span>` : "") +
    '</span><span class="bar-val"></span></div></div>';
  return b;
}

// ------------------------------------------------------------------ results table (HTML)
// o = { groups: [{ label, span }],                                  // optional header row above
//       columns: [{ label, num, fmt, gl }],                         // gl: rule on the left
//       rows: [{ cells: [...], ours, sum }], rowHeader: true }      // first cell as <th scope=row>
// Cells: number -> fmt, null -> dash, true/false -> check / dash, string -> as given (escaped).
export function table(o) {
  const ck = '<span class="ck" aria-label="yes">✓</span>', no = '<span class="no" aria-label="no">–</span>';
  const cell = (v, c) => (v === null || v === undefined ? '<span class="na">–</span>' : v === true ? ck : v === false ? no
    : typeof v === "number" ? (c.fmt || f1)(v).replace(/^-/, "−") : esc(v));
  let t = '<table class="results"><thead>';
  if (o.groups) t += "<tr>" + o.groups.map((g) => `<th colspan="${g.span || 1}"${g.label ? ' class="grp"' : ""}>${esc(g.label || "")}</th>`).join("") + "</tr>";
  t += "<tr>" + o.columns.map((c) => `<th${c.num ? ' class="num"' : ""}>${esc(c.label)}</th>`).join("") + "</tr></thead><tbody>";
  for (const r of o.rows) {
    t += `<tr${r.ours ? ' class="ours"' : r.sum ? ' class="sum"' : ""}>`;
    r.cells.forEach((v, i) => {
      const c = o.columns[i] || {}, k = [c.num ? "num" : "", typeof v === "boolean" ? "c" : "", c.gl ? "gl" : ""].filter(Boolean).join(" ");
      t += i === 0 && o.rowHeader !== false ? `<th scope="row">${cell(v, c)}</th>` : `<td${k ? ` class="${k}"` : ""}>${cell(v, c)}</td>`;
    });
    t += "</tr>";
  }
  return t + "</tbody></table>";
}
