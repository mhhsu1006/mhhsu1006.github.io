# ReListen 專案網站

論文：ReListen: Training-Free Evidence Localization in Hour-Long Audio with Frozen Audio Language Models（arXiv 2611.04480）。

純靜態網站，直接放上 GitHub Pages 就能用，不需要 build。字型、數學式、影片、圖片都在 repo 裡，不依賴任何外部 CDN。

## 部署到 GitHub Pages

1. 把這個資料夾的所有內容（包含隱藏檔 `.nojekyll`）推到 repo 的根目錄。
2. GitHub → Settings → Pages → Source 選 **Deploy from a branch**，Branch 選 `main`，資料夾選 `/ (root)`。
3. 幾分鐘後網址會是 `https://<帳號>.github.io/<repo>/`。

所有路徑都是相對路徑，放在子路徑或自訂網域都可以用。

**分享預覽圖**：社群平台的預覽圖需要絕對網址。拿到最終網址後執行：
```sh
cd tools && npm install && SITE_URL="https://<帳號>.github.io/<repo>/" node build.mjs
```
再 commit 新產生的 `index.html`。

## 常改的地方

| 要改什麼 | 改哪裡 |
|---|---|
| Code 按鈕上線 | `assets/site.js` 最上面的 `RELEASE.code`。`null` 隱藏（目前的設定）、`"soon"` 顯示灰色的 soon、填 repo 網址就變成正常連結。ReListen 不需訓練，所以頁面上沒有 Weights 按鈕 |
| 論文連結 | `tools/build.mjs` 最上面的 `CONFIG.PAPER_URL`、`PDF_URL`（目前是 arXiv abs 和 pdf） |
| 標題區的 Preprint 標籤 | `tools/index.src.html` 的 `<p class="kicker">`，中了會議改成例如 `ACL 2027`，頁尾也一起改 |
| 文字、作者、段落 | `tools/index.src.html`，改完跑 `node build.mjs` |
| 結果數字、圖表 | `assets/data/results.json`（每個區塊都有 `_source` 註明論文出處），改完跑 `node build.mjs` |
| BibTeX | `assets/data/citation.bib`，改完跑 `node build.mjs` |
| 機構 logo | `assets/img/`，高度在 `tools/build.mjs` 的 `CONFIG.LOGOS` |
| 影片、字幕 | `assets/video/`：不燒字幕版 `relisten.mp4`、`relisten.en.vtt`、`poster.jpg`（由 `render_cover.mjs` 產生） |
| 架構圖（Figure 2） | `tools/build.mjs` 的 `methodDiagram()`，桌機橫向、手機直向各一張 SVG |
| Figure 1、掃描曲線、散點圖 | `tools/build.mjs` 的 `scanZoom()`、`scanFull()`、`costScatter()` |
| 封面圖 | `tools/cover.html`，改完跑 `node render_cover.mjs`（見下方） |

`index.html` 是 build 產生的，不要直接改它，改 `tools/index.src.html`。Build 時會用 KaTeX 預先渲染數學式，並產生所有圖表（桌機和手機各一版）。只有改內容時才需要 Node，部署本身不需要。

```sh
cd tools && npm install
node build.mjs            # 預覽
node check_page.mjs       # 桌機、手機截圖到 tools/shots/ 並自動檢查
STRICT=1 node build.mjs   # 交付前：還有待填的佔位文字或範例資料就失敗
```

## 封面圖

`tools/cover.html` 是 1920×1080 的 HTML 版面，數字和掃描曲線讀取 `assets/data/results.json`。同一個版面輸出兩個版本：
```sh
cd tools && npx playwright install chromium && node render_cover.mjs
```
- 影片封面（沒有下方數字帶）：`assets/video/poster.jpg`、`assets/img/cover-video.png`（3840×2160，上傳影片平台用）
- 宣傳封面（下方只留四個數字）：`assets/img/cover-threads.png`（3840×2160，Threads、X 貼文用）、`assets/img/social-card.png`（1200×630，連結預覽圖）

主圖由左到右四個元件：84 分鐘錄音和問題（和影片開頭同一題）、真實的逐窗分數曲線、選出的三個窗口和答案、VoiceGiraffe 的證據命中率。

## 影片字幕

字幕不用瀏覽器內建的樣式，而是由 `assets/site.js` 讀取 `.en.vtt`，用和影片燒錄字幕一樣的字型畫在影片上。右上角的 CC 按鈕可以關掉。想讓字幕預設關閉，把 `site.js` 裡的 `CAPTIONS_ON_AT_START` 改成 `false`。全螢幕播放時改由瀏覽器顯示字幕。

## 內容取捨

依「只呈現強項」原則，下面這些沒有放上網站，完整數字都在論文裡：

- **LongAudioSpan 的準確率比較**（Table 1）：在這個以「說了什麼」為主的資料集上，逐字稿類方法（reader transcript 59.6、Whisper 58.1、Echo-style 58.1）和完整錄音（54.6）都高於 ReListen（53.5）。網站只保留同樣一分鐘預算下贏過 uniform 8.5 分，並在表格說明指向 Table 1。
- **LAT-Bench 的 R@0.5、R@0.7**（Table 3）：Gemini-2.5-Pro 和 LAT-Audio 在這兩欄較高，整欄拿掉，只留 mIoU 和 R@0.3，說明文字指向 Table 3。
- **結果表沒有秒數欄**：單 GPU 時完整錄音（11.6 秒）比 ReListen（17.0 秒）快。效率改用 Figure 5 的散點圖呈現，每個 ReListen 點都比所有 text-mediated 系統更快也更準，ReListen-Fast 和四 GPU 版本也比完整錄音快。
- **Listening vs reading 的內容題數字**（Table 4）：VoiceGiraffe 內容題讀逐字稿略高（65.2 對 64.0），網站只寫「差兩分以內」，數字只放聲音題。
- **其他沒放的分析**：annotated evidence 上限（5.5 節）、證據分散在整段錄音的題目（5.6 節、Table 7）、各維度結果裡 localization 和 counting 的退步（Table 6）。
- **Occurrence 擴充是有監督的**（偵測器有訓練），網站標成 supervised extension，放在 Analysis 最後；影片不提。

## 哪些是真實資料、哪些是示意

- 真實：Figure 1（披薩辯論，84 分鐘測試錄音）和 Eye lecture（87 分鐘開發錄音）的每窗分數，是從論文 Figure 1 和 Figure 6 的向量圖抽出來的，精度約 0.02，算出的前三窗口和論文標示的位置一致（27:30、28:00、28:30 和 42.5、51.3、57.8 分鐘）。證據區間從圖上讀出。答案 5 和 4 來自論文。所有表格數字照抄論文，差值用論文報告的數字。
- 示意：架構圖和封面裡的波形。架構圖裡的小曲線是 Figure 1 真實曲線的縮小版。

## 本機預覽

```sh
python3 -m http.server 8000
# 開 http://localhost:8000
```

## 授權

Inter 和 Source Serif 4 都是 SIL Open Font License（見 `assets/fonts/`）；KaTeX 是 MIT。
