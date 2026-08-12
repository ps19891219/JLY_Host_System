# JLY Host System 開發工作規則

## Project Map 是專案導航基準

每次開始新的開發、除錯、重構或文件任務前，必須先完整閱讀：

- `docs/PROJECT_MAP.md`

先透過 Project Map 確認：

- 功能所在頁面與模組。
- Current、Transitional、Compatibility、Legacy Candidate 與 Backup 的分類。
- HTML 實際載入入口及模組依賴。
- Firebase、LINE、Google Calendar 與資料模型的關聯。
- 已知風險、待辦缺口及不可直接刪除的檔案。

## 修改後同步維護

如果任務造成以下任一變化，必須在同一任務中同步更新 `docs/PROJECT_MAP.md`：

- 新增、刪除、搬移或重新命名頁面、檔案、資料夾或模組。
- 改變 HTML 的 JavaScript／CSS 載入入口。
- 改變模組責任、依賴或 Runtime 狀態。
- 新增或修改 Firebase Collection、Document、重要欄位或關係。
- 新增或修改 LINE、Google Calendar、Vercel 或其他外部整合。
- 改變環境變數、角色、權限或主要設定。
- 確認某個檔案成為 Current、Transitional、Compatibility、Legacy、Deprecated 或 Backup。
- 發現新的已知問題、架構風險或重要待辦。

只修改文案、樣式細節或不影響架構的局部實作時，不必為了形式更新 Project Map。

## 準確性原則

- `PROJECT_MAP.md` 是導航基準，但不是程式執行結果的替代品。
- 文件與程式不一致時，先以實際檔案、HTML Runtime、程式依賴及 Git 現況查證。
- 查證後修正 Project Map，使它重新符合現況。
- 不可只因文件將檔案標為 Legacy 就直接刪除；刪除前仍須完成依賴稽核及必要測試。

## 任務完成檢查

完成涉及架構的任務前，確認：

1. 功能修改已驗證。
2. `docs/PROJECT_MAP.md` 已反映新現況。
3. 文件內沒有不存在或過期的關鍵路徑。
4. Git 變更範圍符合本次任務。
