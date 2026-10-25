// C-Gate project page
"use strict";

// Release links. null hides the button, "soon" shows a disabled "soon" button,
// and a URL makes it a normal link.
const RELEASE = {
  code: null,   // e.g. "https://github.com/<org>/<repo>"  or  "soon"
  model: null,  // e.g. "https://huggingface.co/<org>/<model>"  or  "soon"
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

// ---------------------------------------------------------------- BibTeX
const copyBtn = document.getElementById("copy-bib");
copyBtn?.addEventListener("click", async () => {
  const text = document.getElementById("bib-text").textContent;
  try { await navigator.clipboard.writeText(text); copyBtn.textContent = "Copied"; }
  catch { const r = document.createRange(); r.selectNodeContents(document.getElementById("bib-text"));
          getSelection().removeAllRanges(); getSelection().addRange(r); copyBtn.textContent = "Selected"; }
  setTimeout(() => (copyBtn.textContent = "Copy"), 1600);
});

// ---------------------------------------------------------------- interventions
(function interventions() {
  const root = document.getElementById("iv");
  const dataEl = document.getElementById("iv-data");
  if (!root || !dataEl) return;
  const D = JSON.parse(dataEl.textContent);
  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent?.append(e); return e;
  };
  const svg = document.getElementById("iv-svg");
  const optBox = document.getElementById("iv-options");
  const explain = document.getElementById("iv-explain");
  const src = document.getElementById("iv-src");
  const tabs = [...root.querySelectorAll(".iv-controls button")];

  const byId = Object.fromEntries(D.bridge.map((b) => [b.id, b]));
  const audio = Object.fromEntries(D.audio.map((b) => [b.id, b]));
  const FAM = {
    weights: {
      label: "Mixture weights",
      opts: [["unchanged", "Learned weights"], ["uniform", "Exactly 1/16"]],
      def: "unchanged",
      get: (o) => byId[o],
      text: {
        unchanged: "The trained checkpoint. Weights inside each 16-row support are already close to uniform (normalised entropy 0.96–0.99).",
        uniform: "Keep the same 16 rows per frame but set every weight to exactly 1/16, so each bridge vector becomes the plain average of its rows. Both tasks lose only a little.",
      },
      src: "Table 17",
    },
    mapping: {
      label: "Key–value mapping",
      opts: [["unchanged", "Unchanged"], ["vperm", "Permute values"], ["kperm", "Permute keys"], ["gauss", "Gaussian values"]],
      def: "vperm",
      get: (o) => byId[o],
      text: {
        unchanged: "Each score retrieves the embedding row it was learned for.",
        vperm: "One random permutation of the rows that the selected indices retrieve. The set of vectors, and therefore the convex hull, is unchanged; only the score-to-vector correspondence is broken. Both tasks fail.",
        kperm: "Permute the rows the keys are projected from, so the scores select different entries while the values stay in place. Both tasks fail.",
        gauss: "Replace the embedding rows with Gaussian vectors matched to each dimension's mean and spread, which also changes the geometry. Both tasks fail.",
      },
      src: "Table 17",
    },
    order: {
      label: "Shuffle window",
      opts: D.shuffle.windows.map((w) => [w, w === "1" ? "1 (in order)" : w]),
      def: "4",
      get: (o) => { const i = D.shuffle.windows.indexOf(o); return { emotion: D.shuffle.emotion[i], wer: D.shuffle.wer[i] }; },
      text: (o) => o === "1"
        ? "Frames in their original order."
        : `Frames are permuted within non-overlapping windows of ${o === "Full" ? "the whole sequence" : o + " frames"}. Transcription depends on local order and breaks quickly; emotion degrades gradually and stays far above the majority class even under a full shuffle.`,
      src: "Table 18, mean of three seeds",
    },
    k: {
      label: "Support size k",
      opts: D.k.values.map((v) => [String(v), String(v)]),
      def: "1",
      get: (o) => { const i = D.k.values.indexOf(+o); return { emotion: D.k.emotion[i], wer: D.k.wer[i], d_e: D.k.d_e[i], d_w: D.k.d_w[i] }; },
      text: (o) => ({
        "1": "Keep only the single best row per frame. Both tasks need a mixture of several embeddings.",
        "4": "Four rows per frame: emotion recovers most of the way, transcription does not yet.",
        "8": "Eight rows per frame: emotion accuracy is unchanged, WER rises slightly.",
        "16": "The trained setting, k = 16.",
        "32": "Thirty-two rows per frame: WER is unchanged and emotion accuracy dips slightly.",
        "64": "Sixty-four rows per frame, four times the trained support.",
      })[o],
      src: "Table 19, model trained with k = 16",
    },
    stride: {
      label: "Pooling stride",
      opts: D.stride.values.map((v) => [String(v), String(v)]),
      def: "8",
      get: (o) => { const i = D.stride.values.indexOf(+o); return { emotion: D.stride.emotion[i], wer: D.stride.wer[i], d_e: D.stride.d_e[i], d_w: D.stride.d_w[i] }; },
      text: (o) => `Mean-pool the encoder output with stride ${o} instead of 4 (on average ${D.stride.frames[D.stride.values.indexOf(+o)]} bridge frames per utterance). ${o === "4" ? "The trained setting." : "Both tasks depend on the trained stride."}`,
      src: "Table 20, model trained with stride 4",
    },
    audio: {
      label: "Audio",
      opts: D.audio.map((a) => [a.id, a.label]),
      def: "zeros",
      get: (o) => audio[o],
      text: {
        orig: "The original recording.",
        zeros: "The waveform is replaced with silence. Emotion accuracy falls below the 23.7% share of the most frequent class and WER approaches 100%: both tasks depend on the acoustic input.",
        noise: "The waveform is replaced with Gaussian noise at its original level. Both tasks fail.",
      },
      src: "Table 16",
    },
  };
  // ---------------- schematic
  const HUES = ["#2456a6", "#3d8f6f", "#b4652d", "#6a55b5", "#2c7da0", "#b2456e", "#8a7a2b", "#4f6b8a", "#7a8f3d", "#a0522d", "#5b5bb0", "#2f8f8f"];
  const hash = (a, b) => { let h = (a * 73856093) ^ (b * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return Math.abs(h ^ (h >>> 16)); };
  const rowOf = (f, s) => hash(f + 1, s + 7) % 997;               // which embedding row a slot selects
  const colorOf = (row) => HUES[row % HUES.length];
  let W = 640;
  const TOPW = 18, WAVEH = 40, GY = 84, GH = 156;

  function shuffleOrder(n, win) {
    const idx = [...Array(n).keys()];
    if (win === "1") return idx;
    const w = win === "Full" ? n : +win;
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let a = 0; a < n; a += w) {
      const b = Math.min(n, a + w);
      for (let i = b - 1; i > a; i--) { const j = a + Math.floor(rnd() * (i - a + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    }
    return idx;
  }

  function draw(fam, opt) {
    svg.textContent = "";
    const narrow = svg.parentElement.clientWidth < 520;
    W = narrow ? 380 : 640;
    svg.setAttribute("viewBox", `0 0 ${W} 284`);
    const stride = fam === "stride" ? +opt : 4;
    const n = (narrow ? { 2: 12, 4: 6, 8: 3 } : { 2: 20, 4: 10, 8: 5 })[stride];
    const k = fam === "k" ? +opt : 16;
    const order = fam === "order" ? shuffleOrder(n, opt) : [...Array(n).keys()];
    const left = narrow ? 60 : 70, right = narrow ? 6 : 18, colW = (W - left - right) / n, pad = Math.min(8, colW * .18);

    // waveform
    let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const nb = narrow ? 60 : 96;
    for (let i = 0; i < nb; i++) {
      const x = left + (i + .5) * (W - left - right) / nb;
      let h = (Math.sin(Math.PI * (i + .5) / nb) ** .6) * (6 + 30 * rnd());
      if (fam === "audio" && opt === "zeros") h = 0;
      if (fam === "audio" && opt === "noise") h = 16 + 6 * rnd();
      el("line", { x1: x, x2: x, y1: TOPW + WAVEH / 2 - h / 2 - .75, y2: TOPW + WAVEH / 2 + h / 2 + .75, stroke: "#15203b", "stroke-width": 2.2, "stroke-linecap": "round" }, svg);
    }
    el("text", { x: 0, y: TOPW + WAVEH / 2 + 4, class: "note-t" }, svg).textContent = "speech";

    // frame columns
    el("text", { x: 0, y: GY + 12, class: "note-t" }, svg).textContent = "bridge";
    el("text", { x: 0, y: GY + 28, class: "note-t" }, svg).textContent = `${n} frames`;
    el("text", { x: 0, y: GY + 44, class: "note-t" }, svg).textContent = `k = ${k}`;
    const silent = fam === "audio" && opt !== "orig";
    for (let c = 0; c < n; c++) {
      const f = order[c];
      const x0 = left + c * colW + pad / 2, cw = colW - pad;
      const cellH = GH / k;
      const ws = [...Array(k)].map((_, s) => (fam === "weights" && opt === "uniform") ? 1 : .78 + .22 * ((hash(f, s) % 100) / 100));
      for (let s = 0; s < k; s++) {
        let keyRow = rowOf(f, s), valRow = keyRow;
        if (silent) keyRow = valRow = rowOf(0, s);                 // the same supports whatever the input
        if (fam === "mapping" && opt === "vperm") valRow = rowOf(f + 50, s + 31);
        if (fam === "mapping" && opt === "kperm") keyRow = valRow = rowOf(f + 90, s + 57);
        const y = GY + s * cellH, h = Math.max(.6, cellH - (k <= 16 ? 1.6 : k <= 32 ? .7 : .3));
        const wpx = cw * ws[s];
        const gauss = fam === "mapping" && opt === "gauss";
        el("rect", { x: x0, y, width: wpx, height: h, rx: k <= 16 ? 1.5 : 0, fill: gauss ? "#b7bec9" : colorOf(valRow), "fill-opacity": gauss ? .35 + .5 * ((hash(f, s) % 7) / 7) : .82 }, svg);
        if (k <= 16 && fam === "mapping" && opt !== "unchanged")
          el("rect", { x: x0, y, width: 3, height: h, fill: colorOf(keyRow) }, svg);
      }
      el("text", { x: x0 + cw / 2, y: GY + GH + 18, "text-anchor": "middle", class: "tick-t", "font-size": n > 10 ? 10 : 12 }, svg).textContent = f + 1;
    }
    if (fam === "order" && opt !== "1") {
      const w = opt === "Full" ? n : +opt;
      for (let a = 0; a < n; a += w) {
        const b = Math.min(n, a + w);
        const xa = left + a * colW + 2, xb = left + b * colW - 2, y = GY + GH + 28;
        el("path", { d: `M${xa} ${y - 4}v4H${xb}v-4`, fill: "none", stroke: "#97a1b1", "stroke-width": 1.3 }, svg);
      }
    }
    if (fam === "mapping" && opt !== "unchanged" && opt !== "gauss") {
      el("text", { x: W - right, y: GY - 8, "text-anchor": "end", class: "note-t" }, svg).textContent = narrow ? "stripe: row selected · fill: vector used" : "left stripe: row the score selects · fill: vector passed on";
    }
  }

  // ---------------- meters
  function meter(id, value, base, kind, given) {
    const m = document.getElementById(id);
    const s = m.querySelector("svg"); s.textContent = "";
    const X = (v) => kind === "emo" ? v / 100 * 220 : Math.min(1, Math.log10(Math.max(v, 1)) / Math.log10(500)) * 220;
    el("rect", { x: 0, y: 8, width: 220, height: 20, rx: 3, class: "track" }, s);
    el("rect", { x: 0, y: 8, width: X(value), height: 20, rx: 3, class: kind === "emo" ? "fill-emo" : "fill-wer" }, s);
    if (kind === "emo") el("line", { x1: X(D.majority), x2: X(D.majority), y1: 2, y2: 34, class: "maj" }, s);
    el("line", { x1: X(base), x2: X(base), y1: 2, y2: 34, class: "ref" }, s);
    m.querySelector("b").textContent = value.toFixed(2) + "%";
    const d = given ?? value - base;
    let foot = Math.abs(d) < 1e-9 ? "reference checkpoint" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(2)} points`;
    if (kind === "wer" && value > 100) foot += " · WER counts insertions";
    m.querySelector(".meter-foot").textContent = foot;
  }

  let fam = "weights", opt = FAM.weights.def;
  function update() {
    const F = FAM[fam];
    const r = F.get(opt);
    draw(fam, opt);
    meter("m-emo", r.emotion, D.baseline.emotion, "emo", r.d_e);
    meter("m-wer", r.wer, D.baseline.wer, "wer", r.d_w);
    explain.textContent = typeof F.text === "function" ? F.text(opt) : F.text[opt];
    src.textContent = `Dark tick: unchanged checkpoint (84.29%, 4.01%). Dashed: majority class (23.7%). WER bar on a log scale. Source: ${F.src}.`;
    optBox.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.opt === opt)));
  }
  function setFam(f) {
    fam = f; opt = FAM[f].def;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.fam === f)));
    optBox.innerHTML = `<span class="opt-label">${FAM[f].label}</span>` +
      FAM[f].opts.map(([v, l]) => `<button type="button" data-opt="${v}" aria-pressed="false">${l}</button>`).join("");
    optBox.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { opt = b.dataset.opt; update(); }));
    update();
  }
  tabs.forEach((t) => t.addEventListener("click", () => setFam(t.dataset.fam)));
  root.querySelector(".iv-controls").addEventListener("keydown", (e) => {
    const i = tabs.findIndex((t) => t.dataset.fam === fam);
    const j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (j === null) return;
    e.preventDefault(); const t = tabs[(j + tabs.length) % tabs.length]; t.focus(); setFam(t.dataset.fam);
  });
  setFam("weights");
  let lastNarrow = null;
  addEventListener("resize", () => {
    const nw = svg.parentElement.clientWidth < 520;
    if (nw !== lastNarrow) { lastNarrow = nw; update(); }
  }, { passive: true });
})();
