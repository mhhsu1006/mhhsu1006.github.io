// Build index.html from tools/index.src.html.
//   cd tools && npm install && node build.mjs
// Renders math with KaTeX at build time, and generates the results chart and
// table from assets/data/benchmark-results.csv, so the published page needs no
// build step and no runtime math library.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import katex from "katex";

// Final public address, with trailing slash (used only for social previews).
// e.g. "https://<user>.github.io/ConvexLLM/"
const SITE_URL = process.env.SITE_URL || "https://mhhsu1006.github.io/convexllm/";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
let html = fs.readFileSync(path.join(here, "index.src.html"), "utf8");

const icon = (d, extra = "") =>
  `<svg viewBox="0 0 20 20" aria-hidden="true" ${extra}>${d}</svg>`;
const ICONS = {
  ICON_ARXIV: icon('<path d="M5 2.5h7l3 3v12H5z"/><path d="M12 2.5v3h3M7.5 9.5h5M7.5 12.5h5"/>'),
  ICON_PDF: icon('<path d="M5 2.5h7l3 3v12H5z"/><path d="M10 8v6m-2.5-2.5L10 14l2.5-2.5"/>'),
  ICON_PLAY: icon('<path d="M6.5 4.5v11l9-5.5z"/>', 'class="i-play"'),
  ICON_CODE: icon('<path d="m7 6-4 4 4 4m6-8 4 4-4 4"/>'),
  ICON_BOX: icon('<path d="M10 2.5 17 6v8l-7 3.5L3 14V6z"/><path d="M3 6l7 3.5L17 6M10 9.5v8"/>'),
  ICON_QUOTE: icon('<path d="M4 4.5h12v8H9l-3.5 3v-3H4z"/>'),
};
for (const [k, v] of Object.entries(ICONS)) html = html.replaceAll(`{{${k}}}`, v);

const partial = (n) => fs.readFileSync(path.join(here, "partials", n), "utf8");
html = html.replace("{{PARTIAL_ARCH}}", partial("architecture.html"));
html = html.replace("{{PARTIAL_ROUTER}}", partial("router.html"));
html = html.replaceAll("{{SITE_URL}}", SITE_URL);

// math
html = html.replace(/<math-tex( display)?>([\s\S]*?)<\/math-tex>/g, (_, disp, tex) => {
  const out = katex.renderToString(tex.trim(), { displayMode: !!disp, throwOnError: true, output: "html" });
  return disp ? `<div class="math-display">${out}</div>` : out;
});

// results
const csv = fs.readFileSync(path.join(root, "assets/data/benchmark-results.csv"), "utf8").trim().split("\n");
const head = csv[0].split(",");
const rows = csv.slice(1).map((l) => {
  const c = l.split(",");
  return Object.fromEntries(head.map((h, i) => [h, i ? Number(c[i]) : c[i]]));
});
const COLS = [
  ["alpaca_eval", "AlpacaEval"], ["alpaca_eval_full", "AlpacaEval-Full"], ["common_eval", "CommonEval"],
  ["sd_qa", "SD-QA"], ["wild_voice", "WildVoice"], ["advbench", "AdvBench"], ["ifeval", "IFEval"],
  ["openbookqa", "OpenBookQA"], ["mmsu", "MMSU"], ["speechmmlu", "SpeechMMLU"], ["bbh", "BBH"],
  ["voicebench_overall", "Overall"],
];
const OURS = "ConvexLLM";
const sorted = [...rows].sort((a, b) => b.voicebench_overall - a.voicebench_overall);
const best = Object.fromEntries(COLS.map(([k]) => [k, Math.max(...rows.map((r) => r[k]))]));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

let t = '<table class="results" id="results-table"><thead><tr><th scope="col" data-key="model" aria-sort="none"><button type="button">Model</button></th>';
for (const [k, label] of COLS)
  t += `<th scope="col" data-key="${k}" class="num${k === "voicebench_overall" ? " overall" : ""}" aria-sort="${k === "voicebench_overall" ? "descending" : "none"}"><button type="button">${label}</button></th>`;
t += "</tr></thead><tbody>";
for (const r of sorted) {
  t += `<tr${r.model === OURS ? ' class="ours"' : ""}><th scope="row" data-v="${esc(r.model)}">${esc(r.model)}</th>`;
  for (const [k] of COLS) {
    const v = r[k];
    const isBest = v === best[k];
    t += `<td class="num${k === "voicebench_overall" ? " overall" : ""}" data-v="${v}">${isBest ? "<b>" : ""}${v.toFixed(2)}${isBest ? "</b>" : ""}</td>`;
  }
  t += "</tr>";
}
t += "</tbody></table>";
html = html.replace("{{RESULTS_TABLE}}", t);

// bar chart: scale 0..100, labelled ticks
let b = '<div class="bars">';
for (const r of sorted) {
  const ours = r.model === OURS;
  b += `<div class="bar-row${ours ? " ours" : ""}"><span class="bar-name">${esc(r.model)}</span>` +
       `<span class="bar-track"><span class="bar" style="width:${r.voicebench_overall}%"></span></span>` +
       `<span class="bar-val">${r.voicebench_overall.toFixed(2)}</span></div>`;
}
b += '<div class="bar-row axis" aria-hidden="true"><span class="bar-name"></span><span class="bar-track">' +
     [0, 20, 40, 60, 80, 100].map((v) => `<span class="tick" style="left:${v}%">${v}</span>`).join("") +
     '</span><span class="bar-val"></span></div></div>';
html = html.replace("{{BARCHART}}", b);

// explorer data (inlined so the page also works from file://)
html = html.replace("{{DEMO_JSON}}", fs.readFileSync(path.join(root, "assets/demo/cgate-demo.json"), "utf8").replace(/<\//g, "<\\/"));

// bibtex
html = html.replace("{{BIBTEX}}", esc(fs.readFileSync(path.join(root, "assets/data/citation.bib"), "utf8").trim()));

if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error("unfilled placeholder: " + html.match(/\{\{[A-Z_]+\}\}/)[0]);
fs.writeFileSync(path.join(root, "index.html"), html);
console.log("wrote index.html", (html.length / 1024).toFixed(1), "KB");
