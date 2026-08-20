# JLY Cloud View Core V1｜Phase C

## 本階段真正降低哪種 Read

V1A 的直接 Car update 路徑：

Core update
→ `syncFromCore(carId)`
→ 再 `cars/{carId}.get()`
→ 更新 Car Detail View

Phase C 改成：

Core update
→ 使用畫面 / transaction 已知的 `beforeCar + updateData`
→ 更新受影響 View

因此：

**不再為了更新 View 額外讀一次同一台 Core Car。**

## 更新檔案

- `js/cardetail.js`
- `js/modules/car/detail/core/audit.js`

新增：

- `js/data-view/view-runtime-loader.js`

Runtime Loader 只載入程式模組，不是 Firestore document read。

## 已接路徑

目前 cardetail transitional runtime 的：

- 退回規劃
- 結束車團
- 取消車團
- Seat Slots 儲存
- 詳細頁單欄位直接修改

以及：

- `JLYAudit.updateCarWithAudit()`

都改成 Known Mutation → View Coordinator。

## MyCar 更新

若修改欄位會影響 MyCar：

- scriptName
- gameDate
- gameTime
- status
- studioName
- location
- ownerId

Coordinator 會更新該 owner 的 `myCarViews/{ownerId}`。

例如 Seat Slots 修改不影響 MyCar，就不更新 MyCar View。

## Accounting

這一階段不碰 Accounting Core。
現有 Accounting repository 已經在 mutation transaction 內維護 accountingViews，
避免把已經做對的地方重新改壞。

## 尚未切 UI

Phase C 仍然是 Shadow / Parallel。

目前：
- 正式頁面依舊可走舊讀取
- View 在修改時逐步保持最新

下一階段 Phase D 才做：

1. MyCar bootstrap
2. View consistency checker
3. MyCar View-first 讀取
4. Tab / search / pagination 全部使用同一份 MyCar View
5. fallback 不允許自動 full scan
