# PROJECT MAP｜Cloud View Store V1A Append

## 新增資料層

`js/data-view/cloud-car-view.js`

責任：
- `carDetailViews/{carId}` 的衍生 View 建立、讀取、更新與修復。
- View 不是正式 Car Core。
- 不允許 UI 直接修改 View 當作正式資料。

## V1A 狀態：Shadow Write

目前：
- 正式 Car 仍照原流程讀寫。
- `audit.js` 成功修改 Car + Audit 後，最佳努力同步 Car Detail View。
- `cardetail.js` 目前仍存在的五條直接 Car update 路徑，在修改成功後同步 View。
- View 同步失敗不得阻止正式 Car 修改。

尚未：
- `detail-loader.js` 尚未切換成 View-first。
- `mycar.js` 尚未切換 MyCar Page View。
- Player/Application/Matching 等其他 Car mutation path 尚待逐一接入共同 Mutation Core。

## 下一階段

1. 盤點剩餘 Car write path。
2. 全部接入 Car Mutation Core / Cloud View sync。
3. 建立一次性 bootstrap。
4. 驗證 View 與 Core 一致。
5. Detail Loader 改為優先讀 `carDetailViews/{carId}`。
6. 建立 MyCar Summary / Page View。
7. 最後移除 UI 直接大量 query 的 legacy 路徑。
