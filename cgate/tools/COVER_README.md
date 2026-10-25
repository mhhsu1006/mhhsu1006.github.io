# Is Text All You Need?（C-Gate）封面圖原始檔

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

四張圖會一起覆蓋，另外寫出 `tools/cover-thumb.png`（480×270），用來確認縮成小圖還看得懂。預覽建議用 `python3 -m http.server` 從這個資料夾根目錄開 `/tools/cover.html`，字型才會正確載入。想看某個版本，在網址後面加 `?video` 或 `?promo`。

## 版面內容

- 標題只放 "Is Text All You Need?"，副標是論文全名的後半段；沒有作者名、公式和 arXiv 字樣。
- 主圖由左到右：語音 frame → 對整個詞表（152,064 rows）打分 → 凍結的文字 embedding 表 → 每個 frame 選 16 個 row 做凸組合（Σ = 1）→ 和 prompt 一起送進 LLM，同時讀出 Transcript 和 Emotion。
- 宣傳版的數字帶：3.98% WER、84.3% 情緒準確率、16 個凍結 embedding、8.6% 可訓練參數，數字都來自論文。
- 字型：Source Serif 4（標題、數字）和 Inter（其他），在 `assets/fonts/`。logo 在 `assets/img/`。
