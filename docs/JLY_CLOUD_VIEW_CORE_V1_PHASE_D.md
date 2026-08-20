# JLY Cloud View Core V1｜Phase D

## 這一階段先不切正式 MyCar UI

檢查目前正式 `mycar.js` 後，確認「我的車」不只有 owner 車團，
還包含：

- 我主揪的
- 我是玩家
- linkedPlayerIds / Player Profile 歷史身分

目前正式流程在搜尋或「我是玩家」時會呼叫額外 Player 查詢。
因此如果只把 owner Cars 做成 View 就直接切 UI，
會造成玩家車團遺失。

Phase D 先把 MyCar View 提升成完整 Viewer Read Model。

## MyCar View V3

Collection：

`myCarViews/{viewerId}`

一份 document 包含這個使用者「我的車」真正需要的 compact cars。

每台摘要會保存：

- 基本車團資訊
- 日期 / 時間 / 狀態
- 店家 / 地點 / DM
- 人數規格
- 玩家最小摘要（只保留 ID / position / status）
- tags / scriptTags
- `isHost`
- `isPlayer`

目的：

使用者正常進「我的車」後，
所有：

- 全部
- 規劃中
- 開團中
- 已結束
- 我主揪的
- 我是玩家
- 搜尋
- 前端分頁

都可以在同一份 View 內完成。

## Bootstrap

新增：

`mycar-view-bootstrap.js`

這是**明確人工執行**的舊資料建置工具。

它只會：

1. query `ownerId == viewerId`
2. query 已存在的 `playerIds array-contains-any`
3. 合併
4. 寫成一份 `myCarViews/{viewerId}`

它明確禁止：

- `collection("cars").get()` 全掃
- `ensurePlayerIdsIndex()`
- legacy fallback 全掃 cars

所以 Bootstrap 可能有一次性 Reads，
但不會偷偷把整個 Cars Collection 掃一遍。

## Consistency Checker

新增：

`mycar-view-checker.js`

只在人工診斷時執行。

正常頁面不會呼叫。

## 為什麼還不切 UI

目前 Phase C 的 mutation coordinator 已能更新 owner MyCar View，
但「玩家被加入 / 移除 / linked identity」的所有 mutation path
還需要完整接入 Viewer View 更新。

如果現在直接切 UI，可能發生：

Core 玩家已加入
→ Player View 尚未同步
→ 玩家自己的「我的車」看不到新車

因此安全順序：

Phase D
→ 建完整 View + Bootstrap + Checker

Phase E
→ 接 Player/Application/Matching membership mutation
→ 確認所有 Viewer View 都會更新

Phase F
→ 正式 MyCar View-first
→ UI 不再讀 cars query

## 重要原則

View 不存在時：
**不允許 UI 自動掃 Core 建立。**

只顯示「整理資料尚未建立 / 需要明確建置」，
由 bootstrap / repair 工具處理。
