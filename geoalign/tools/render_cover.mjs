// Render tools/cover.html in its two versions.
//   cd tools && npm install && npx playwright install chromium && node render_cover.mjs
// Video cover (no number band, figure centred in the space):
//   assets/video/poster.jpg        1920x1080, shown on the page before the video plays
//   assets/img/cover-video.png     3840x2160, thumbnail for YouTube / Bilibili uploads
// Promo cover (number band with the four numbers only):
//   assets/img/cover-threads.png   3840x2160, for Threads, X, LinkedIn posts
//   assets/img/social-card.png     1200x630, link preview (og:image)
// plus tools/cover-thumb.png (480x270 of the video cover) to check it still reads as a thumbnail.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const types = { ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/tools/cover.html`;

const browser = await chromium.launch();
// variant: "video" hides the band, "promo" keeps the numbers and hides the mini chart
async function shot(variant, viewport, scale, out, type = "png", card = false) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.title === "ready", null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(([v, card]) => {
    const c = document.getElementById("c");
    c.classList.add(v);
    if (card) { c.style.transformOrigin = "0 0"; c.style.transform = "scale(0.58333)"; c.style.marginLeft = "40px"; document.body.style.background = "#fff"; }
  }, [variant, card]);
  await page.waitForTimeout(200);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type, ...(type === "jpeg" ? { quality: 90 } : {}), clip: { x: 0, y: 0, ...viewport } });
  await page.close();
  console.log("wrote", path.relative(root, out));
}
const full = { width: 1920, height: 1080 };
await shot("video", full, 1, path.join(root, "assets/video/poster.jpg"), "jpeg");
await shot("video", full, 2, path.join(root, "assets/img/cover-video.png"));
await shot("promo", full, 2, path.join(root, "assets/img/cover-threads.png"));
await shot("promo", { width: 1200, height: 630 }, 1, path.join(root, "assets/img/social-card.png"), "png", true);
await shot("video", full, 0.25, path.join(here, "cover-thumb.png"));
const old = path.join(root, "assets/img/cover.png");
if (fs.existsSync(old)) fs.rmSync(old);          // replaced by cover-video.png and cover-threads.png
await browser.close();
server.close();
