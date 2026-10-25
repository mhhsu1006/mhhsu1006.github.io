// Build index.html from tools/index.src.html.
//   cd tools && npm install && node build.mjs
// Renders math with KaTeX at build time and draws the static charts from
// assets/data/results.json. The interactive heatmap and attention panels read
// the same data from a JSON block embedded in the page.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import katex from "katex";

// Final public address, with trailing slash (used only for social previews).
// e.g. SITE_URL="https://<user>.github.io/<repo>/" node build.mjs
const SITE_URL = process.env.SITE_URL || "https://mhhsu1006.github.io/geoalign/";
const PAPER_URL = "https://openreview.net/forum?id=KNuSWirJEG";
const PDF_URL = "https://openreview.net/pdf?id=KNuSWirJEG";
// Logos shown if the file exists in assets/img: [file, alt, height in masthead]
const LOGOS = [
  ["cuhk-shenzhen.png", "The Chinese University of Hong Kong, Shenzhen", 40],
  ["bytedance.png", "ByteDance", 30],
];

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
let html = fs.readFileSync(path.join(here, "index.src.html"), "utf8");
const D = JSON.parse(fs.readFileSync(path.join(root, "assets/data/results.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r1 = (v) => Math.round(v * 10) / 10;
const TEXT = "#ff7f0e", SPEECH = "#1f77b4", TEAL = "#21918c";

// ---------------------------------------------------------------- icons, links, logos
const icon = (d, extra = "") => `<svg viewBox="0 0 20 20" aria-hidden="true" ${extra}>${d}</svg>`;
const ICONS = {
  ICON_PAPER: icon('<path d="M5 2.5h7l3 3v12H5z"/><path d="M12 2.5v3h3M7.5 9.5h5M7.5 12.5h5"/>'),
  ICON_PDF: icon('<path d="M5 2.5h7l3 3v12H5z"/><path d="M10 8v6m-2.5-2.5L10 14l2.5-2.5"/>'),
  ICON_PLAY: icon('<path d="M6.5 4.5v11l9-5.5z"/>', 'class="i-play"'),
  ICON_CODE: icon('<path d="m7 6-4 4 4 4m6-8 4 4-4 4"/>'),
  ICON_QUOTE: icon('<path d="M4 4.5h12v8H9l-3.5 3v-3H4z"/>'),
};
for (const [k, v] of Object.entries(ICONS)) html = html.replaceAll(`{{${k}}}`, v);
html = html.replaceAll("{{PAPER_URL}}", PAPER_URL).replaceAll("{{PDF_URL}}", PDF_URL).replaceAll("{{SITE_URL}}", SITE_URL);
const have = LOGOS.filter(([f]) => fs.existsSync(path.join(root, "assets/img", f)));
const logoRow = (cls, scale) => have.length
  ? `<div class="${cls}" aria-label="Institutions">${have.map(([f, alt, h]) => `<img src="assets/img/${f}" alt="${esc(alt)}" height="${Math.round(h * scale)}">`).join("")}</div>`
  : "";
html = html.replace("{{LOGOS}}", logoRow("logos", 1)).replace("{{LOGOS_SMALL}}", logoRow("logos small", .76));

// ---------------------------------------------------------------- math
html = html.replace(/<math-tex( display)?>([\s\S]*?)<\/math-tex>/g, (_, disp, tex) => {
  const out = katex.renderToString(tex.trim(), { displayMode: !!disp, throwOnError: true, output: "html" });
  return disp ? `<div class="math-display">${out}</div>` : out;
});

const poly = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

// ---------------------------------------------------------------- Figure 1: geometry over function (dual panel)
function dualSVG(W, cls) {
  const narrow = W < 500;
  const left = 40, right = 8, ph = narrow ? 104 : 118, gapY = 54;
  const t1 = 26, b1 = t1 + ph, t2 = b1 + gapY, b2 = t2 + ph, H = b2 + 66;
  const mid = (left + W - right) / 2;
  const X = (l) => left + l / 28 * (W - left - right);
  const Y1 = (v) => b1 - v / 0.7 * ph;             // CKA 0..0.7
  const Y2 = (v) => t2 + (0.15 - v) / 0.35 * ph;   // margin -0.20..0.15
  const F = D.fig1;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="dualsvg ${cls}">`;
  // shading
  s += `<rect x="${X(10)}" y="${t1}" width="${X(21) - X(10)}" height="${ph}" class="shade-mid"/>`;
  s += `<rect x="${X(23)}" y="${t2}" width="${X(28) - X(23)}" height="${ph}" class="shade-late"/>`;
  // panel 1
  for (const v of [0, 0.3, 0.6]) s += `<line x1="${left}" x2="${W - right}" y1="${Y1(v)}" y2="${Y1(v)}" class="grid"/><text x="${left - 8}" y="${Y1(v) + 4}" text-anchor="end" class="tick-t">${v}</text>`;
  s += `<text x="${mid}" y="${t1 - 10}" text-anchor="middle" class="panel-t"><tspan class="b">Geometry</tspan>  speech–text CKA</text>`;
  s += `<polyline points="${poly(F.cka_permuted.map((v, i) => [X(i), Y1(v)]))}" class="ln-perm"/>`;
  s += `<polyline points="${poly(F.cka.map((v, i) => [X(i), Y1(v)]))}" class="ln-cka"/>`;
  s += `<text x="${(X(10) + X(21)) / 2}" y="${Y1(0.36)}" text-anchor="middle" class="note-t teal">${narrow ? "aligned" : "aligned in middle layers"}</text>`;
  s += `<text x="${X(28)}" y="${Y1(F.cka_permuted[28]) + 15}" text-anchor="end" class="note-t">permuted positions</text>`;
  // panel 2
  for (const v of [-0.1, 0, 0.1]) s += `<line x1="${left}" x2="${W - right}" y1="${Y2(v)}" y2="${Y2(v)}" class="${v === 0 ? "grid zero" : "grid"}"/><text x="${left - 8}" y="${Y2(v) + 4}" text-anchor="end" class="tick-t">${v === 0 ? "0" : v > 0 ? "0.1" : "−0.1"}</text>`;
  s += `<text x="${mid}" y="${t2 - 10}" text-anchor="middle" class="panel-t"><tspan class="b">Function</tspan>  answer margin</text>`;
  s += `<polyline points="${poly(F.margin_speech.map((v, i) => [X(i), Y2(v)]))}" class="ln-speech"/>`;
  s += `<polyline points="${poly(F.margin_text.map((v, i) => [X(i), Y2(v)]))}" class="ln-text"/>`;
  s += `<text x="${(X(23) + X(28)) / 2}" y="${b2 - 8}" text-anchor="middle" class="note-t">${narrow ? "separate" : "margins separate"}</text>`;
  // legend
  const lx = mid - 70, ly = b2 + 60;
  s += `<line x1="${lx}" x2="${lx + 18}" y1="${ly - 4}" y2="${ly - 4}" class="ln-text"/><text x="${lx + 24}" y="${ly}" class="lab-t sm">text input</text>`;
  s += `<line x1="${lx + 96}" x2="${lx + 114}" y1="${ly - 4}" y2="${ly - 4}" class="ln-speech"/><text x="${lx + 120}" y="${ly}" class="lab-t sm">speech input</text>`;
  // x axis
  for (const l of [0, 7, 14, 21, 28]) s += `<text x="${X(l)}" y="${b2 + 18}" text-anchor="middle" class="tick-t">${l}</text>`;
  s += `<text x="${(left + W - right) / 2}" y="${b2 + 36}" text-anchor="middle" class="note-t">layer</text>`;
  return s + "</svg>";
}
html = html.replace("{{DUAL}}", dualSVG(860, "chart-desktop") + dualSVG(360, "chart-mobile"));

// ---------------------------------------------------------------- Figure 2: accuracy gap
function gapSVG(W, cls) {
  const narrow = W < 500;
  const A = D.accuracy, benches = ["SpeechMMLU", "BBH"];
  const pw = narrow ? W : (W - 40) / 2, ph = narrow ? 170 : 200, top = 44, lg = 30, H = lg + (narrow ? 2 * (ph + top + 76) : ph + top + 70);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="gapsvg ${cls}">`;
  const lc = W / 2 - (narrow ? 70 : 100);
  s += `<rect x="${lc}" y="5" width="12" height="12" class="bar-text"/><text x="${lc + 18}" y="16" class="lab-t sm">${narrow ? "Text" : "Text input (T2T)"}</text>`;
  s += `<rect x="${lc + (narrow ? 76 : 124)}" y="5" width="12" height="12" class="bar-speech"/><text x="${lc + (narrow ? 94 : 142)}" y="16" class="lab-t sm">${narrow ? "Speech" : "Speech input (S2T)"}</text>`;
  benches.forEach((bn, bi) => {
    const ox = narrow ? 0 : bi * (pw + 40), oy = lg + (narrow ? bi * (ph + top + 76) : 0);
    const left = ox + 36, right = ox + pw - 4, base = oy + top + ph;
    const Y = (v) => base - v / 100 * ph;
    s += `<text x="${(left + right) / 2}" y="${oy + 22}" text-anchor="middle" class="panel-t"><tspan class="b">${bn}</tspan></text>`;
    for (const v of [0, 25, 50, 75, 100]) s += `<line x1="${left}" x2="${right}" y1="${Y(v)}" y2="${Y(v)}" class="${v ? "grid" : "axis"}"/><text x="${left - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick-t">${v}</text>`;
    const gw = (right - left) / A.models.length, bw = Math.min(30, gw * .34);
    A.models.forEach((m, i) => {
      const cx = left + gw * (i + .5);
      const t = A[bn].T2T[i], sp = A[bn].S2T[i];
      s += `<rect x="${cx - bw - 2}" y="${Y(t)}" width="${bw}" height="${base - Y(t)}" class="bar-text"/>`;
      s += `<rect x="${cx + 2}" y="${Y(sp)}" width="${bw}" height="${base - Y(sp)}" class="bar-speech"/>`;
      s += `<text x="${cx - bw / 2 - 2}" y="${Y(t) - 6}" text-anchor="middle" class="val-t sm">${t.toFixed(1)}</text>`;
      s += `<text x="${cx + bw / 2 + 2}" y="${Y(sp) - 6}" text-anchor="middle" class="val-t sm">${sp.toFixed(1)}</text>`;
      const lab = narrow ? m.split("-").map((p, j, a) => p + (j < a.length - 1 ? "-" : "")) : [m];
      lab.forEach((l, j) => s += `<text x="${cx}" y="${base + 20 + j * 15}" text-anchor="middle" class="lab-t sm">${esc(l)}</text>`);
    });
  });
  return s + "</svg>";
}
html = html.replace("{{GAPCHART}}", gapSVG(1032, "chart-desktop") + gapSVG(358, "chart-mobile"));

// ---------------------------------------------------------------- Figure 3: margins by correctness group
function marginsSVG(W, cls) {
  const narrow = W < 500;
  const groups = Object.keys(D.margins), cols = narrow ? 2 : 4, rows = narrow ? 2 : 1;
  const gx = narrow ? 26 : 34, pw = (W - 36 - 12 - gx * (cols - 1)) / cols, ph = narrow ? 120 : 150, top = 56, rowH = ph + top + 30;
  let s = `<svg viewBox="0 0 ${W} ${rows * rowH + 6}" class="marg ${cls}">`;
  const lx = W / 2 - 70;
  s += `<line x1="${lx}" x2="${lx + 18}" y1="10" y2="10" class="ln-text"/><text x="${lx + 24}" y="14" class="lab-t sm">text input</text>`;
  s += `<line x1="${lx + 96}" x2="${lx + 114}" y1="10" y2="10" class="ln-speech"/><text x="${lx + 120}" y="14" class="lab-t sm">speech input</text>`;
  groups.forEach((g, k) => {
    const c = k % cols, r = Math.floor(k / cols);
    const ox = 36 + c * (pw + gx), oy = r * rowH + top;
    const X = (l) => ox + l / 28 * pw, Y = (v) => oy + (0.6 - v) / 1.2 * ph;
    const name = g.split(" (")[0];
    s += `<text x="${ox + pw / 2}" y="${oy - 12}" text-anchor="middle" class="lab-t sm b">${esc(name)}</text>`;
    s += `<rect x="${X(23)}" y="${oy}" width="${X(28) - X(23)}" height="${ph}" class="shade-late"/>`;
    for (const v of [-0.5, 0, 0.5]) {
      s += `<line x1="${ox}" x2="${ox + pw}" y1="${Y(v)}" y2="${Y(v)}" class="${v === 0 ? "grid zero" : "grid"}"/>`;
      if (c === 0) s += `<text x="${ox - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick-t">${v === 0 ? "0" : v > 0 ? "0.5" : "−0.5"}</text>`;
    }
    s += `<polyline points="${poly(D.margins[g].speech.map((v, i) => [X(i), Y(v)]))}" class="ln-speech thin"/>`;
    s += `<polyline points="${poly(D.margins[g].text.map((v, i) => [X(i), Y(v)]))}" class="ln-text thin"/>`;
    for (const l of [0, 14, 28]) s += `<text x="${X(l)}" y="${oy + ph + 16}" text-anchor="middle" class="tick-t">${l}</text>`;
  });
  return s + "</svg>";
}
html = html.replace("{{MARGINS}}", marginsSVG(1032, "chart-desktop") + marginsSVG(358, "chart-mobile"));

// ---------------------------------------------------------------- Figure 4: intervention forest plot
function forestSVG(W, cls) {
  const narrow = W < 500;
  const I = D.intervention, lo = -0.045, hi = 0.045;
  const left = narrow ? 8 : 330, right = 12, rowH = 17, grpGap = narrow ? 38 : 18, top = 22;
  const X = (v) => left + (v - lo) / (hi - lo) * (W - left - right);
  const colors = ["#1f77b4", "#ff7f0e", "#8a92a1", "#8a92a1"];
  let y = top, s = "";
  I.rows.forEach(([name, cells], gi) => {
    if (narrow) { s += `<text x="${left}" y="${y + 12}" class="lab-t sm b">${esc(name)}</text>`; y += 18; }
    else {
      const [main, sub] = name.split(" (");
      s += `<text x="${left - 118}" y="${y + 4 * rowH / 2 + (sub ? -3 : 4)}" text-anchor="end" class="lab-t sm${gi < 2 ? " b" : ""}">${esc(main)}</text>`;
      if (sub) s += `<text x="${left - 118}" y="${y + 4 * rowH / 2 + 13}" text-anchor="end" class="note-t">${esc(sub.replace(")", ""))}</text>`;
      I.cells.forEach((cn, ci) => s += `<text x="${left - 104}" y="${y + ci * rowH + rowH / 2 + 4}" class="tick-t" style="font-size:11.5px">${esc(cn.toLowerCase())}</text>`);
    }
    cells.forEach(([m, a, b], ci) => {
      const cy = y + ci * rowH + rowH / 2;
      s += `<line x1="${X(a)}" x2="${X(b)}" y1="${cy}" y2="${cy}" stroke="${colors[gi]}" stroke-width="2"/>`;
      s += `<circle cx="${X(m)}" cy="${cy}" r="4" fill="${colors[gi]}"/>`;
    });
    y += 4 * rowH + grpGap;
  });
  const H = y + 30;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="forestsvg ${cls}">`;
  for (const v of [-0.04, -0.02, 0, 0.02, 0.04]) {
    g += `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 8}" y2="${H - 30}" class="${v === 0 ? "grid zero" : "grid"}"/>`;
    g += `<text x="${X(v)}" y="${H - 12}" text-anchor="middle" class="tick-t">${v === 0 ? "0" : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(2).replace(/^0/, "")}</text>`;
  }
  g += `<text x="${(left + W - right) / 2}" y="${H + 8}" text-anchor="middle" class="note-t">change in |z<tspan baseline-shift="sub" font-size="9">X</tspan> − z<tspan baseline-shift="sub" font-size="9">Y</tspan>|</text>`;
  return g.replace(`viewBox="0 0 ${W} ${H}"`, `viewBox="0 0 ${W} ${H + 14}"`) + s + "</svg>";
}
html = html.replace("{{FOREST}}", forestSVG(860, "chart-desktop") + forestSVG(358, "chart-mobile"));

// ---------------------------------------------------------------- tables
{
  let t = '<table class="results"><thead><tr><th>Model</th><th class="num">SpeechMMLU gap</th><th class="num">BBH gap</th><th>Mid-band</th><th>Mode</th></tr></thead><tbody>';
  for (const [m, a, b, band, mode] of D.modes.rows)
    t += `<tr><th scope="row">${esc(m)}</th><td class="num">${esc(a)}</td><td class="num">${esc(b)}</td><td>${esc(band)}</td><td class="mode mode-${mode.split(" ")[0].toLowerCase()}">${esc(mode)}</td></tr>`;
  html = html.replace("{{MODES}}", t + "</tbody></table>");
  let c = '<table class="results"><thead><tr><th>Intervention</th><th>Target</th><th class="num">Overview protocol</th><th class="num">Shared-instruction protocol</th></tr></thead><tbody>';
  for (const [n, tg, a, , x] of D.compression.rows)
    c += `<tr><th scope="row">${esc(n)}</th><td>${esc(tg)}</td><td class="num">${esc(a)}</td><td class="num">${esc(x)}</td></tr>`;
  html = html.replace("{{COMPRESSION}}", c + "</tbody></table>");
}

// ---------------------------------------------------------------- embedded data for the interactive panels
const page = { cka: D.cka, bestmatch: D.bestmatch, phases: D.phases, attention: D.attention, viridis: D.viridis, accuracy: D.accuracy, modes: D.modes.rows };
html = html.replace("{{DATA}}", `<script type="application/json" id="page-data">${JSON.stringify(page)}</script>`);
html = html.replace("{{BIBTEX}}", esc(fs.readFileSync(path.join(root, "assets/data/citation.bib"), "utf8").trim()));

if (/\{\{[A-Z_0-9]+\}\}/.test(html)) throw new Error("unfilled placeholder: " + html.match(/\{\{[A-Z_0-9]+\}\}/)[0]);
fs.writeFileSync(path.join(root, "index.html"), html);
console.log("wrote index.html", (html.length / 1024).toFixed(1), "KB");
