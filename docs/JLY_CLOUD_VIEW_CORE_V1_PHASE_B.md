# JLY Cloud View Core V1｜Phase B

## 為什麼繼續處理

目前 Firestore Usage 仍會出現單小時數千甚至更高的 Reads 尖峰。
因此配額恢復不視為問題已解決。

## Phase B 目的

建立「正式資料修改一次 → 只更新受影響 View」的共同機制。

新增：
- `view-impact-resolver.js`
- `view-mutation-coordinator.js`

更新：
- `mycar-view.js` V2

## MyCar View V2 的重要調整

Phase A 原本採每頁一份 View。

依目前 JLY Host System 的實際使用方式，V2 改成：

`myCarViews/{ownerId}`

一個使用者一份 compact index：

- all
- planning
- active
- done
- counts

例如目前 103 台車，正常情況下「我的車」只需要讀這一份 index。
Tab 切換與前端分頁可直接使用同一份已載入資料，不必再次碰 Firestore。

### 未來容量保護

如果單一使用者資料量成長到接近 document 容量安全門檻，
再升級成 chunked index。

不得等超限後才處理。

## Mutation 成本

例如改一台 Car：

Core Car update
→ Car Detail View write
→ MyCar View read 1 次
→ MyCar View write 1 次

這些成本只發生在「真的修改」時。

單純：
- 開頁
- 切 Tab
- 搜尋
- 前端翻頁

不應觸發 Core scan。

## Accounting

Accounting 已有 transaction 內的 accountingViews 增量更新。
Phase B 不重新發明帳務，也不重掃 accountingEntries。

Full rebuild 仍只允許 bootstrap / repair / audit。

## 下一階段

Phase C：
1. 把 Car 正式 mutation 入口接到 Coordinator
2. 移除修改後額外 `syncFromCore()` 的 Core Read
3. 建立 MyCar 舊資料 bootstrap 工具
4. 建立 View consistency checker
5. 不切 UI
