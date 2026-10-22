# 我的遊玩紀錄：正式儲存與安全驗收施工規格

狀態：PR #330 測試分支；**禁止直接寫入 Production**。此文件是實作門檻，不代表已完成。

## 已確認的正式既有能力
- `js/data-view/mycar-view.js`：`myCarViews`、schema v6，既有 MyCar Prepared View。遊玩紀錄只讀取，不修改車團。
- `js/core/identity.js`：既有 Player Identity，必須沿用，不得新增第二套 Person 或 Account。
- `firebase.json` 目前只有 `firestore.indexes.json` 設定，Repository 根目錄沒有 `firestore.rules`。因此**無法由此分支驗證正式資料庫安全規則**。

## 正式資料模型（提案，尚未建表）
- Source of Truth：每位玩家自己的歷史場次（穩定 sessionId、劇本、排定日期時間、原始日期、地點、來源、車團 ID、補登車友暱稱、Person 候選 ID、出席確認狀態、建立／修改時間）。
- 每筆歷史場次獨立 ID；同劇本同日期不合併。正式車團以原車團 ID 參照，不複製、覆蓋或假造 car/player。
- Person 候選 ID 僅為未驗證線索；驗證前不得用於正式 Person 關係、共同遊玩次數或身份認領。
- Prepared View：按 viewer 的完整遊玩紀錄快照，供手機一份文件讀取；寫入 Source of Truth 時同步更新對應快照。一般頁面不得掃描整個歷史紀錄 collection。
- 正式出席狀態必須與「時間已過」區分；未確認不得標示為已出席。

## 實作前必要關卡
1. 找出目前 Production Firestore 安全規則的**權威來源**，確認讀／寫只能由授權本人執行；不可僅相信瀏覽器 localStorage 的 currentPlayerId。
2. 審核現有 Player／Person canonical identity 與 alias 規則，確認 owner/viewer 綁定與跨身分存取。
3. 確認 Firestore Spark 免費額度下的單人快照大小與寫入頻率，避免每次編輯整庫掃描、避免單文件過大；必要時採固定分頁 Prepared View，不另建平行業務資料系統。
4. 實作寫入邊界的 Source of Truth + Prepared View 一致性處理，附失敗補償與受控覆寫前快照。正式導入前 dry-run。
5. 先使用測試資料驗證 CRUD、同名重刷、取消／退團、候選 Person、跨裝置讀取、權限拒絕、錯誤復原、手機版面；取得核准後才匯入歷史表格。
6. 經使用者另行核准後才合併 PR／部署／執行正式 Firestore 寫入。

## 現有 PR #330
- `pages/my-play-history.html` 仍為 localStorage 測試版。
- `myCarViews` 目前唯讀；不代表正式遊玩紀錄儲存完成。
- 備份 CSV 是人工備份，不等於 Firestore Prepared View 或正式災難復原。

## 驗收定義
- 未通過安全規則審查，不啟用正式寫入按鈕。
- 未確認本人真實身份，不讀取或改寫其他玩家的紀錄。
- 不刪除或自動合併同名場次，不自動認領 Person。
- 不合併、不部署、不寫 Production，直到明確核准。
