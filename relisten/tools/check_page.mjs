// Screenshot and sanity-check the built page at desktop and phone widths.
//   cd tools && node check_page.mjs
// Writes tools/shots/desktop-N.png and phone-N.png (page cut into readable slices) and one image
// per view of every [data-switch] panel, then reports:
//   console errors and failed requests, images that did not load,
//   elements wider than the phone screen (the usual cause of sideways scrolling),
//   SVG text that runs outside its chart.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.join(here, "shots");
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
const types = { ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".js": "text/javascript", ".css": "text/css", ".mp4": "video/mp4", ".vtt": "text/vtt" };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
let problems = 0;
const report = (s) => { problems++; console.log("  ✗ " + s); };

for (const [name, width] of [["desktop", 1280], ["phone", 390]]) {
  console.log(`${name} (${width} px)`);
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on("pageerror", (e) => report("script error: " + e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && report("console: " + m.text()));
  // video preloads are routinely aborted by the browser; anything else that fails is real
  page.on("requestfailed", (r) => !/ERR_ABORTED/.test(r.failure()?.errorText || "") && report("request failed: " + r.url()));
  page.on("response", (r) => r.status() >= 400 && report(`${r.status()} ${r.url().replace(url, "")}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate((W) => {
    const res = { broken: [], wide: [], spill: [] };
    for (const img of document.images) if (!img.complete || !img.naturalWidth) res.broken.push(img.getAttribute("src"));
    for (const el of document.querySelectorAll("main *, header *, footer *")) {
      const b = el.getBoundingClientRect();
      if (!b.width || getComputedStyle(el).display === "none") continue;
      if (el.closest(".table-scroll, .math-display, pre, .topnav-links")) continue;   // these scroll on purpose
      if (b.right > W + 1 || b.left < -1) res.wide.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} ${Math.round(b.left)}..${Math.round(b.right)}`);
    }
    for (const svg of document.querySelectorAll("svg.chart")) {
      if (getComputedStyle(svg).display === "none" || svg.closest("[hidden]")) continue;
      const box = svg.getBoundingClientRect();
      for (const t of svg.querySelectorAll("text")) {
        const b = t.getBoundingClientRect();
        if (b.width && (b.left < box.left - 2 || b.right > box.right + 2)) res.spill.push(`"${t.textContent.slice(0, 30)}"`);
      }
    }
    res.wide = res.wide.slice(0, 8);
    return res;
  }, width);
  r.broken.forEach((s) => report("image did not load: " + s));
  r.wide.forEach((s) => report("wider than the screen: " + s));
  r.spill.forEach((s) => report("chart text outside its chart: " + s));
  // full page, cut into slices that are comfortable to read
  const full = path.join(out, `${name}-full.png`);
  await page.screenshot({ path: full, fullPage: true });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const slice = width > 600 ? 1600 : 2000;
  for (let y = 0, i = 0; y < h; y += slice, i++)
    await page.screenshot({ path: path.join(out, `${name}-${i}.png`), clip: { x: 0, y, width, height: Math.min(slice, h - y) }, fullPage: true });
  // every view of every switcher
  const panels = await page.$$("[data-switch]");
  for (let pi = 0; pi < panels.length; pi++) {
    const btns = await panels[pi].$$(".seg button");
    for (let bi = 0; bi < btns.length; bi++) {
      await btns[bi].click(); await page.waitForTimeout(150);
      await panels[pi].screenshot({ path: path.join(out, `${name}-switch${pi}-view${bi}.png`) });
    }
  }
  fs.rmSync(full);
  await page.close();
}
await browser.close();
server.close();
console.log(problems ? `${problems} problem(s); screenshots in tools/shots/` : "no problems found; screenshots in tools/shots/");
