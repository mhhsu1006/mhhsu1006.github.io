# Beginner Study Guide Skill

給本科初學者製作**讀得懂、推理一致、來源可核實**的複習講義，並修復容易造成困惑的舊講義。

## 檔案

- `SKILL.md`：核心工作流程與觸發條件。
- `references/quality-gates.md`：每章與全篇發布檢查。
- `references/repair-protocol.md`：舊講義的診斷與修復。
- `assets/source-map-template.md`：資料來源、先備關係、符號和模型登記。
- `assets/chapter-template.md`：理解版章節模板。
- `examples/economics-example.md`：不合格解釋與改寫對照。
- `references/evaluation-scenarios.md`：四種難題的預期處理方式。

## 安裝（Windows）

下載 ZIP，解壓後保留整個 `beginner-study-guide` 資料夾。

**Claude Code，全域使用**：放在

`C:\Users\<你的 Windows 使用者名稱>\.claude\skills\beginner-study-guide\SKILL.md`

**Codex，全域使用**：放在

`C:\Users\<你的 Windows 使用者名稱>\.agents\skills\beginner-study-guide\SKILL.md`

如果想限制在單一專案，分別使用專案根目錄的 `.claude/skills/beginner-study-guide/` 或 `.agents/skills/beginner-study-guide/`。

**ChatGPT**：這是標準 Agent Skills 檔案，並非安裝後就會自動進入所有 ChatGPT 對話。支援 Skill 的 ChatGPT 工作環境可用 `@skill-creator` 依這份 `SKILL.md` 建立，或在支援匯入 Skills 的介面加入。未安裝時，也可以在對話中附上整份 Skill 檔案，要求按照它處理教材。

## 觸發方式

- `用 beginner-study-guide skill 把這幾章 PPT 做成從零理解版，輸出簡體中文。`
- `用 beginner-study-guide 修復這份舊講義，優先查前後矛盾。`
- `按 beginner-study-guide 的核對流程，整理 ECO 2021 考前速查。`

## 實際使用的三個建議

1. 優先一起附上 PPT/講義、作業或歷屆考題，而不只告訴模型課程名稱。
2. 第一次先做一章，讓學生實際讀並答題；看不懂的地方直接圈出或截圖。
3. 只有確認理解版可信後，再產生考前精簡版。

本 Skill 不包含任何單一課程的固定知識與題庫，避免換課程時把不適用的假設帶入。
