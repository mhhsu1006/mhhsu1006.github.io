// Build core shared by every project page.
//
//   const page = loadPage(import.meta.url);      // reads tools/index.src.html + assets/data/results.json
//   page.fill("FIG1", html);                     // replaces {{FIG1}}
//   finish(page, CONFIG);                        // icons, links, logos, partials, math, BibTeX, checks, write
//
// Placeholders are {{UPPER_CASE}}. finish() refuses to write a page that still has one.
// Text that starts with "TODO" is reported as a warning; with STRICT=1 (or --strict) it is an
// error, and so is a results.json that still carries "_template": true. Semicolons in the prose and
// statistical asides ("95% CI [..]", "(n = 233)") are reported the same way. Use strict for delivery.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import katex from "katex";

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const f0 = (v) => v.toFixed(0), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2), f3 = (v) => v.toFixed(3);
// Typographic minus and explicit plus, for signed values: sgn(f2)(-0.5) -> "−0.50"
export const sgn = (fmt) => (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v));
export const minus = (s) => String(s).replace(/^-/, "−");

const icon = (d, extra = "") => `<svg viewBox="0 0 20 20" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICONS = {
  ICON_PAPER: icon('<path d="M5 2.5h7l3 3v12H5z"/><path d="M12 2.5v3h3M7.5 9.5h5M7.5 12.5h5"/>'),
  ICON_PDF: icon('<path d="M5 2.5h7l3 3v12H5z"/><path d="M10 8v6m-2.5-2.5L10 14l2.5-2.5"/>'),
  ICON_PLAY: icon('<path d="M6.5 4.5v11l9-5.5z"/>', 'class="i-play"'),
  ICON_CODE: icon('<path d="m7 6-4 4 4 4m6-8 4 4-4 4"/>'),
  ICON_BOX: icon('<path d="M10 2.5 17 6v8l-7 3.5L3 14V6z"/><path d="M3 6l7 3.5L17 6M10 9.5v8"/>'),
  ICON_DATA: icon('<ellipse cx="10" cy="5" rx="6" ry="2.5"/><path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5"/>'),
  ICON_QUOTE: icon('<path d="M4 4.5h12v8H9l-3.5 3v-3H4z"/>'),
};

export function loadPage(metaUrl) {
  const here = path.dirname(fileURLToPath(metaUrl));
  const root = path.resolve(here, "..");
  // HTML comments are notes for whoever edits the source; they are not published.
  const html = fs.readFileSync(path.join(here, "index.src.html"), "utf8").replace(/<!--[\s\S]*?-->\n?/g, "");
  const data = JSON.parse(fs.readFileSync(path.join(root, "assets/data/results.json"), "utf8"));
  return {
    here, root, html, data,
    fill(key, value) {
      if (!this.html.includes(`{{${key}}}`)) throw new Error(`{{${key}}} is not in index.src.html`);
      this.html = this.html.replaceAll(`{{${key}}}`, value);
      return this;
    },
    read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); },
  };
}

// <script type="application/json" id="..."> for interactives (read it in site.js)
export const embedJSON = (id, obj) => `<script type="application/json" id="${id}">${JSON.stringify(obj)}</script>`;

export function finish(page, cfg) {
  const { root, here } = page;
  let html = page.html;
  const strict = process.env.STRICT === "1" || process.argv.includes("--strict");
  const SITE_URL = process.env.SITE_URL || cfg.SITE_URL || "";

  // icons and links
  for (const [k, v] of Object.entries(ICONS)) html = html.replaceAll(`{{${k}}}`, v);
  html = html.replaceAll("{{PAPER_URL}}", cfg.PAPER_URL).replaceAll("{{PDF_URL}}", cfg.PDF_URL).replaceAll("{{SITE_URL}}", SITE_URL)
    .replaceAll("{{VIDEO}}", cfg.VIDEO || "film");

  // logos: [file in assets/img, alt text, height in px in the masthead]; missing files are skipped
  const have = (cfg.LOGOS || []).filter(([f]) => fs.existsSync(path.join(root, "assets/img", f)));
  const row = (cls, scale) => have.length
    ? `<div class="${cls}" aria-label="Institutions">${have.map(([f, alt, h]) => `<img src="assets/img/${f}" alt="${esc(alt)}" height="${Math.round(h * scale)}">`).join("")}</div>`
    : "";
  html = html.replace("{{LOGOS}}", row("logos", 1)).replace("{{LOGOS_SMALL}}", row("logos small", .76));

  // partials: {{PARTIAL:name}} -> tools/partials/name.html (diagrams, long SVG)
  html = html.replace(/\{\{PARTIAL:([a-z0-9_-]+)\}\}/g, (_, n) => fs.readFileSync(path.join(here, "partials", `${n}.html`), "utf8"));

  // math: <math-tex>...</math-tex> inline, <math-tex display>...</math-tex> block. Rendered once here,
  // so the page loads only katex.min.css and its fonts, no script.
  html = html.replace(/<math-tex( display)?>([\s\S]*?)<\/math-tex>/g, (_, disp, tex) => {
    const out = katex.renderToString(tex.trim(), { displayMode: !!disp, throwOnError: true, output: "html" });
    return disp ? `<div class="math-display">${out}</div>` : out;
  });

  // BibTeX
  if (html.includes("{{BIBTEX}}")) html = html.replace("{{BIBTEX}}", esc(page.read("assets/data/citation.bib").trim()));

  // checks
  const left = html.match(/\{\{[A-Z_0-9:a-z-]+\}\}/);
  if (left) throw new Error("unfilled placeholder: " + left[0]);
  const problems = [];
  const visible = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
  const todos = [...visible.matchAll(/TODO[^<]{0,60}/g)].map((m) => m[0].trim());
  if (todos.length) problems.push(`${todos.length} TODO left, e.g. "${todos[0]}"`);
  // writing rules: no semicolons in prose, no statistical asides (intervals, sample counts)
  const prose = visible.replace(/<(pre|code|style)[\s\S]*?<\/\1>/g, "").replace(/<span class="katex[\s\S]*?<\/span><\/span><\/span>/g, "")
    .replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, " ").replace(/TL;DR/g, "");
  const semi = prose.match(/[^.;]{0,40};[^.;]{0,30}/);
  if (semi) problems.push(`semicolon in the text: "…${semi[0].trim()}…" (split the sentence or use a comma)`);
  const stat = prose.match(/[^.]{0,30}(\b9[05]% (CI|confidence|interval|bootstrap)|\bCI \[|\bn = \d)[^.]{0,20}/i);
  if (stat) problems.push(`statistical aside in the text: "…${stat[0].trim()}…" (leave intervals and counts to the paper)`);
  if (page.data._template) problems.push('assets/data/results.json still has "_template": true (example data)');
  if (!fs.existsSync(path.join(root, "assets/img/social-card.png"))) problems.push("assets/img/social-card.png missing (run node render_cover.mjs)");
  const vid = `assets/video/${cfg.VIDEO || "film"}`;
  if (!fs.existsSync(path.join(root, `${vid}.mp4`))) problems.push(`${vid}.mp4 missing (copy the film's NAME_clean.mp4 here)`);
  if (!fs.existsSync(path.join(root, `${vid}.en.vtt`))) problems.push(`${vid}.en.vtt missing (copy out/NAME.en.vtt here)`);
  for (const p of problems) console.warn((strict ? "error: " : "warning: ") + p);
  if (strict && problems.length) process.exit(1);

  fs.writeFileSync(path.join(root, "index.html"), html);
  console.log("wrote index.html", (html.length / 1024).toFixed(1), "KB");
}
