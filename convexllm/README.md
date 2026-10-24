# ConvexLLM project website

Live site: https://mhhsu1006.github.io/convexllm/

This folder is a self-contained static website. GitHub Pages serves the committed `index.html` and `assets/` from the personal website repository.

## Edit and build

Edit `tools/index.src.html`, `tools/partials/`, or `assets/style.css`. Results live in `assets/data/benchmark-results.csv`.

```sh
cd convexllm/tools
npm ci
npm run build
```

Commit the updated source and generated `convexllm/index.html`. The build defaults to the production URL. Override `SITE_URL` if deploying elsewhere.

Preview from the repository root with `python3 -m http.server 8000`, then open `http://localhost:8000/convexllm/`.

## Assets

Fonts, math SVGs, video, captions, and demo audio are local. `assets/site.js` contains release-link settings. Inter and Source Serif 4 licenses are included in `assets/fonts/`. KaTeX is MIT-licensed.
