// Geometric Alignment without Functional Equivalence: project page
"use strict";

// Release links. null hides the button, "soon" shows a disabled "soon" button,
// and a URL makes it a normal link.
const RELEASE = {
  code: null,   // e.g. "https://github.com/<org>/<repo>"  or  "soon"
};

for (const [key, url] of Object.entries(RELEASE)) {
  const a = document.getElementById(`link-${key}`);
  if (!a || !url) continue;
  a.hidden = false;
  if (url === "soon") {
    a.setAttribute("aria-disabled", "true");
    a.insertAdjacentHTML("beforeend", "<em>soon</em>");
  } else {
    a.href = url; a.target = "_blank"; a.rel = "noopener";
  }
}

// ---------------------------------------------------------------- nav
const nav = document.querySelector(".topnav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 160);
addEventListener("scroll", onScroll, { passive: true }); onScroll();
const navLinks = [...document.querySelectorAll(".topnav-links a")];
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting)
    navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
}, { rootMargin: "-40% 0px -55% 0px" });
navLinks.map((a) => document.querySelector(a.getAttribute("href"))).forEach((s) => s && io.observe(s));

// ---------------------------------------------------------------- BibTeX
const copyBtn = document.getElementById("copy-bib");
copyBtn?.addEventListener("click", async () => {
  const text = document.getElementById("bib-text").textContent;
  try { await navigator.clipboard.writeText(text); copyBtn.textContent = "Copied"; }
  catch { const r = document.createRange(); r.selectNodeContents(document.getElementById("bib-text"));
          getSelection().removeAllRanges(); getSelection().addRange(r); copyBtn.textContent = "Selected"; }
  setTimeout(() => (copyBtn.textContent = "Copy"), 1600);
});

// ---------------------------------------------------------------- captions
// The browser's own captions are hard to style, so the VTT is loaded as a metadata track
// and drawn by us over the video in the film's subtitle style. CC toggles them.
// In native fullscreen our overlay cannot show, so the browser's captions take over there.
const CAPTIONS_ON_AT_START = true;
document.querySelectorAll(".video-wrap").forEach((wrap) => {
  const video = wrap.querySelector("video"), out = wrap.querySelector(".cc span"), btn = wrap.querySelector(".cc-toggle");
  const meta = video?.querySelector("track[kind=metadata]");
  if (!video || !out || !meta) return;
  let on = CAPTIONS_ON_AT_START, native = null;
  const setBtn = () => { btn.setAttribute("aria-pressed", String(on)); wrap.classList.toggle("cc-off", !on); };
  const show = () => {
    const t = meta.track, cue = t.activeCues && t.activeCues[0];
    out.textContent = cue ? cue.text : "";
    out.parentElement.hidden = !cue;
  };
  const ready = () => { meta.track.mode = "hidden"; meta.track.addEventListener("cuechange", show); };
  meta.track.mode = "hidden";               // a hidden track still loads and fires cuechange
  meta.addEventListener("load", ready);
  if (meta.readyState === 2) ready();
  btn.addEventListener("click", () => { on = !on; setBtn(); if (native) native.mode = on ? "showing" : "disabled"; });
  const fs = (full) => {
    if (full && !native) {
      native = video.addTextTrack("captions", "English", "en");
      for (const c of meta.track.cues || []) native.addCue(new VTTCue(c.startTime, c.endTime, c.text));
    }
    if (native) native.mode = full && on ? "showing" : "disabled";
  };
  document.addEventListener("fullscreenchange", () => fs(document.fullscreenElement === video));
  video.addEventListener("webkitbeginfullscreen", () => fs(true));
  video.addEventListener("webkitendfullscreen", () => fs(false));
  setBtn(); show();
});

const P = JSON.parse(document.getElementById("page-data").textContent);
const NS = "http://www.w3.org/2000/svg";
const el = (name, attrs, parent) => {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.append(e); return e;
};
const txt = (parent, x, y, s, cls, anchor = "start", extra = {}) => {
  const t = el("text", { x, y, class: cls, "text-anchor": anchor, ...extra }, parent); t.textContent = s; return t;
};
function segmented(box, items, value, onChange) {
  box.innerHTML = "";
  const btns = items.map(([v, label]) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "radio"); b.dataset.v = v; b.textContent = label;
    b.addEventListener("click", () => { set(v); onChange(v); });
    box.append(b); return b;
  });
  const set = (v) => btns.forEach((b) => { const on = b.dataset.v === v; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
  box.addEventListener("keydown", (e) => {
    const i = btns.findIndex((b) => b.getAttribute("aria-checked") === "true");
    const j = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : null;
    if (j === null) return;
    e.preventDefault(); const b = btns[(j + btns.length) % btns.length]; b.focus(); b.click();
  });
  set(value);
}

// ---------------------------------------------------------------- CKA heatmap explorer
(function heatmap() {
  const svg = document.getElementById("hm-svg");
  if (!svg) return;
  const MODELS = ["Qwen2.5-Omni", "MiniCPM-o", "LLaMA-Omni", "Qwen2-Audio"];
  const BENCH = ["SpeechMMLU", "BBH"];
  const MODE = Object.fromEntries(P.modes.map((r) => [r[0], r[4]]));
  const DESC = {
    "Qwen2.5-Omni": "Speech reaches a broad band of high CKA with text in layers 10–21: several text layers match each speech layer about equally well. The late answer margins still depend on the route.",
    "MiniCPM-o": "Also a clear middle-layer band. In the late layers the text margin is clearly larger than the speech margin for the items that only text answers correctly.",
    "LLaMA-Omni": "Similarity is high across most layer pairs, and the best match collapses onto a few text layers (layer 15 for every speech layer on SpeechMMLU), so the correspondence is not layer-specific.",
    "Qwen2-Audio": "No high-similarity middle band. Row maxima stay at or below 0.07 on SpeechMMLU and 0.13 on BBH in speech layers 10–21, rising only in the last speech layers.",
  };
  let model = "Qwen2.5-Omni", bench = "BBH";
  const showPath = document.getElementById("hm-path");
  const read = document.getElementById("hm-read");
  const lut = P.viridis;
  const color = (v) => lut[Math.max(0, Math.min(lut.length - 1, Math.round(v * (lut.length - 1))))];

  // colour scale
  const sc = document.getElementById("hm-scale");
  const defs = el("defs", {}, sc), grad = el("linearGradient", { id: "vir", x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
  lut.forEach((c, i) => el("stop", { offset: i / (lut.length - 1), "stop-color": c }, grad));
  el("rect", { x: 0, y: 2, width: 220, height: 12, rx: 2, fill: "url(#vir)" }, sc);
  [0, .2, .4, .6, .8, 1].forEach((v) => txt(sc, v * 216 + 2, 30, String(v), "ax", v === 0 ? "start" : v === 1 ? "end" : "middle", { style: "font:400 11.5px Inter,sans-serif;fill:#8a92a1" }));

  function draw() {
    const key = `${model} · ${bench}`, M = P.cka[key], n = M.length, path = P.bestmatch[key];
    svg.textContent = "";
    const L = 46, T = 14, S = 474, c = S / n, R = L + S;
    const g = el("g", {}, svg);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const r = el("rect", { x: (L + j * c).toFixed(2), y: (T + i * c).toFixed(2), width: (c + .4).toFixed(2), height: (c + .4).toFixed(2), fill: color(M[i][j]), class: "cell" }, g);
      r.dataset.i = i; r.dataset.j = j;
    }
    el("line", { x1: L, y1: T, x2: R, y2: T + S, class: "diag" }, svg);
    if (showPath.checked) {
      let d = "";
      path.forEach((col, row) => {
        const x = L + (col + .5) * c, y = T + (row + .5) * c;
        if (row === 0) d += `M${x} ${y}`;
        else d += `V${y}H${x}`;
      });
      el("path", { d, class: "path-halo" }, svg);
      el("path", { d, class: "path" }, svg);
    }
    const step = n === 29 ? 7 : 8;
    for (let k = 0; k < n; k += step) {
      txt(svg, L + (k + .5) * c, T + S + 16, k, "ax", "middle");
      txt(svg, L - 7, T + (k + .5) * c + 4, k, "ax", "end");
    }
    txt(svg, L + S / 2, T + S + 36, "text layer", "ax-t", "middle");
    txt(svg, 12, T + S / 2, "speech layer", "ax-t", "middle", { transform: `rotate(-90 12 ${T + S / 2})` });
    const ph = P.phases[key];
    if (ph) ph.forEach(([a, b], k) => {
      const y0 = T + a * c, y1 = T + (b + 1) * c;
      el("line", { x1: R + 8, x2: R + 8, y1: y0 + 2, y2: y1 - 2, class: "phase-line" }, svg);
      txt(svg, R + 14, (y0 + y1) / 2 + 4, ["I", "II", "III"][k], "phase");
    });
    // side panel
    document.getElementById("hm-mode").innerHTML = `<span>${model} · ${bench}</span>${MODE[model]}`;
    document.getElementById("hm-desc").textContent = DESC[model];
    const mi = P.accuracy.models.indexOf(model);
    const accRow = (cls, label, v) => `<div class="acc-row ${cls}"><span class="acc-l">${label}</span><span class="acc-trk"><span style="width:${v}%"></span></span><b>${v.toFixed(1)}%</b></div>`;
    document.getElementById("hm-acc").innerHTML = `<p class="acc-t">Accuracy on ${bench}</p>` +
      accRow("t", "Text input", P.accuracy[bench].T2T[mi]) + accRow("s", "Speech input", P.accuracy[bench].S2T[mi]);
    read.innerHTML = "Hover over the map to read a cell.";
  }
  svg.addEventListener("pointermove", (e) => {
    const r = e.target.closest?.(".cell"); if (!r) return;
    const key = `${model} · ${bench}`, i = +r.dataset.i, j = +r.dataset.j;
    const best = P.bestmatch[key][i];
    read.innerHTML = `Speech layer <b>${i}</b> · text layer <b>${j}</b><br>CKA <b>${P.cka[key][i][j].toFixed(2)}</b>${best === j ? " · best match for this row" : ""}`;
  });
  segmented(document.getElementById("hm-model"), MODELS.map((m) => [m, m]), model, (v) => { model = v; draw(); });
  segmented(document.getElementById("hm-bench"), BENCH.map((b) => [b, b]), bench, (v) => { bench = v; draw(); });
  showPath.addEventListener("change", draw);
  draw();
})();

// ---------------------------------------------------------------- attention example
(function attention() {
  const box = document.getElementById("att-ex");
  if (!box) return;
  const names = Object.keys(P.attention);
  let cur = "Nutrition 177";
  const W = 340, H = 150, L = 34, Rr = 8, T = 26, B = 116;
  const frame = (svg, title, yTicks, yMax) => {
    svg.textContent = "";
    txt(svg, (L + W - Rr) / 2, 14, title, "panel-t", "middle");
    yTicks.forEach((v) => {
      const y = B - v / yMax * (B - T);
      el("line", { x1: L, x2: W - Rr, y1: y, y2: y, class: v ? "grid" : "axis" }, svg);
      txt(svg, L - 6, y + 4, String(v), "tick-t", "end", { style: "font-size:11px" });
    });
  };
  function draw() {
    const A = P.attention[cur];
    const X = (f) => L + f * (W - L - Rr);
    // text attention
    const st = document.getElementById("att-text");
    frame(st, "Text attention", [0, .5, 1], 1);
    el("polygon", { points: [[X(0), B], ...A.text.map(([f, v]) => [X(f), B - v * (B - T)]), [X(1), B]].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "), class: "area-text" }, st);
    txt(st, (L + W - Rr) / 2, B + 20, "text tokens", "note-t", "middle");
    // speech attention: stems on a ten-times smaller scale
    const ss = document.getElementById("att-speech");
    frame(ss, "Speech attention (×10 scale)", [0, .05, .1], .1);
    const g = el("g", { stroke: "#1f77b4", "stroke-width": 1.2 }, ss);
    A.speech.forEach(([f, v]) => { if (v > 0.0008) el("line", { x1: X(f), x2: X(f), y1: B, y2: B - Math.min(v, .1) / .1 * (B - T) }, g); });
    txt(ss, (L + W - Rr) / 2, B + 20, "speech frames", "note-t", "middle");
    // cumulative mass, x = sorted token fraction 0..0.5
    const sc = document.getElementById("att-cum");
    frame(sc, "Cumulative mass", [0, .5, 1], 1);
    const XC = (f) => L + f / .5 * (W - L - Rr);
    const y90 = B - .9 * (B - T);
    el("line", { x1: L, x2: W - Rr, y1: y90, y2: y90, stroke: "#b9c1cd", "stroke-dasharray": "2 3" }, sc);
    txt(sc, W - Rr, y90 + 13, "90%", "tick-t", "end", { style: "font-size:11px" });
    [["cum_speech", "#1f77b4"], ["cum_text", "#ff7f0e"]].forEach(([k, col]) => {
      const pts = A[k].filter(([f]) => f <= .5);
      el("polyline", { points: pts.map(([f, v]) => `${XC(f).toFixed(1)},${(B - v * (B - T)).toFixed(1)}`).join(" "), fill: "none", stroke: col, "stroke-width": 2 }, sc);
      const hit = pts.find(([, v]) => v >= .9);
      if (hit) el("line", { x1: XC(hit[0]), x2: XC(hit[0]), y1: y90, y2: B, stroke: col, "stroke-width": 1.3, "stroke-dasharray": "3 3" }, sc);
    });
    [0, .25, .5].forEach((f) => txt(sc, XC(f), B + 14, String(f), "tick-t", "middle", { style: "font-size:11px" }));
    txt(sc, (L + W - Rr) / 2, B + 30, "token fraction, sorted", "note-t", "middle");
    sc.setAttribute("viewBox", `0 0 ${W} ${H + 6}`);
  }
  // buttons show the subject only ("Nutrition 177" -> "Nutrition")
  segmented(box, names.map((n) => [n, n.replace(/\s+\d+$/, "")]), cur, (v) => { cur = v; draw(); });
  draw();
})();
