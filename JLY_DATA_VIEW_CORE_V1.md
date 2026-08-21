# JLY Data View Core V1

Firestore 是正式雲端資料與跨裝置同步來源，不是 UI 每次 render 的直接資料來源。

目標資料流：

UI
→ JLY Local / View Store
→ 必要時 Sync Layer
→ Firestore

My Cars：
- 20 台一頁的 View 先整理好。
- 本機保留 View。
- 進頁面先直接顯示本機 View。
- 只有 version 改變時才抓新的 View，不重新掃 cars。

Car Detail：
- 一台 Car 形成一份 prepared Car View。
- 劇本、日期、時間、店家、地點、玩家摘要、Staff 摘要等由 View 直接提供。
- 開頁面不重新分別 query 各欄位。

Change Manifest：
- revision
- myCarViewVersion
- changed car ids / versions
- version 相同時不重新下載。

Write Path：
1. 更新正式 Core
2. 更新受影響 View Snapshot
3. bump Change Manifest
4. 更新本機 View Store

View Snapshot 是衍生 View，不取代 Car / Person / Membership / Accounting 正式資料。
