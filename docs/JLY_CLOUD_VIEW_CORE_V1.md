# JLY Cloud View Core V1｜統一資料讀取骨架

## 核心原則

正常使用：
UI / LINE / Mobile
→ 讀 Cloud View Store

只有以下情況碰 Core：
- 建立
- 修改
- 刪除
- 狀態改變
- 舊資料 bootstrap
- repair / audit

一句話：

**資料改變時整理一次；沒改變就直接讀整理好的資料。**

## Core 與 View

Core 是唯一正式資料來源，例如：
- Car / Activity
- Person
- Membership
- Transaction
- Split
- Settlement
- Pending Action
- Reminder

View 是專供讀取的線上整理資料，不是第二份正式 Core。

## 首批 View

- Home View
- MyCar View
- Car Detail View
- Accounting View
- Pending Action View

## Mutation 流程

UI / LINE / API
→ Mutation Core
→ 更新正式 Core
→ 找出受影響 View
→ 只更新受影響 View

## Accounting 規則

正常顯示：
→ 讀 Accounting View

新增 / 修改 / Settlement / Pending Action 改變：
→ 更新正式 Core
→ 更新 Accounting View

禁止：
每次進帳務頁重新掃 accountingEntries / accountingSettlements / accountingPendingActions。

Full rebuild 僅限：
- bootstrap
- repair
- audit
- migration

## 讀取成本目標

不是要求所有頁面永遠 1 Read。

目標：
- 一個頁面主要讀一份或少數幾份已整理 View
- 讀取量不隨 Core 關聯數量一起膨脹

例如：
- MyCar page-1 → 1 page View
- Car Detail → 1 Detail View
- Accounting overview → 1 Accounting View
- Home → 1 Home View 或少數固定 View

## 開發期 Debug 規則

1. 先看程式
2. 再看 View
3. 再看 Builder / Mutation
4. 最後才看 Core

不要一有問題就直接掃 Firestore 正式資料。

## 建議路徑

js/data-view/
├─ view-core.js
├─ cloud-car-view.js
├─ mycar-view.js
├─ accounting-view.js
└─ home-view.js

後續可再拆：
services/view/
builders/
repositories/
repair/

## Phase Plan

### Phase A
- Cloud View Core 介面
- Car Detail Shadow Write
- Accounting 既有 View 對齊
- MyCar / Home Schema

### Phase B
- 接齊 Car mutation path
- 接齊 Accounting mutation path
- 建立 MyCar View Builder
- 建立 Home View Builder

### Phase C
- bootstrap 舊資料
- 驗證 Core / View 一致

### Phase D
- UI 改成 View-first
- MyCar
- Car Detail
- Accounting
- Home

### Phase E
- 移除 legacy 重複 query
- 補 Runtime Read Audit
