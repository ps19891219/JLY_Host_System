# JLY Cloud View Core V1｜Phase A

這一階段只建立共同 View 介面與 Schema，不切換正式 UI。

## 已建立

- `view-core.js`
- `mycar-view.js`
- `home-view.js`
- `accounting-view-adapter.js`

## MyCar View

Collection:

`myCarViews`

Document ID：

`{ownerId}__{tab}__page__{page}`

例如：

`abc123__planning__page__1`

一個 document 直接保存該頁需要的車團摘要。
使用者看 page 1 時，目標是只讀 page 1，不先掃全部 Cars。

### 重要

Phase A **沒有**在 `readPage()` 裡偷偷 fallback 去掃 `cars`。

View 不存在就回 `null`。

舊資料補建必須由之後的 bootstrap / repair 工具明確執行，
不能因為使用者開頁就偷偷重建。

## Home View

Collection：

`homeViews/{personId}`

目前只建立 envelope：

- `sections`
- `pendingSummary`

首頁卡片尚未正式定案，因此不提前把所有欄位寫死。

## Accounting

Accounting 不建立第二套正式帳務。

目前既有 repository 已經有：

`cars/{carId}/accountingViews/main`

以及 admin view。

Phase A 只建立 adapter，讓它未來可納入共同 View Core。

## 下一階段 Phase B

1. Car mutation 影響分析器
2. MyCar View 增量更新器
3. Car Detail View 註冊 View Core
4. Accounting mutation 對齊共同 affected-view 通知
5. Home View affected sections 更新器
6. 補測試
7. 仍然不切 UI

等 mutation path 接齊後，才進 bootstrap / repair。
