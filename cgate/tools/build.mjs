// Build index.html from tools/index.src.html.
//   cd tools && npm install && node build.mjs
// Renders math with KaTeX at build time and generates every chart and table
// from assets/data/results.json, so the published page needs no build step
// and no runtime math library.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import katex from "katex";

// Final public address, with trailing slash (used only for social previews).
// e.g. SITE_URL="https://<user>.github.io/<repo>/" node build.mjs
const SITE_URL = process.env.SITE_URL || "https://mhhsu1006.github.io/cgate/";
const PAPER_URL = "https://openreview.net/forum?id=ux19efk62R";
const PDF_URL = "https://openreview.net/pdf?id=ux19efk62R";
// Logos shown if the file exists in assets/img: [file, alt, height in masthead]
const LOGOS = [
  ["cuhk-shenzhen.png", "The Chinese University of Hong Kong, Shenzhen", 40],
  ["microsoft.png", "Microsoft", 26],
];

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
let html = fs.readFileSync(path.join(here, "index.src.html"), "utf8");
const D = JSON.parse(fs.readFileSync(path.join(root, "assets/data/results.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);

// ---------------------------------------------------------------- icons, links, logos
const icon = (d, extra = "") => `<svg viewBox="0 0 20 20" aria-hidden="true" ${extra}>${d}</svg>`;
const ICONS = {
  ICON_PAPER: icon('<path d="M5 2.5h7l3 3v12H5z"/><path d="M12 2.5v3h3M7.5 9.5h5M7.5 12.5h5"/>'),
  ICON_PDF: icon('<path d="M5 2.5h7l3 3v12H5z"/><path d="M10 8v6m-2.5-2.5L10 14l2.5-2.5"/>'),
  ICON_PLAY: icon('<path d="M6.5 4.5v11l9-5.5z"/>', 'class="i-play"'),
  ICON_CODE: icon('<path d="m7 6-4 4 4 4m6-8 4 4-4 4"/>'),
  ICON_BOX: icon('<path d="M10 2.5 17 6v8l-7 3.5L3 14V6z"/><path d="M3 6l7 3.5L17 6M10 9.5v8"/>'),
  ICON_QUOTE: icon('<path d="M4 4.5h12v8H9l-3.5 3v-3H4z"/>'),
};
for (const [k, v] of Object.entries(ICONS)) html = html.replaceAll(`{{${k}}}`, v);
html = html.replaceAll("{{PAPER_URL}}", PAPER_URL).replaceAll("{{PDF_URL}}", PDF_URL).replaceAll("{{SITE_URL}}", SITE_URL);
const have = LOGOS.filter(([f]) => fs.existsSync(path.join(root, "assets/img", f)));
const logoRow = (cls, scale) => have.length
  ? `<div class="${cls}" aria-label="Institutions">${have.map(([f, alt, h]) => `<img src="assets/img/${f}" alt="${esc(alt)}" height="${Math.round(h * scale)}">`).join("")}</div>`
  : "";
html = html.replace("{{LOGOS}}", logoRow("logos", 1)).replace("{{LOGOS_SMALL}}", logoRow("logos small", .76));
html = html.replace("{{PARTIAL_ARCH}}", fs.readFileSync(path.join(here, "partials/architecture.html"), "utf8"));

// ---------------------------------------------------------------- math
html = html.replace(/<math-tex( display)?>([\s\S]*?)<\/math-tex>/g, (_, disp, tex) => {
  const out = katex.renderToString(tex.trim(), { displayMode: !!disp, throwOnError: true, output: "html" });
  return disp ? `<div class="math-display">${out}</div>` : out;
});

// ---------------------------------------------------------------- Figure 1: probes (HTML bars, 0..100)
{
  const P = D.probes;
  let b = '<div class="bars">';
  for (const [name, , m, sd] of P.rows) {
    const key = name.startsWith("Bag");
    b += `<div class="bar-row${key ? " ours" : ""}${name.startsWith("Mean-pooled Whisper") ? " base" : ""}"><span class="bar-name">${esc(name)}</span>` +
      `<span class="bar-track"><span class="bar" style="width:${m}%"></span>` +
      `<span class="whisk" style="left:${m - sd}%;width:${2 * sd}%"></span>` +
      `<span class="maj" style="left:${P.majority}%"></span></span>` +
      `<span class="bar-val">${f1(m)}</span></div>`;
  }
  b += '<div class="bar-row axis" aria-hidden="true"><span class="bar-name"></span><span class="bar-track">' +
    [0, 20, 40, 60, 80, 100].map((v) => `<span class="tick" style="left:${v}%">${v}</span>`).join("") +
    `<span class="maj-label" style="left:${P.majority}%">majority class ${P.majority}</span>` +
    '</span><span class="bar-val"></span></div></div>';
  html = html.replace("{{PROBECHART}}", b);
}

// ---------------------------------------------------------------- Figure 3: routing entropy (dot strip, 0.90..1.00)
// Charts are drawn at their display width (desktop 860, mobile 360) so text stays at its CSS size.
const modelName = (name) => ({ "Emotion-only": "C-Gate Emotion", "ASR-only": "C-Gate ASR", "Two-task": "C-Gate ASR + Emotion", "Three-task": "C-Gate Full" })[name] || name;

function routingSVG(W, cls) {
  const narrow = W < 500;
  const rowH = 46, top = 30, left = narrow ? 185 : 230, right = narrow ? 46 : 60, H = top + D.routing.rows.length * rowH + 30;
  const x = (v) => left + (v - 0.9) / 0.1 * (W - left - right);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="dotstrip ${cls}">`;
  for (const v of narrow ? [0.90, 0.95, 1.00] : [0.90, 0.92, 0.94, 0.96, 0.98, 1.00]) {
    s += `<line x1="${x(v)}" x2="${x(v)}" y1="${top - 10}" y2="${H - 26}" class="${v === 1 ? "grid strong" : "grid"}"/>`;
    s += `<text x="${x(v)}" y="${H - 8}" text-anchor="middle" class="tick-t">${v.toFixed(2)}</text>`;
  }
  s += `<text x="${x(1)}" y="${top - 16}" text-anchor="middle" class="note-t">uniform</text>`;
  D.routing.rows.forEach(([model, task, , hn], i) => {
    const y = top + i * rowH + rowH / 2;
    const ours = model === "Three-task";
    const name = modelName(model);
    s += `<text x="${left - 12}" y="${y - 3}" text-anchor="end" class="lab-t${ours ? " ours" : ""}">${esc(name)}</text><text x="${left - 12}" y="${y + 14}" text-anchor="end" class="note-t">${esc(task)} input</text>`;
    s += `<line x1="${x(0.9)}" x2="${x(hn)}" y1="${y}" y2="${y}" class="stem"/>`;
    s += `<circle cx="${x(hn)}" cy="${y}" r="${narrow ? 5.5 : 6.5}" class="${ours ? "dot ours" : "dot"}"/>`;
    s += `<text x="${x(hn) + 11}" y="${y + 5}" class="val-t">${hn.toFixed(3)}</text>`;
  });
  return s + "</svg>";
}
html = html.replace("{{ROUTING_CHART}}", routingSVG(860, "chart-desktop") + routingSVG(360, "chart-mobile"));

// ---------------------------------------------------------------- Figure 4: attention effective rank (grouped bars, 0..5)
function rankSVG(W, cls) {
  const narrow = W < 500;
  const R = D.attention_rank, H = narrow ? 315 : 300, top = 40, base = H - (narrow ? 78 : 44), left = 34, right = 6;
  const y = (v) => base - v / 5 * (base - top);
  const gw = (W - left - right) / R.models.length, bw = narrow ? 30 : 64;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="rank ${cls}">`;
  for (const v of [0, 1, 2, 3, 4, 5]) {
    s += `<line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" class="${v === 5 ? "grid dash" : v === 0 ? "axis" : "grid"}"/>`;
    s += `<text x="${left - 10}" y="${y(v) + 4}" text-anchor="end" class="tick-t">${v}</text>`;
  }
  R.models.forEach((m, i) => {
    const cx = left + gw * i + gw / 2;
    [["emotion", -1], ["asr", 1]].forEach(([k, side]) => {
      const v = R[k][i], x0 = cx + (side < 0 ? -bw - 3 : 3);
      s += `<rect x="${x0}" y="${y(v)}" width="${bw}" height="${base - y(v)}" class="bar-${k}"/>`;
      s += `<text x="${x0 + bw / 2}" y="${y(v) - 7}" text-anchor="middle" class="val-t">${f2(v)}</text>`;
    });
    const label = narrow ? ["C-Gate", ...(m === "Two-task" ? ["ASR +", "Emotion"] : [modelName(m).replace("C-Gate ", "")])] : [modelName(m)];
    label.forEach((l, j) => s += `<text x="${cx}" y="${base + 22 + j * 17}" text-anchor="middle" class="lab-t${m === "Three-task" ? " ours" : ""}">${esc(l)}</text>`);
  });
  const lx = W / 2 - 115;
  s += `<g><rect x="${lx}" y="6" width="13" height="13" class="bar-emotion"/><text x="${lx + 19}" y="17" class="lab-t">Emotion input</text>` +
       `<rect x="${lx + 140}" y="6" width="13" height="13" class="bar-asr"/><text x="${lx + 159}" y="17" class="lab-t">ASR input</text></g>`;
  return s + "</svg>";
}
html = html.replace("{{RANK_CHART}}", rankSVG(860, "chart-desktop") + rankSVG(360, "chart-mobile"));

// ---------------------------------------------------------------- parameter table
{
  const P = D.params;
  let t = '<table class="stages params"><thead><tr><th>Component</th><th class="num">Parameters</th><th>Status</th></tr></thead><tbody>';
  for (const [name, n, st] of P.rows) {
    const m = n >= 1e9 ? (n / 1e9).toFixed(2) + "B" : (n / 1e6).toFixed(1) + "M";
    t += `<tr class="${st === "Trained" ? "trained" : ""}"><td>${esc(name)}</td><td class="num">${m}</td><td>${st}</td></tr>`;
  }
  t += `<tr class="total"><td>Total</td><td class="num">${(P.total / 1e9).toFixed(2)}B</td><td>${(100 * P.trained / P.total).toFixed(1)}% trained</td></tr></tbody></table>`;
  html = html.replace("{{PARAMS_TABLE}}", t);
}

// ---------------------------------------------------------------- Table 1
{
  const T = D.table1, ck = '<span class="ck" aria-label="yes">✓</span>', no = '<span class="no" aria-label="no">–</span>';
  let t = '<table class="results t1"><thead>' +
    '<tr><th colspan="3" class="grp">Training data</th><th colspan="2" class="grp">ASR · WER ↓</th><th colspan="3" class="grp">Emotion · accuracy</th><th colspan="3" class="grp">Reasoning · accuracy</th></tr>' +
    '<tr><th>ASR</th><th>Emotion</th><th>Reasoning</th>' + T.columns.map((c) => `<th class="num">${esc(c)}</th>`).join("") + "</tr></thead><tbody>";
  for (const r of T.rows) {
    t += `<tr${r.ours ? ' class="ours"' : ""}>` + r.train.map((b) => `<td class="c">${b ? ck : no}</td>`).join("") +
      r.values.map((v, i) => `<td class="num${i === 0 || i === 2 || i === 5 ? " gl" : ""}">${v === null ? '<span class="na">–</span>' : i < 2 ? f2(v) : f1(v)}</td>`).join("") + "</tr>";
  }
  t += "</tbody></table>";
  html = html.replace("{{TABLE1}}", t);
}

// ---------------------------------------------------------------- Table 8
{
  const E = D.emotion_by_corpus;
  let t = '<table class="results t8"><thead><tr><th>Corpus</th><th class="num">Test recordings</th><th class="num">C-Gate Emotion</th><th class="num">C-Gate ASR + Emotion</th><th class="num ours-h">C-Gate Full</th></tr></thead><tbody>';
  for (const [c, n, a, b, g] of E.rows) t += `<tr><th scope="row">${esc(c)}</th><td class="num">${n.toLocaleString("en-US")}</td><td class="num">${f1(a)}</td><td class="num">${f1(b)}</td><td class="num ours-c">${f1(g)}</td></tr>`;
  const [n, a, b, g] = E.all;
  t += `<tr class="sum"><th scope="row">All</th><td class="num">${n.toLocaleString("en-US")}</td><td class="num">${f1(a)}</td><td class="num">${f1(b)}</td><td class="num ours-c">${f1(g)}</td></tr></tbody></table>`;
  html = html.replace("{{TABLE_EMO}}", t);
}

// ---------------------------------------------------------------- intervention data + BibTeX
html = html.replace("{{IV_DATA}}", `<script type="application/json" id="iv-data">${JSON.stringify(D.interventions)}</script>`);
html = html.replace("{{BIBTEX}}", esc(fs.readFileSync(path.join(root, "assets/data/citation.bib"), "utf8").trim()));

if (/\{\{[A-Z_0-9]+\}\}/.test(html)) throw new Error("unfilled placeholder: " + html.match(/\{\{[A-Z_0-9]+\}\}/)[0]);
fs.writeFileSync(path.join(root, "index.html"), html);
console.log("wrote index.html", (html.length / 1024).toFixed(1), "KB");
