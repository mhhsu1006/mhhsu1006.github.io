# Geometric Alignment without Functional Equivalence 封面圖原始檔

封面是一張 1920×1080 的 HTML 版面（`tools/cover.html`），用瀏覽器渲染成圖片。同一個版面輸出兩個版本，成品在 `assets/` 裡：

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

四張圖會一起覆蓋，另外寫出 `tools/cover-thumb.png`（480×270），用來確認縮成小圖還看得懂。中間的熱圖、margin 曲線和注意力會在渲染時讀取 `assets/data/results.json`，所以預覽要從這個資料夾根目錄開 http server（`python3 -m http.server`，再開 `/tools/cover.html`），直接用 `file://` 開會讀不到資料。想看某個版本，在網址後面加 `?video` 或 `?promo`。

## 版面內容

- 標題和副標是論文全名；沒有作者名、公式和 arXiv 字樣。
- 主圖由左到右：同一個問題的文字版（答 Canberra，對）和語音版（答 Sydney，錯），和影片開頭的示範例子一樣 → 兩條 layer 堆疊，第 10–21 層對齊 → Qwen2.5-Omni 在 BBH 上真實的跨層 CKA 熱圖和最佳對應路徑 → 晚期層 answer margin 分開、決策點的注意力在語音上很分散。問題和答案是示意，熱圖、曲線和注意力是論文的數據。
- 宣傳版的數字帶：12.8 points、10–21 層、+0.365 crossover、3.74× 注意力分散，數字都來自論文。
- 字型：Source Serif 4（標題、數字）和 Inter（其他），在 `assets/fonts/`。logo 在 `assets/img/`。
