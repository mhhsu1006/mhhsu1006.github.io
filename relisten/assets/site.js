// Project page behaviour: release links, nav, BibTeX copy, captions, view switchers.
// Project-specific interactives go at the end of this file.
"use strict";

// Release links. null hides the button, "soon" shows a disabled "soon" button,
// and a URL makes it a normal link. Keep null until the release is public.
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

// ---------------------------------------------------------------- BibTeX
const copyBtn = document.getElementById("copy-bib");
copyBtn?.addEventListener("click", async () => {
  const pre = document.getElementById("bib-text");
  try { await navigator.clipboard.writeText(pre.textContent); copyBtn.textContent = "Copied"; }
  catch {
    const r = document.createRange(); r.selectNodeContents(pre);
    getSelection().removeAllRanges(); getSelection().addRange(r); copyBtn.textContent = "Selected";
  }
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

// ---------------------------------------------------------------- segmented control
// segmented(box, [[value, label], ...], initial, onChange): accessible radio buttons
// with arrow-key support. Used by switchers below and by custom interactives.
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

// ---------------------------------------------------------------- view switchers
// Markup (charts pre-rendered at build time, one per view):
//   <div class="panel" data-switch>
//     <div class="panel-controls"><div class="ctl"><span class="ctl-l" id="b-l">Benchmark</span>
//       <div class="seg" role="radiogroup" aria-labelledby="b-l"></div></div></div>
//     <div class="panel-body">
//       <div data-view="SpeechMMLU">…</div><div data-view="BBH" hidden>…</div>
//     </div>
//   </div>
document.querySelectorAll("[data-switch]").forEach((panel) => {
  const views = [...panel.querySelectorAll("[data-view]")];
  const seg = panel.querySelector(".seg");
  if (!views.length || !seg) return;
  const show = (v) => views.forEach((d) => (d.hidden = d.dataset.view !== v));
  segmented(seg, views.map((d) => [d.dataset.view, d.dataset.label || d.dataset.view]), views[0].dataset.view, show);
  show(views[0].dataset.view);
});

// ---------------------------------------------------------------- project-specific interactives
// Read data embedded at build time:  const P = JSON.parse(document.getElementById("page-data").textContent);
