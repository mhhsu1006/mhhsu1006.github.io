# 封面圖原始檔

封面是一張 1920×1080 的 HTML 版面（`tools/cover.html`），用瀏覽器渲染成圖片。已經輸出好的成品在 `assets/` 裡：

影片封面（沒有下方數字帶，主圖置中）：
- `assets/video/poster.jpg`：1920×1080，網站影片播放前的畫面
- `assets/img/cover-video.png`：3840×2160，上傳 YouTube、Bilibili 時的封面

宣傳封面（下方只留四個數字）：
- `assets/img/cover-threads.png`：3840×2160，Threads、X、LinkedIn 貼文用
- `assets/img/social-card.png`：1200×630，網站連結預覽圖

## 修改後重新輸出

```sh
cd tools
npm install
npx playwright install chromium
node render_cover.mjs
```

四張圖會一起覆蓋，另外寫出 `tools/cover-thumb.png`（480×270），用來確認縮成小圖還看得懂。
封面上的結果在渲染時讀取 `assets/data/results.json`，所以預覽要從這個資料夾根目錄開 http server（`python3 -m http.server`，再開 `/tools/cover.html`），直接用 `file://` 開會讀不到資料。想看某個版本，在網址後面加 `?video` 或 `?promo`。

## 版面規則

- 只放標題（短名大字、其餘當副標）；不放作者名、公式、arXiv 字樣。
- 主圖由 3 到 5 個不同的元件組成，由左到右用箭頭連起來；連接線不要穿過文字。
- 同一個版面出兩個版本：影片封面不放數字帶；宣傳封面在底部放四個代表性數字，不再加小圖。
- 字型：Source Serif 4（標題、數字）和 Inter（其他），在 `assets/fonts/`；logo 在 `assets/img/`。
