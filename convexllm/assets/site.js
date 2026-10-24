// ConvexLLM project page
"use strict";

// Fill these in when the release is public; the buttons enable themselves.
const RELEASE = {
  code: null,   // e.g. "https://github.com/<org>/ConvexLLM"
  model: null,  // e.g. "https://huggingface.co/<org>/ConvexLLM-9B"
};

for (const [key, url] of Object.entries(RELEASE)) {
  const a = document.getElementById(`link-${key}`);
  if (!a || !url) continue;
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  a.removeAttribute("aria-disabled");
  a.querySelector("em")?.remove();
}

// ---------------------------------------------------------------- nav
const nav = document.querySelector(".topnav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 160);
addEventListener("scroll", onScroll, { passive: true }); onScroll();
const navLinks = [...document.querySelectorAll(".topnav-links a")];
const sections = navLinks.map((a) => document.querySelector(a.getAttribute("href")));
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting)
    navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
}, { rootMargin: "-40% 0px -55% 0px" });
sections.forEach((s) => s && io.observe(s));

// ---------------------------------------------------------------- BibTeX
const copyBtn = document.getElementById("copy-bib");
copyBtn?.addEventListener("click", async () => {
  const text = document.getElementById("bib-text").textContent;
  try { await navigator.clipboard.writeText(text); copyBtn.textContent = "Copied"; }
  catch { const r = document.createRange(); r.selectNodeContents(document.getElementById("bib-text"));
          getSelection().removeAllRanges(); getSelection().addRange(r); copyBtn.textContent = "Selected"; }
  setTimeout(() => (copyBtn.textContent = "Copy"), 1600);
});

// ---------------------------------------------------------------- table sort
const table = document.getElementById("results-table");
if (table) {
  const ths = [...table.tHead.rows[0].cells];
  ths.forEach((th, col) => th.querySelector("button").addEventListener("click", () => {
    const desc = th.getAttribute("aria-sort") !== "descending";
    ths.forEach((h) => h.setAttribute("aria-sort", "none"));
    th.setAttribute("aria-sort", desc ? "descending" : "ascending");
    const body = table.tBodies[0];
    const rows = [...body.rows];
    rows.sort((a, b) => {
      const x = a.cells[col].dataset.v, y = b.cells[col].dataset.v;
      const c = col === 0 ? x.localeCompare(y) : Number(x) - Number(y);
      return desc ? -c : c;
    });
    rows.forEach((r) => body.append(r));
  }));
}

// ---------------------------------------------------------------- C-Gate explorer
(function explorer() {
  const root = document.getElementById("explorer");
  const dataEl = document.getElementById("cgate-data");
  if (!root || !dataEl) return;
  const D = JSON.parse(dataEl.textContent);
  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent?.append(e); return e;
  };
  const svg = document.getElementById("ex-svg");
  const wave = document.getElementById("ex-wave");
  const audio = document.getElementById("ex-audio");
  const playBtn = document.getElementById("ex-play");
  const tOut = document.getElementById("ex-t");
  const topList = document.getElementById("ex-top");
  const restOut = document.getElementById("ex-rest");
  document.getElementById("ex-q").textContent = `“${D.question}”`;

  // layout
  const W = 760, H = 420, PAD = 34;
  const xs = D.tokens.map((t) => t[1]), ys = D.tokens.map((t) => t[2]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((W - 2 * PAD) / (x1 - x0), (H - 2 * PAD) / (y1 - y0));
  const ox = (W - s * (x1 - x0)) / 2, oy = (H - s * (y1 - y0)) / 2;
  const P = D.tokens.map((t) => [ox + (t[1] - x0) * s, H - (oy + (t[2] - y0) * s)]);

  const gHull = el("g", {}, svg);
  const hull = el("polygon", { class: "hull" }, gHull);
  const gSpokes = el("g", {}, svg);
  const gTok = el("g", {}, svg);
  const dots = P.map((p) => el("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 2.4, class: "tok" }, gTok));
  const trail = el("polyline", { class: "trail" }, svg);
  const spokes = Array.from({ length: 16 }, () => el("line", { class: "spoke" }, gSpokes));
  const gLab = el("g", {}, svg);
  const labels = D.landmarks.map((i) => {
    const t = el("text", { x: P[i][0].toFixed(1), y: (P[i][1] - 9).toFixed(1), "text-anchor": "middle", class: "lm" }, gLab);
    t.textContent = D.tokens[i][0].trim(); return t;
  });
  const z = el("circle", { r: 6.5, class: "z" }, svg);

  // positions
  const times = D.positions.map((p) => p[0]);
  const Z = D.positions.map(([, c]) => c.reduce((a, [i, w]) => [a[0] + w * P[i][0], a[1] + w * P[i][1]], [0, 0]));
  const idxAt = (t) => { let j = 0; while (j + 1 < times.length && times[j + 1] <= t) j++; return j; };
  const zAt = (t) => {
    if (t <= times[0]) return Z[0];
    const j = idxAt(t); if (j >= Z.length - 1) return Z[Z.length - 1];
    const u = (t - times[j]) / (times[j + 1] - times[j]);
    return [Z[j][0] + (Z[j + 1][0] - Z[j][0]) * u, Z[j][1] + (Z[j + 1][1] - Z[j][1]) * u];
  };
  const convexHull = (pts) => {
    const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length > 1 && cross(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.reverse()) { while (up.length > 1 && cross(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  };

  // waveform
  const NB = D.envelope.length, bw = 800 / NB;
  const bars = D.envelope.map((v, k) => {
    const h = Math.max(2, v * 50);
    return el("rect", { x: (k * bw + bw * .18).toFixed(2), y: (28 - h / 2).toFixed(2), width: (bw * .64).toFixed(2), height: h.toFixed(2), rx: 1 }, wave);
  });
  const head = el("line", { y1: 0, y2: 56, class: "head" }, wave);

  let prevCand = [];
  const shown = (tok) => (tok.startsWith(" ") ? "␣" + tok.slice(1) : tok);
  function render(t) {
    const j = idxAt(t);
    const cand = D.positions[j][1];
    prevCand.forEach((i) => { dots[i].classList.remove("cand"); dots[i].setAttribute("r", 2.4); });
    const zp = zAt(t);
    const wmax = Math.max(...cand.map((c) => c[1]));
    cand.forEach(([i, w], k) => {
      dots[i].classList.add("cand"); dots[i].setAttribute("r", 3.4);
      const l = spokes[k];
      l.setAttribute("x1", zp[0]); l.setAttribute("y1", zp[1]);
      l.setAttribute("x2", P[i][0]); l.setAttribute("y2", P[i][1]);
      l.setAttribute("stroke-width", (0.6 + 2.6 * w / wmax).toFixed(2));
      l.setAttribute("stroke-opacity", (0.15 + 0.55 * w / wmax).toFixed(2));
    });
    prevCand = cand.map((c) => c[0]);
    hull.setAttribute("points", convexHull(cand.map(([i]) => P[i])).map((p) => p.join(",")).join(" "));
    z.setAttribute("cx", zp[0]); z.setAttribute("cy", zp[1]);
    const past = Z.filter((_, k) => times[k] <= t).concat([zp]);
    trail.setAttribute("points", past.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "));
    labels.forEach((lab, k) => {
      const i = D.landmarks[k];
      if (past.some((p) => Math.hypot(p[0] - P[i][0], p[1] - P[i][1]) < 26)) lab.classList.add("on");
      else lab.classList.remove("on");
    });
    // side panel
    const top = [...cand].sort((a, b) => b[1] - a[1]).slice(0, 5);
    topList.innerHTML = top.map(([i, w]) =>
      `<li><span class="tk">${shown(D.tokens[i][0]).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span><span class="w">${w.toFixed(2)}</span><span class="wb"><i style="width:${(100 * w / top[0][1]).toFixed(1)}%"></i></span></li>`).join("");
    const rest = 1 - top.reduce((a, c) => a + c[1], 0);
    restOut.textContent = `${Math.max(0, rest).toFixed(2)}`;
    tOut.textContent = `${t.toFixed(2)} s`;
    // waveform
    const frac = Math.min(1, t / D.duration);
    bars.forEach((b, k) => b.classList.toggle("on", (k + 0.5) / NB <= frac));
    head.setAttribute("x1", 800 * frac); head.setAttribute("x2", 800 * frac);
    wave.setAttribute("aria-valuenow", Math.round(frac * 100));
  }

  // playback
  let t = times[D.focus] ?? times[0];
  let raf = 0;
  const setIcon = (playing) => {
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    playBtn.querySelector("svg").innerHTML = playing ? '<path d="M5.5 4h3v12h-3zM11.5 4h3v12h-3z"/>' : '<path d="M6.5 4.5v11l9-5.5z"/>';
  };
  const tick = () => { t = audio.currentTime; render(t); if (!audio.paused) raf = requestAnimationFrame(tick); };
  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      if (t >= D.duration - 0.05) t = 0;
      audio.currentTime = t; audio.play().then(() => { setIcon(true); raf = requestAnimationFrame(tick); }).catch(() => {});
    } else { audio.pause(); }
  });
  audio.addEventListener("pause", () => { cancelAnimationFrame(raf); setIcon(false); });
  audio.addEventListener("ended", () => { t = D.duration; render(t); setIcon(false); });

  const seek = (clientX) => {
    const r = wave.getBoundingClientRect();
    t = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * D.duration;
    if (!audio.paused) audio.currentTime = t;
    render(t);
  };
  let dragging = false;
  wave.addEventListener("pointerdown", (e) => { dragging = true; wave.setPointerCapture(e.pointerId); seek(e.clientX); });
  wave.addEventListener("pointermove", (e) => dragging && seek(e.clientX));
  wave.addEventListener("pointerup", () => (dragging = false));
  wave.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 0.08, ArrowLeft: -0.08, Home: -1e9, End: 1e9 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    t = Math.max(0, Math.min(D.duration, t + d));
    if (!audio.paused) audio.currentTime = t;
    render(t);
  });

  render(t);
})();
