# JLY Host System｜Project Map

> Status: Working Map
>
> Version: V2.57
>
> Last Updated: 2026-08-14
>
> Source of truth: repository files and current HTML runtime references

---

## 0. 文件用途

本文件是 JLY Host System 的專案導航地圖，用來回答：

1. 專案目前有哪些頁面與模組。
2. 每個模組負責什麼。
3. 頁面實際載入哪些 JavaScript 與 CSS。
4. Firebase、LINE 與 Google Calendar 如何接入。
5. 哪些檔案屬於正式執行、過渡相容、舊版候選或備份。
6. 修改功能時應從哪個檔案開始。

本文件不是執行程式，也不是自動測試結果。若文件與程式不一致，以 HTML 實際載入、JavaScript 呼叫關係及 Git 現況為準。

---

## 1. 專案摘要

JLY Host System 是提供劇本殺／活動主揪使用的車團管理系統，主要功能包含：

- 建立、編輯、瀏覽及管理車團。
- 玩家資料、別名、身分與歷史參團關係。
- 車團報名、審核及個人招募分享頁。
- 座位配置、角色／位置安排、拖曳換位與規則檢查。
- 時間媒合、候選時段、成員投票及衝突分析。
- DM／Staff 配置。
- LINE 登入、Messaging API Webhook、群組綁定與文字回覆。
- Google Calendar 授權、活動建立、同步及衝突檢查。

目前架構為原生多頁式網站，前端使用 HTML、CSS、JavaScript 與 Firebase Compat SDK；伺服器端使用 Node.js CommonJS 模組。

---

## 2. 技術與執行環境

### 2.1 前端

- HTML 多頁面架構。
- 原生 JavaScript，以 `window.JLY*` 命名空間連接模組。
- CSS 共用元件加頁面專用樣式。
- Firebase Web Compat SDK `10.12.2`。
- Firestore 作為主要資料庫。

### 2.2 後端與整合

- Node.js CommonJS。
- `firebase-admin`：伺服器端 Firestore 存取。
- Vercel API Handler：LINE Webhook 入口。
- LINE Messaging API：Webhook 驗證及文字回覆。
- Google Identity Services／Calendar API：行事曆授權與同步。

### 2.3 套件與測試

`package.json` 目前依賴：

- `firebase`
- `firebase-admin`

目前沒有正式的建置指令。`npm test` 使用 Node.js 內建 Test Runner 執行 `tests/**/*.test.js`；目前已建立 LINE Event Router 的基礎測試。

---

## 3. 根目錄

```text
JLY_Host_System/
├─ api/                 Vercel API 入口
├─ assets/              正式圖像與靜態資產
├─ config/              常數、角色、權限與主題設定
├─ css/                 共用與頁面樣式
├─ docs/                工程文件
├─ firebase/            前端 Firebase 初始化
├─ js/                  前端功能與模組
├─ pages/               HTML 功能頁
├─ services/            LINE 與 Firebase 伺服器服務
├─ shared/              預留共用資源目錄
├─ index.html           首頁儀表板
├─ package.json         Node.js 套件資訊
├─ package-lock.json    套件鎖定檔
├─ project-files.txt    專案檔案快照
└─ project-tree.txt     專案樹狀快照
```

`images/` 與部分預留模組目錄目前沒有正式執行檔案，不應視為已完成模組。`assets/line/` 保存 LINE Rich Menu 正式圖像。

---

## 4. 頁面入口

| 頁面 | 用途 | 主要執行入口 |
|---|---|---|
| `index.html` | 首頁統計與導航 | `js/app.js` |
| `pages/mycar.html` | 我的車團、篩選與招募分享 | `js/mycar.js` |
| `pages/createcar.html` | 建立車團 | `js/createcar.js`、`js/core/identity.js` |
| `pages/editcar.html` | 編輯車團 | `js/editcar.js`、`js/seat.js` |
| `pages/car-detail.html` | 主揪車團詳情與管理 | Car Detail V3、Seat、Staff、Member Picker、Calendar、相容層 |
| `pages/car-view.html` | 玩家端車團資訊 | `js/car/car-view.js`、`js/car/car-view-render.js` |
| `pages/join.html` | 車團公開報名 | `js/join.js` |
| `pages/matching.html` | 主揪時間媒合 | `js/matching/` |
| `pages/matching-vote.html` | 參與者時段投票 | `js/matching/matching-vote.js` |
| `pages/recruit.html` | 個人招募公開頁 | `js/recruit/` |
| `pages/myprofile.html` | 我的玩家資料及 LINE | `js/myprofile.js`、`js/line.js` |
| `pages/players.html` | 玩家資料庫 | 目前引用不存在的 `js/players.js`，待修正 |
| `pages/database.html` | 舊資料庫頁面候選 | `js/database.js`，需再做 Runtime Audit |
| `pages/line-callback.html` | LINE 登入回呼 | `js/line-callback.js` |

---

## 5. 前端模組地圖

### 5.1 身分與個人資料

```text
js/core/identity.js
├─ 管理目前使用者身分
├─ 連結 Player Profile
├─ 維護 linkedPlayerIds
└─ 對外提供 window.JLYIdentity
```

相關檔案：

- `js/myprofile.js`
- `js/mycar.js`
- `js/car/car-relations.js`
- `js/player/line-account.js`
- `js/migrations/car-ownership-v1.js`

### 5.2 車團核心

`js/car/` 按責任拆分：

- `car-data.js`：車團 Firestore 讀寫。
- `car-actions.js`：車團操作。
- `car-create.js`：建立車團領域邏輯。
- `car-edit.js`：編輯車團領域邏輯。
- `car-list.js`：車團清單。
- `car-card.js`：車團卡片。
- `car-status.js`：車團狀態。
- `car-relations.js`：玩家與車團關係。
- `car-migration.js`：資料遷移／相容。
- `car-view.js`：玩家端頁面控制。
- `car-view-render.js`：玩家端頁面渲染。

子模組：

- `js/car/application/`：報名資料、操作與渲染。
- `js/car/history/`：車團歷史紀錄。
- `js/car/player/`：車團內玩家搜尋、編輯與渲染。
- `js/car/seat/`：新版座位引擎。

### 5.3 座位引擎

```text
Car / Players
    ↓
seat-data + seat-rules + seat-layout
    ↓
seat-assignment + seat-actions
    ↓
seat-board + seat-render + seat-controller
    ↓
drag / player-drag
    ↓
player-move-pipeline → player-move-executor
```

正式模組位於 `js/car/seat/`：

- `seat-data.js`
- `seat-rules.js`
- `seat-layout.js`
- `seat-assignment.js`
- `seat-actions.js`
- `seat-render.js`
- `seat-board.js`
- `seat-controller.js`
- `drag.js`
- `player-drag.js`
- `player-move-pipeline.js`
- `player-move-executor.js`

`js/seat.js` 仍由車團詳情、編輯及媒合頁載入，定位為 Compatibility Runtime，完成依賴稽核前不可刪除。

### 5.4 Car Detail V3

實際頁面入口：`pages/car-detail.html`。

新版模組位於 `js/modules/car/detail/`：

- `controller/`：載入、初始化、事件與頁面控制。
- `render/`：摘要、座位、歷史及整頁渲染。
- `player/`：搜尋、手動新增、編輯與玩家操作。
- `application/`：報名審核操作。
- `matching/`：媒合確認操作。
- `upgrade/`：舊資料升級與修復。

目前執行關係：

```text
pages/car-detail.html
├─ js/car/seat/*                         正式座位模組
├─ js/modules/core/upgrade/*             資料升級
├─ js/modules/member/picker/*            Member Picker
├─ js/modules/staff/*                    Staff
├─ js/seat.js                            相容層
├─ js/cardetail.js                       過渡 Runtime
└─ js/modules/car/detail/*               新版 Car Detail Runtime
```

狀態分類：

- `js/modules/car/detail/`：Current Runtime。
- `js/cardetail.js`：Transitional Runtime，仍在載入。
- `js/seat.js`：Compatibility Runtime，仍在載入。
- `js/car/car-detail.js`：Legacy Candidate，目前未見 HTML 載入。
- `js/cardetail-v2-backup-20260801.js.js`：Backup Only。

### 5.5 Member Picker

`js/modules/member/` 提供 Member 結構與選擇器：

- `member-schema.js`
- `member-data.js`
- `member-picker.js`
- `picker/picker-state.js`
- `picker/picker-storage.js`
- `picker/picker-data.js`
- `picker/picker-create.js`
- `picker/picker-render.js`
- `picker/picker-events.js`
- `picker/picker-controller.js`

目前主要由 Car Detail 的 Staff 與 Player 操作使用。

### 5.6 Staff

`js/modules/staff/`：

- `staff-data.js`
- `staff-render.js`
- `staff-actions.js`
- `staff-controller.js`

主要資料來源為 `car.staffSlots`，並與車團詳情、玩家視圖及時間媒合相連。

### 5.7 時間媒合

`js/matching/`：

- `matching-controller.js`：頁面控制與載入。
- `matching-data.js`：Firestore 讀寫。
- `matching-calendar.js`：日期選擇。
- `matching-conflict.js`：衝突分析。
- `matching-matrix.js`：成員與時段矩陣。
- `matching-render.js`：頁面渲染。
- `matching-actions.js`：互動操作。
- `matching-createcar.js`：由媒合結果建立正式車團。
- `matching-vote.js`：參與者投票頁。

核心資料流：

```text
car.players + car.staffSlots
        +
matching.candidateSlots + matching.responses
        ↓
Matching Matrix / Conflict
        ↓
selectedSlotId / create formal car
```

### 5.8 Google Calendar

`js/modules/calendar/`：

- `calendar-config.js`：Client ID、Scope、Calendar ID 與開關。
- `calendar-auth.js`：Google OAuth。
- `calendar-provider-google.js`：Calendar API 呼叫。
- `calendar-data.js`：車團 calendar 欄位。
- `calendar-sync.js`：建立、更新、刪除同步。
- `calendar-schedule-check.js`：行程衝突檢查。
- `calendar-detail-actions.js`：車團詳情操作。
- `calendar-controller.js`：功能設定與控制。

主要整合點為建立車團與車團詳情。同步功能應由設定開關控制，未授權時不可假設可用。

### 5.9 個人招募頁

`js/recruit/`：

- `recruit-controller.js`
- `recruit-data.js`
- `recruit-render.js`
- `recruit-tabs.js`
- `recruit-share-data.js`
- `recruit-share.js`

`pages/mycar.html` 管理分享連結；`pages/recruit.html` 透過 Token 顯示公開招募內容。

### 5.10 通知、報表與 Studio

- `js/notification/`：LINE 訊息、提醒、招募文字與通知設定。
- `js/report/`：車團、玩家、Studio 報表及匯出。
- `js/studio/`：Studio 資料、權限、車團、DM 行程與個人資料。

這三組已有實作檔案，但目前未全面確認 HTML Runtime 入口；修改前應先做依賴稽核。

---

## 6. LINE 架構

### 6.1 前端 LINE 登入

```text
js/line.js
    ↓ LINE Login
pages/line-callback.html
    ↓
js/line-callback.js
    ↓
Identity / Player Profile
```

`api/line-login.js` 會在伺服器端向 LINE 交換授權碼、取得已驗證的 LINE Profile，並把 `lineUserId` 寫入目前的 JLY Member。連結時會確認 Member 存在、裝置身分相符，且同一 LINE 不得連結到另一位 Member。

### 6.2 LINE Messaging API Webhook

```text
LINE Platform
    ↓ POST webhook
api/line-webhook.js
    ↓ 驗證 LINE_MESSAGING_CHANNEL_SECRET
services/line/event-router.js
    ↓
services/line/message-router.js
    ↓ 需要回覆時
services/line/line-reply.js
    ↓ LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
LINE Reply API
```

目前訊息路由只在使用者明確呼叫「小助手／JLY 小助手」時回應，普通群組訊息保持安靜。

### 6.3 LINE 群組綁定

```text
LINE groupId
    ↓
services/line/group-binding-service.js
    ↓
services/line/group-binding.js
    ↓
services/firebase/line-group-binding-repository.js
    ↓
Firestore
```

職責：

- `group-binding.js`：結構、正規化與驗證。
- `group-binding-service.js`：查詢綁定並回傳群組 Context。
- `line-group-binding-repository.js`：Firestore 讀寫及停用綁定。
- `services/firebase/admin.js`：Firebase Admin 初始化。

`services/line/group-binding-service.js` 已通過語法與 CommonJS 模組載入檢查。`event-router.js` 會在群組內明確呼叫小助手後查詢群組綁定；普通聊天、私人訊息及非文字訊息不會觸發群組查詢。查詢失敗時會記錄錯誤但保留原有小助手回覆，避免整批 Webhook 事件失敗。

伺服器環境變數：

- `LINE_MESSAGING_CHANNEL_SECRET`
- `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### 6.4 LINE 小助手按鈕選單

第一版 Rich Menu 提供三個可持續擴充的入口：

- `記帳` → 傳送 `JLY 記帳`
- `車團資訊` → 傳送 `JLY 車團資訊`
- `使用說明` → 傳送 `JLY 使用說明`

相關檔案：

- `assets/line/jly-assistant-rich-menu-v1.png`：2172 × 724 的三區選單圖片。
- `assets/line/jly-assistant-rich-menu-v1.jpg`：實際上傳 LINE 的壓縮版本，必須維持在 1 MB 以下。
- `scripts/setup-line-rich-menu.js`：建立、上傳並設為預設 Rich Menu 的設定程式。
- `api/setup-line-rich-menu.js`：受管理密碼與啟用開關保護的 Vercel 套用端點。
- `pages/setup-line-rich-menu.html`：手機可使用的一次性設定頁。
- `services/line/message-router.js`：處理三個入口事件。
- `tests/line/message-router.test.js`：入口路由測試。
- `tests/line/rich-menu.test.js`：選單區域與事件設定測試。
- `tests/line/setup-rich-menu-api.test.js`：部署端授權、停用與 Token 保護測試。

`npm run line:rich-menu` 預設只執行 Dry Run，不呼叫 LINE API。只有在明確核准且具備 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` 時，才可使用 `-- --apply` 將選單套用至 LINE Official Account。

部署端套用流程需要：

- `JLY_RICH_MENU_SETUP_SECRET`：由使用者自行設定的一次性管理密碼。
- `JLY_RICH_MENU_SETUP_ENABLED=true`：短期啟用套用端點。

手機設定頁只會把管理密碼放在 POST Body 送往同網域 API，不保存密碼，也不接觸或回傳 LINE Access Token。套用完成後必須將 `JLY_RICH_MENU_SETUP_ENABLED` 改為 `false` 並重新部署，停用管理端點。

Rich Menu 只顯示在 LINE Official Account 的一對一聊天室。群組內改用 LINE Quick Reply：使用者輸入 `JLY 小助手` 後，回覆 `記帳`、`提醒`、`車團資訊`、`使用說明` 四個按鈕，按鈕會在原群組送出對應的 `JLY ...` 指令，因此 Event Router 可保留該群組的 `groupId`。

群組快速選單相關檔案：

- `services/line/group-quick-menu.js`：建立四個 LINE Quick Reply message actions。
- `services/line/event-router.js`：只在群組呼叫小助手時傳送快速選單；一對一回覆維持原行為。
- `tests/line/group-quick-menu.test.js`：驗證四個按鈕的 LINE 訊息格式。
- `tests/line/event-router.test.js`：驗證群組綁定查詢順序與實際回覆 payload。

目前群組按鈕中的記帳已接入 Firebase；提醒排程與車團查詢仍只有入口及提示回覆，實際資料操作將在後續階段加入。

### 6.5 LINE 群組記帳

群組記帳第一版指令：

- `JLY 支出 350 聚餐飲料`
- `JLY 收入 1000 成員繳費`

群組帳本查詢指令：

- `JLY 今日帳目`：依台北時區查詢當日帳目、收支與結餘。
- `JLY 本月帳目`：依台北時區查詢本月帳目、收支與結餘。
- `JLY 帳本餘額`：查詢群組帳本建立至今的總收入、總支出與結餘。
- `JLY 最近帳目`：列出最近 10 筆帳目及可用於修改／刪除的八碼帳目編號。

今日與本月查詢最多列出最近 10 筆明細，但合計涵蓋查詢期間內全部帳目；沒有資料時回覆空帳本提示。所有查詢都只使用目前 LINE 群組的 `groupId`，私人聊天室不可查詢群組帳本。

資料路徑：

```text
cars/{carId}/accountingEntries/{LINE messageId}
```

正式帳本以 JLY `carId` 歸屬車團，LINE `groupId` 只保留來源資訊；LINE `messageId` 作為帳目文件 ID，讓同一則 Webhook 重送時不產生重複帳目。未綁定車團的 LINE 群組不能建立正式帳目。舊的 `lineGroupAccounts/{groupId}` 僅作為綁定時的一次性遷移來源。

相關檔案：

- `services/line/accounting-command.js`：解析與驗證群組記帳指令。
- `services/line/group-accounting-service.js`：將 LINE Event Context 轉為帳目資料。
- `services/firebase/line-group-accounting-repository.js`：寫入及按時間範圍查詢群組帳本 Firestore 路徑。
- `services/line/event-router.js`：限制只有群組可寫入並回覆記帳結果。
- `tests/line/accounting-command.test.js`：指令格式與金額測試。
- `tests/line/group-accounting-service.test.js`：群組識別與寫入資料測試。

帳目管理指令：

- `JLY 修改帳目 ABCD1234 支出 400 新說明`
- `JLY 刪除帳目 ABCD1234`
- `JLY 異動紀錄`：僅已驗證的主揪或系統管理者可查看最近 10 筆。

權限規則：

- 所有群組成員可新增及查詢帳目。
- 原記帳者可修改或刪除自己建立的帳目。
- 已完成 LINE 身分連結，且目前群組已綁定車團的車團 `ownerId`，可管理該群組全部帳目。
- 車團 `staffSlots` 中，欄位標籤明確包含主揪、協辦、管理、財務或會計，且選取正式 `memberId` 的成員，可管理該群組全部帳目。
- `players.roles` 含 `admin`、`administrator` 或 `system_admin` 的已連結使用者可管理全部帳目。
- 身分無法驗證時一律不提供提升權限。

權限只比對正式 Member／Player ID 與 LINE `lineUserId` 連結，不使用顯示名稱推測身分。一般 DM 或 Staff 不會因角色名稱以外的原因自動取得帳務管理權限。

刪除採軟刪除：帳目保留於 `entries`，標記 `status=deleted`，一般查詢不顯示。每次新增、修改、刪除都以 Firestore Transaction 同步寫入：

```text
cars/{carId}/accountingAuditLogs/{auditId}
```

稽核紀錄包含操作類型、帳目 ID、操作者 LINE userId、權限依據、修改前資料、修改後資料與時間。一般成員無法由 LINE 指令查看，主揪與系統管理者可使用 `JLY 異動紀錄`。

### 6.6 Accounting Core V1（施工中）

Accounting Core 定位為跨 Activity 的共用帳務領域，不是 LINE 或劇本村專用帳本。劇本車是第一個正式 Activity 實作，現階段停止擴充 LINE 帳務功能，既有 LINE Messaging API、Webhook、群組事件與 `groupId → carId` 綁定只保留為未來快速記帳入口。

核心模組：

- `services/accounting/transaction.js`：Transaction 標準結構；保留 `activityId`、`activityType`、`villageType`、`carId`，並分離 `createdBy` 與 `paidBy`。
- `services/accounting/split.js`：平均分帳、尾差及自訂金額合計驗證。
- `services/accounting/settlement.js`：付款申報、撤回、收款確認、退回與整筆結清判定。
- `services/accounting/pending-action.js`：依帳務狀態產生具責任人的待分帳、待付款、待確認收款與退回待辦。
- `services/accounting/compatibility.js`：將具正式身分的既有帳目原地映射成 Transaction，並為現行帳務快照提供暫時欄位別名。
- `services/firebase/activity-accounting-repository.js`：以同一個 Firestore Transaction 寫入正式 Transaction，並同步完成舊待辦、產生下一階段 Pending Action。
- `tests/accounting/accounting-core.test.js`：Accounting Core 純領域規則測試。

正式資料來源仍規劃沿用：

```text
cars/{carId}/accountingEntries/{transactionId}
```

既有文件將以同一文件原地補齊通用 Transaction 欄位，不建立「車團帳、個人帳、LINE 帳」等重複交易。個人家計簿與跨村總帳未來只建立查詢／聚合視圖。

劇本車第一版 Firestore 路徑：

```text
cars/{carId}/accountingEntries/{transactionId}
cars/{carId}/accountingPendingActions/{pendingActionId}
```

Pending Action 是流程與責任人資料，不是第二份金額來源。完成的待辦改為 `status=completed` 並保留 `history`，不刪除；Transaction 內只保存目前有效的 `pendingActionIds`，供低讀取量首頁摘要使用。

早期帳目若缺少正式 `createdBy`／`paidBy` Person ID，必須保留原資料並標記 `identity_resolution_required`；不可把 LINE userId 當作 Person ID，也不可用顯示名稱猜測。完成身分解析前不產生個人 Pending Action。

帳務參與者需由該 Activity 的正式關係合併取得：建立主揪、`players[]`、`staffSlots[]`。唯一識別使用正式 `memberId`／`playerId`／Person ID，顯示名稱只作快照與介面顯示。

---

## 7. Firebase 與資料地圖

### 7.1 前端入口

`firebase/firebase.js`：

- 初始化 Firebase Web App。
- 建立 `window.db` Firestore 實例。
- 提供 `saveCarToFirebase()`。
- 自動維護 `scripts`、`studios`、`dms` 主資料。

### 7.2 目前可確認的集合

- `cars`：車團核心資料。
- `players`：玩家與身分資料。
- `scripts`：劇本主資料。
- `studios`：工作室主資料。
- `dms`：DM 主資料。
- 玩家下的車團關係子集合。
- 個人招募分享 Token／Owner 資料。
- LINE 群組綁定資料。

部分集合名稱由常數或 Repository 動態提供，部署前應再與 Firestore Rules 及正式資料庫核對。

### 7.3 Car 概念模型

```text
Car
├─ scriptName
├─ gameDate / gameTime
├─ location
├─ organizer / owner identity
├─ capacity / position configuration
├─ allowCrossPlay
├─ note
├─ status
├─ players[]
├─ applications[]
├─ staffSlots[]
├─ matching
├─ calendar
├─ history[]
├─ createdAt
└─ updatedAt
```

### 7.4 Player / Member 概念模型

```text
Player Profile
├─ id / memberId
├─ displayName
├─ nickname
├─ aliases[]
├─ LINE linking fields
├─ linkedPlayerIds[]
└─ createdAt / updatedAt
```

工程方向是逐步以 `memberId` 作為人員唯一識別，將玩家、主揪、DM 與 Staff 視為共用 Member，再以參與關係、角色及權限區分；現有資料尚未保證全部完成統一。

### 7.5 Matching 概念模型

```text
matching
├─ candidateSlots[]
├─ responses
├─ selectedDates[]
├─ commonSlots[]
└─ selectedSlotId
```

參與者可能是 Player 或 DM／Staff，需保留 participant type、id、key 與顯示名稱。

---

## 8. CSS 地圖

### 8.1 全域

- `css/style.css`：主要全域樣式。
- `css/ui-system.css`：UI 系統。

### 8.2 共用元件

`css/components/`：

- `buttons.css`
- `cards.css`
- `forms.css`
- `modal.css`
- `navigation.css`
- `seat-engine.css`
- `status-tags.css`

### 8.3 頁面樣式

`css/pages/` 包含 Car Detail、Car View、Create Car、Edit Car、Matching、Matching Vote、Member Picker、My Car、Player、Recruit 與 Studio 等頁面樣式。

重複／過渡候選：

- `css/cardetail.css` 與 `css/pages/car-detail.css` 目前同時由 Car Detail 載入。
- `css/mycar.css` 與 `css/pages/mycar.css` 需確認實際入口後再整併。

---

## 9. Config

`config/`：

- `constants.js`：共用常數。
- `roles.js`：角色定義。
- `permissions.js`：權限定義。
- `theme.js`：主題設定。

目前部分前端頁面未直接載入這些 Config；它們可能是架構預備或由其他檔案內嵌相同概念，使用前需確認 Runtime Dependency。

---

## 10. Legacy、重複與風險清單

### 10.1 不可直接刪除

- `js/cardetail.js`：Car Detail 過渡 Runtime。
- `js/seat.js`：多頁共用的相容 Runtime。
- `css/cardetail.css`：Car Detail 仍有載入。

### 10.2 Legacy／Duplicate Audit 候選

- `js/cardetail-v2-backup-20260801.js.js`
- `js/car/car-detail.js`
- `js/app.js` 與 `js/common/app.js`
- `js/storage.js` 與 `js/common/storage.js`
- `js/utils.js` 與 `js/common/utils.js`
- `js/database.js`、`js/playerDatabase.js`、`js/player/player-database.js`
- `pages/database.html` 與 `pages/players.html`
- `css/cardetail.css` 與 `css/pages/car-detail.css`
- `css/mycar.css` 與 `css/pages/mycar.css`
- `js/car/application/` 與 `js/modules/car/detail/application/`
- `js/notification/` 與空的 `js/modules/notification/`
- `js/report/` 與空的 `js/modules/report/`
- `js/studio/` 與空的 `js/modules/studio/`

只有在完成以下檢查後才能標示 Deprecated 或刪除：

1. HTML `<script>`／`<link>` 載入。
2. JavaScript 全域函式與 `window.JLY*` 呼叫。
3. Firebase 資料讀寫依賴。
4. 桌面與手機主要流程測試。
5. Git Stable Point／可回復提交。

### 10.3 已確認的待辦缺口

- `pages/players.html` 引用 `/js/players.js`，但目前不存在該檔案；實際存在的是 `js/player.js`。
- LINE 登入後端已補齊；正式環境需設定 `LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET` 與 `LINE_REDIRECT_URI`。
- `ROADMAP.md`、`VERSION_HISTORY.md`、`CODING_RULE.md`、`DATABASE_RULE.md` 目前是空檔。
- 專案已有 LINE Event Router 基礎測試，但仍缺少完整整合測試與部署驗證指令。
- LINE 群組可由已連結 LINE 身分的車團建立主揪，以 `JLY 綁定車團 <carId>` 安全綁定；既有群組帳目會一次性遷移至車團帳本，同一群組不可直接覆蓋綁定到另一車團。

---

## 11. 功能修改入口

| 要修改的功能 | 建議先看 |
|---|---|
| 首頁統計 | `index.html`、`js/app.js` |
| 我的車團 | `pages/mycar.html`、`js/mycar.js`、`js/car/car-data.js` |
| 建立車團 | `pages/createcar.html`、`js/createcar.js`、Calendar 模組 |
| 編輯車團 | `pages/editcar.html`、`js/editcar.js`、`js/seat.js` |
| 車團詳情 | `pages/car-detail.html`、`js/modules/car/detail/`、`js/cardetail.js` |
| 座位與拖曳 | `js/car/seat/`、`js/seat.js` |
| 玩家端車團頁 | `pages/car-view.html`、`js/car/car-view*.js` |
| 報名 | `pages/join.html`、`js/join.js`、Car Detail application |
| 時間媒合 | `pages/matching*.html`、`js/matching/` |
| Staff／DM | `js/modules/staff/`、Member Picker |
| 玩家身分 | `js/core/identity.js`、`js/myprofile.js` |
| 個人招募 | `pages/recruit.html`、`js/recruit/` |
| Google Calendar | `js/modules/calendar/` |
| LINE 登入 | `js/line.js`、`js/line-callback.js` |
| LINE Bot | `api/line-webhook.js`、`services/line/` |
| Firebase Admin | `services/firebase/admin.js` |

---

## 12. 文件地圖

- `docs/PROJECT_MAP.md`：目前專案、Runtime、資料與風險總覽。
- `docs/PROJECT_STRUCTURE.md`：目錄分類與模組化原則。
- `docs/ENGINEERING_STANDARD.md`：工程方向與 Member 身分原則。
- `docs/CODING_RULE.md`：預留，尚未撰寫。
- `docs/DATABASE_RULE.md`：預留，尚未撰寫。
- `docs/ROADMAP.md`：預留，尚未撰寫。
- `docs/VERSION_HISTORY.md`：預留，尚未撰寫。

---

## 13. Git 與維護規則

- 儲存庫使用 Git，主要分支為 `main`。
- 遠端為 GitHub `PS19891219/JLY_Host_System`。
- 每次架構、檔案或 Runtime 入口改動後，應同步更新本文件。
- 每次清理 Legacy 前，先建立可回復的 Git Stable Point。
- 不應把「資料夾存在」視為「功能已完成」。
- 不應把「文件標為 Legacy」視為可安全刪除，必須以依賴稽核與流程測試確認。

---

## 14. 建議下一步

1. 修正 `pages/players.html` 的 Script 入口並驗證玩家資料庫。
2. 經使用者核准後，將 JLY Rich Menu 套用至 LINE Official Account 並用手機驗證。
3. 定義記帳資料模型、權限與第一版操作流程。
4. 為 LINE Webhook／Group Binding 增加 Firebase Repository 與 Webhook Handler 整合測試。
5. 定義已綁定車團後可執行的 LINE 業務指令與權限規則。
4. 建立 Firestore Collection 與 Security Rules 的正式文件。
5. 完成 Car Detail Transitional Runtime 依賴稽核。
6. 補寫 Coding Rule、Database Rule、Roadmap 與 Version History。

---

## 15. 更新紀錄

### V2.0｜2026-08-12

- 依照實際專案檔案與 HTML Runtime 重新建立。
- 移除舊版文件中的重複段落。
- 補入 LINE Webhook、Reply、Message Router 與 Group Binding 架構。
- 補入 Firebase Admin 與伺服器環境變數。
- 修正不存在的 `api/line-login.js` 描述。
- 明確區分 Current、Transitional、Compatibility、Legacy Candidate 與 Backup。
- 記錄玩家資料庫入口缺檔、空文件及未追蹤檔案。

### V2.1｜2026-08-12

- 確認 `services/line/group-binding-service.js` 通過語法與模組載入檢查。
- 將 Group Binding Service 標示為已完成、尚未接入 LINE Runtime 的基礎模組。

### V2.2｜2026-08-12

- 將 Group Binding Service 接入 LINE Event Router。
- 限制只有群組內明確呼叫小助手時才查詢群組綁定。
- 查詢失敗時採降級處理，避免中斷既有小助手回覆。
- 新增 Node.js Test Runner 與 LINE Event Router 基礎測試。

### V2.3｜2026-08-12

- 新增 JLY 小助手三按鈕 Rich Menu 圖像與安全設定程式。
- 新增記帳、車團資訊及使用說明三個可擴充入口。
- 設定程式預設採 Dry Run，避免未授權修改 LINE Official Account。
- 新增 Message Router 與 Rich Menu 自動測試。

### V2.4｜2026-08-12

- 新增 1 MB 以下的 LINE Rich Menu JPEG 上傳資產與大小測試。
- 新增受管理密碼與啟用開關保護的 Vercel 套用 API。
- 新增可從手機操作的一次性 LINE 選單設定頁。
- 確保伺服器端 LINE Token 不會回傳至前端。

### V2.5｜2026-08-12

- 新增群組專用的四按鈕 LINE Quick Reply 選單。
- 使用者在群組呼叫 `JLY 小助手` 時，保留目前 `groupId` 並顯示記帳、提醒、車團資訊及使用說明入口。
- 一對一聊天室維持原本回覆，正常群聊仍不查詢 Firebase、不觸發小助手。
- 新增群組快速選單與 Event Router payload 自動測試。

### V2.6｜2026-08-12

- 新增 LINE 群組收入與支出文字指令。
- 新增按 `groupId` 分帳、按 LINE `messageId` 防重複的 Firestore 帳目結構。
- 保存記帳者 LINE userId、金額、說明、類型及建立時間。
- 私人聊天室不可寫入群組帳本；格式錯誤時提供正確輸入範例。
- 新增群組記帳指令、服務與 Event Router 自動測試。

### V2.7｜2026-08-12

- 新增今日帳目、本月帳目與帳本餘額三個群組查詢指令。
- 日與月的範圍依台北時區計算，不受 Vercel 執行區域影響。
- 查詢回覆包含總收入、總支出、結餘及最近帳目。
- 查詢僅限目前 LINE 群組，空帳本與私人聊天室有明確提示。
- 補充記帳入口與使用說明中的查詢指令。

### V2.8｜2026-08-12

- 新增最近帳目、修改帳目、刪除帳目及管理者異動紀錄指令。
- 原記帳者可管理自己的帳目；已驗證主揪與系統管理者可管理群組全部帳目。
- 刪除改採軟刪除，所有新增、修改與刪除以 Transaction 保存不可省略的異動快照。
- 新增 LINE 身分、車團 ownerId 與系統角色的後端權限解析。
- Webhook 重送不會重複建立帳目或新增稽核紀錄。

### V2.9｜2026-08-12

- 將帳務管理權限接入車團頁 `staffSlots` 的正式 Member 選擇結果。
- 主揪、協辦、管理、財務及會計標籤可授予該車團群組帳務管理權限。
- 一般 DM／Staff 不會自動取得帳務管理權限。
- 權限僅比對 LINE `lineUserId`、Player／Member ID、車團 ownerId 與設定角色，不以顯示名稱猜測。

### V2.10｜2026-08-12

- JLY 車團成為正式帳務資料來源，LINE 僅作為記帳、查詢及管理入口。
- 正式帳目與稽核紀錄改存於 `cars/{carId}` 的子集合。
- 新增主揪限定的 `JLY 綁定車團 <carId>` 指令，並防止既有群組綁定被直接覆蓋。
- 群組首次綁定時會把舊 LINE 群組帳目一次性遷移到車團，保留來源與稽核紀錄。
- 車團詳細頁新增「複製 LINE 群組綁定指令」按鈕，方便手機貼到 LINE 群組。

### V2.11｜2026-08-12

- 新增 `/api/line-login` 後端，完成 LINE OAuth 授權碼交換與 Profile 驗證。
- LINE 驗證成功後，會正式把 `lineUserId` 寫入目前的 JLY Member。
- 阻止同一個 LINE 帳號重複連結到不同 Member，並檢查目前裝置身分。
- 回到「我的資料」後顯示身分連結成功提示，之後可進行 LINE 群組車團綁定。

### V2.12｜2026-08-12

- 首頁新增「登入／找回我的身分」入口，手機可直接進入 LINE 身分流程。
- 「我的車」缺少本機身分時顯示明確說明與登入按鈕，不再只顯示空白內容。
- 已連結 LINE 的 JLY Member 可在 LINE 內建瀏覽器或新裝置重新登入並恢復 Member ID。
- 第一次連結仍須由原本持有該 JLY Member 的瀏覽器確認，避免以名稱冒領他人身分。

### V2.13｜2026-08-12

- LINE OAuth state 除原本瀏覽器儲存區外，另寫入 10 分鐘短效 Secure Cookie。
- LINE 內建瀏覽器完成授權跳轉後，可使用 Cookie 驗證原始登入請求。
- state 驗證完成或失敗後立即清除 Cookie，保留防止登入冒用的安全檢查。

### V2.14｜2026-08-12

- 新增 `/api/line-login-state`，登入前由 JLY 後端簽發 10 分鐘有效的 LINE OAuth state。
- 簽章內容包含 Member、JLY Identity 與安全返回路徑，手機端無法竄改。
- `/api/line-login` 會在交換 LINE 授權碼前驗證簽章與期限。
- 登入流程不再依賴 LINE 內建瀏覽器、Safari 或其他授權視窗之間共享儲存區或 Cookie。

### V2.15｜2026-08-12

- 「我的車」登入按鈕會帶入安全返回路徑 `/pages/mycar.html`。
- LINE 登入前將原始目標頁寫入後端簽章，成功後直接返回「我的車」。
- 返回路徑僅允許站內絕對路徑，避免被利用跳轉至外部網站。

### V2.16｜2026-08-12

- LINE 群組綁定的建立主揪檢查新增 Member `identityId` 比對。
- 相容較早建立、以 JLY Identity ID 寫入 `cars.ownerId` 的既有車團。
- 不需改寫舊車團 ownerId，即可由已連結 LINE 的原建立主揪安全綁定。

### V2.17｜2026-08-12

- 帳務管理權限解析新增 Member `identityId` 比對，與群組綁定使用相同身分鏈。
- 舊車團建立主揪可查看帳目異動紀錄，並管理車團內所有帳目。
- 修改與刪除仍保留完整稽核紀錄，一般成員權限不變。

### V2.18｜2026-08-12

- 新帳目稽核紀錄新增 `actorMemberId` 與操作當時的 `actorDisplayName`。
- 查詢舊異動紀錄時，會以 `actorUserId` 補查目前綁定的 JLY Member 名稱。
- LINE 畫面優先顯示操作者名稱；查不到名稱時才顯示縮短的 LINE ID，完整 ID 仍保留於後端。

### V2.19｜2026-08-12

- `JLY 異動紀錄` 顯示台北時間、操作類型、操作者名稱與帳目短編號。
- 新增與刪除顯示收入／支出、金額及說明。
- 修改紀錄同時顯示修改前與修改後內容，方便追蹤差異。

### V2.20｜2026-08-12

- 每台車新增單一帳務快照 `cars/{carId}/accountingViews/current`。
- 一份快照包含總收入、總支出、結餘、有效帳目數、最近 20 筆帳目及最近 10 筆異動。
- 新增、修改與軟刪除會在同一個 Firestore Transaction 內同步更新正式帳目、稽核及快照。
- 舊車團第一次使用快照時會由既有正式帳目建立一次，之後不再為顯示總額反覆讀取全部帳目。

### V2.21｜2026-08-12

- 一般帳務快照 `cars/{carId}/accountingViews/current` 包含收入、支出、結餘、最近 20 筆登記資料，以及每位成員的已付、應分攤、應收／應付。
- 成員結算金額獨立累計，不受最近 20 筆顯示上限影響；更早的有效帳目仍會計入總額。
- 管理者異動快照拆分至 `cars/{carId}/accountingViews/admin`，一般成員快照不包含稽核紀錄或 LINE 內部使用者 ID。
- 正式帳目與完整異動紀錄仍保留在原本集合，快照只負責低讀取量的頁面顯示。

### V2.22｜2026-08-12

- 一般成員與主揪查看相同的帳務摘要；主揪仍可修改或刪除車團帳目。
- 完整帳目異動紀錄改為僅系統管理者可查詢，主揪、財務人員及一般成員均不載入管理快照。
- 帳務發生爭議時，由系統管理者調閱操作者、操作時間及修改前後內容。

### V2.23｜2026-08-12

- LINE 群組新增帳目成功後，回覆會顯示八碼帳目編號，供後續修改或刪除指令直接使用。

### V2.24｜2026-08-12

- 車團頁面改為產生六碼、10 分鐘有效且只能使用一次的 LINE 群組配對碼，不再暴露或要求手動輸入車團資料 ID。
- 配對碼貼入群組後先顯示劇本與日期，必須由建立主揪點擊確認才正式建立「LINE 群組 → JLY 車團」綁定。
- 配對確認限制在最初提出配對的群組及主揪；過期、已使用、取消或在其他群組確認均會被拒絕。

### V2.25｜2026-08-12

- 車團頁面複製的 LINE 配對指令會同時顯示劇本名稱及六碼配對碼，例如 `JLY 綁定《劇本名稱》 A7K9P2`。
- 劇本名稱方便主揪辨識，系統仍以一次性配對碼精準定位車團，避免同名劇本造成錯誤綁定。

### V2.26｜2026-08-13

- LINE 群組輸入 `JLY 小助手` 後改為傳送可保留於聊天紀錄的 Flex 車團首頁卡片，不再以點擊後消失的 Quick Reply 作為主要入口。
- 首頁卡片顯示綁定車團的劇本名稱與日期，提供帳務、車團資訊、成員座位、提醒、通知及使用說明六個入口。
- 點擊「車團帳務」會開啟第二層 Flex 帳務卡片，提供新增分帳、帳目總覽、我的應收／應付及我的帳目。

### V2.27｜2026-08-13

- LINE 群組綁定成功訊息改為顯示劇本名稱，並提示輸入 `JLY 小助手` 開啟該車專屬功能選單。
- 群組帳目遷移屬於系統內部處理，不論數量多少都不顯示給玩家；結果仍保留在後端供系統管理者追蹤。
- 玩家畫面只顯示綁定結果與下一步操作，不顯示內部 ID 或處理細節。

### V2.28｜2026-08-13

- LINE 車團帳務卡片的「帳目總覽」改為讀取 `cars/{carId}/accountingViews/current` 單一摘要文件。
- 顯示總收入、總支出及結餘時不再掃描正式帳目集合，讀取量不會隨帳目筆數增加。

### V2.29｜2026-08-13

- LINE 群組的使用說明簡化為玩家需要知道的內容：透過「車團帳務」新增此劇本帳目。
- 不再向玩家列出內部文字指令、今日／本月等系統操作細節。

### V2.30｜2026-08-13

- LINE 車團首頁卡片按鈕改為直接開啟同一個手機版車團小助手頁面，不再送出中間文字指令或產生第二張卡片。
- 操作頁以車團、帳務、成員及通知分頁切換；帳務總覽使用單一摘要文件。
- 入口網址包含簽章後的群組與車團對照，後端會再次確認有效綁定；解除綁定後舊公告連結會失效。

### V2.31｜2026-08-13

- 車團小助手操作頁新增安全分帳表單，可填寫收入／支出、金額、說明、付款人與平均分攤成員。
- 寫入前要求已連結的 LINE Member 工作階段，後端再驗證群組綁定與車團成員身分，避免共用連結被冒用記帳。
- 分帳儲存後直接寫入該車正式帳本並同步更新單一摘要與稽核紀錄。

### V2.32｜2026-08-13

- 新增帳目可選擇「先記總額，之後再分帳」或「現在立即分帳」。
- 暫不分帳的支出標記為 `pending`，仍會立即計入車團總支出，但不會先產生成員應收／應付。
- 帳務頁列出待分帳項目，使用者可稍後點擊「分帳」補選成員。

### V2.33｜2026-08-13

- 正式啟動跨 Activity 的 JLY Accounting Core；劇本車為第一個 Activity Accounting 實作，不另建劇本村專用帳本。
- 新增 Transaction、Split、Settlement 與 Pending Action 四個獨立領域模組，避免帳務邏輯繼續堆入 `cardetail.js` 或 LINE Event Router。
- Transaction 明確保留 `activityId`、`activityType`、`villageType`、`createdBy`、`paidBy`、`splitStatus` 與 `settlementStatus`。
- 完成平均分帳尾差、自訂金額驗證、付款申報／撤回、收款確認／退回及責任人待辦的純規則測試。
- 現階段不擴充 LINE 完整帳務管理；未來 LINE 快速記帳必須寫入同一份正式 Transaction。

### V2.34｜2026-08-13

- 新增 Activity Accounting Firestore Repository，劇本車沿用 `accountingEntries` 作為唯一 Transaction 正式來源。
- 新增 `accountingPendingActions` 子集合；待辦具責任人、交易與 Split 關聯，完成後保留狀態歷程而不刪除。
- Transaction 與 Pending Action 在同一個 Firestore Transaction 內同步，完成分帳時會完成 `pending_split` 並產生各欠款人的 `payment_due`。
- Transaction 文件保存目前有效的 `pendingActionIds` 與 `schemaVersion=1`，並暫時保留現行帳務快照所需的相容欄位。

### V2.35｜2026-08-13

- `pages/car-detail.html` 正式載入獨立的 `js/modules/accounting/` 前端模組與 `css/pages/accounting.css`，帳務邏輯沒有繼續堆入 Transitional `js/cardetail.js`。
- Car Detail 增加「車團帳務」正式區塊，第一版顯示待分帳、待付款、待確認收款數量，以及最近五筆 Transaction。
- 車團成員來源整合 `ownerId`、`players` 與 `staffSlots`，帳務身份只採正式 Person / Player / Member ID；顯示名稱不作唯一識別。
- 快速記帳建立唯一 Transaction，保留分離的 `createdBy` 與 `paidBy`，預設 `splitStatus=pending`，並在同一 Firestore transaction 建立 `pending_split`。
- Current 前端儲存位置維持 `cars/{carId}/accountingEntries/{transactionId}` 與 `cars/{carId}/accountingPendingActions/{pendingActionId}`；LINE Messaging Runtime 本階段未擴充。
- 已知限制：目前「查看全部帳務」、平均／自訂分帳與付款雙方確認尚未接上 Car Detail UI，屬 Accounting V1 下一階段。

### V2.36｜2026-08-13

- Car Detail 帳務載入正式 `JLYIdentity`，比對目前 Profile ID、裝置 Identity ID 與 `linkedPlayerIds`，避免同一位正式成員因歷史 Identity 不同而被拒絕記帳。
- 快速記帳會將目前登入者解析回車團保存的正式 Person／Member ID；付款人預設顯示目前玩家姓名，例如「詩婕」。
- 車團 `organizerName`／工作室名稱不再被帳務模組誤當成主揪個人姓名。

### V2.37｜2026-08-13

- Car Detail 將成員／座位名單排列在帳務區上方，維持非帳務車團的主要操作優先順序。
- 待分帳 Transaction 可從最近帳目直接開啟分帳表單，支援勾選正式 Activity Member 後平均分帳或輸入自訂金額。
- 平均分帳的整除尾差固定分配給最後一位所選成員；自訂金額合計不等於 Transaction 金額時禁止完成。
- 完成分帳會結束 `pending_split`，為非付款人成員建立具責任人的 `payment_due`；付款人自己的 Split 直接標記 settled，但不代表其他成員已結清。

### V2.38｜2026-08-13

- 待分帳表單開啟時預設勾選全部正式 Activity Member，減少一般全員平均分帳的操作步驟。
- 成員名單新增小型「全選／取消全選」按鈕，個別勾選變動時按鈕文字會同步更新；自訂金額模式沿用同一份選取狀態。

### V2.39｜2026-08-13

- Car Detail 帳目顯示每位 Split 的金額與獨立結清狀態；欠款本人可申報「我已付款」，並在收款人確認前撤回。
- Transaction 的實際付款人是唯一收款確認者，可按「確認收到」正式結清 Split，或按「尚未收到」退回付款申報。
- 每次付款狀態轉換會同步完成舊 Pending Action 並產生下一責任人的 `payment_due`、`payment_confirmation` 或 `settlement_rejected`。
- 只有所有 Split 都 settled 時，整筆 Transaction 才顯示「全部結清」；付款方不能自行完成結清。

### V2.40｜2026-08-13

- Car Detail 的「查看全部帳務」正式啟用，沿用已讀取的 Transaction 清單，不建立或複製第二份帳務資料。
- 完整列表支援「全部、待處理、待分帳、待付款、待確認、已結清」篩選；開啟時預設顯示待處理帳務。
- 待付款與待確認分類依目前登入 Person ID 判定，讓使用者優先看到下一步輪到自己的帳；首頁仍只顯示最近五筆以維持畫面精簡。

### V2.41｜2026-08-13

- 車團主揪可替欠款成員「代登已付款」，不必等待玩家本人操作；Split 會分開記錄欠款人 `paymentClaimedBy` 與代登者 `paymentRecordedBy`。
- 主揪代登不會冒充玩家本人，且若主揪不是實際收款人，仍需 Transaction 的 `paidBy` 確認後才 settled。
- 實際收款人可直接按「標記已收款」，同時保存付款代登與收款確認時間；非收款人即使是主揪也不能跳過真正收款人直接結清。

### V2.42｜2026-08-13

- 車團帳務權限調整為：欠款本人可申報「我已付款」；Transaction 的 `paidBy` 可確認自己的應收款；車團主揪可管理全部付款狀態。
- 主揪可代替收款人確認、退回或直接標記已收款，並以 `confirmationAuthority=manager`、`paymentRecordSource=manager_override` 明確保存管理者代操作，不偽裝成原收款人。
- 一般成員仍不能修改其他人的 Split；完整 Transaction 內容修改與軟刪除介面留待下一階段，並沿用既有稽核紀錄原則。

### V2.43｜2026-08-13

- 付款操作改用玩家可理解的簡潔文字：欠款人看到「已付款」，收款人或具管理權限者在尚未申報時看到「已收款」，申報後看到「確認收款」。
- 玩家畫面不再顯示「主揪代登」或「主揪標記」等內部權限詞；管理者代操作來源仍完整保存在 Split 欄位與歷史中。
- Transaction 的「全部結清」改以所有 Split 的即時狀態判定，不再只信任可能過期的 Transaction `settlementStatus`，避免仍有人未付款卻顯示全部結清。

### V2.44｜2026-08-13

- 車團帳務新增跨 Transaction 的淨額結算摘要；每筆 Transaction 與 Split 仍是正式來源，不合併、不複製也不刪除原始帳目。
- 系統只聚合已完成分帳且尚未 settled 的 Split，先計算每位成員的淨應收／淨應付，再產生最少必要的「誰付給誰多少」轉帳建議。
- 待分帳、軟刪除與已結清款項不計入目前淨額，避免尚未確認的分攤或已完成付款重複計算。
- 目前淨額摘要是顯示層；付款確認仍保留在原始 Split，後續需增加可追溯的淨額付款分配機制，才能用一次付款安全結清多筆 Split。

### V2.45｜2026-08-13

- Activity Accounting 新增 `cars/{carId}/accountingViews/activityCurrent` 物化摘要，保存最近五筆 Transaction、全車未結清淨額與全車待辦計數；它是正式 Transaction 的衍生快照，不是第二份帳目。
- 第一次遇到尚無摘要的舊車團時，會讀取既有 Transaction 與未完成 Pending Action 建立一次摘要；之後新增、完成分帳與付款狀態轉換都在同一 Firestore Transaction 內同步更新摘要。
- Car Detail 一般開啟改為讀取一份 Activity 摘要，以及只屬於目前使用者的 Pending Action；不再固定讀取最近 20 筆 Transaction 與全車所有待辦。
- 最近帳目直接使用摘要內五筆資料；只有點擊「查看詳細帳務」才按需讀取第一頁最多十筆正式 Transaction，避免一般瀏覽產生不必要讀取。
- 淨額結算改由摘要內全車 `balanceByPerson` 產生，因此不再受最近 20 筆帳目上限影響；原始 Transaction、Split 與付款歷史仍完整保留。

### V2.46｜2026-08-13

- 車團帳務一般介面改成目前登入成員的個人視角，只呈現「我還要付、別人還欠我、等待我確認」以及與本人相關的淨額轉帳與帳目。
- 車團主揪在一般模式與其他成員看到相同個人介面；額外權限集中於帳務區右上角 `⋯ → 管理帳務`，避免管理按鈕長期佔據玩家畫面。
- 管理模式可選擇成員並查看該成員的帳務視角；切換視角不會冒用該成員身分，也不改變實際操作者。
- 主揪只有在目標成員尚未具備 JLY／LINE 正式身分時才顯示代為處理付款的入口；已使用系統成員仍須本人申報付款、由實際收款人確認。

### V2.47｜2026-08-13

- 個人帳務的逐筆區只顯示尚未結清且與目前視角相關的 Split；已 settled 的 Split 不再顯示「已收款」或其他操作按鈕，也不再佔用待處理畫面。
- `accountingViews/activityCurrent` Schema 升級至 V2；舊摘要第一次載入時會依正式 Transaction 與 Pending Action 自動重建，清除過去增量摘要可能殘留的已結清應收應付。
- 淨額結算會先合併同一 Person ID 的餘額並禁止產生自己付給自己的轉帳，避免錯誤摘要顯示「詩婕付給詩婕」。

### V2.48｜2026-08-13

- 車團帳務右上角管理入口改成單一步驟：主揪點擊 `⋯` 直接進入管理模式，不再先展開只有一個選項的浮動選單。
- 進入管理模式後同一按鈕顯示「完成」，點擊即回到主揪本人的一般帳務視角，讓手機操作有立即且明確的畫面回饋。

### V2.49｜2026-08-13

- Car Detail 的「我還要付」與「別人還欠我」摘要改為可點擊卡片，使用原頁小視窗分別顯示付款／收款對象與淨額。
- 明細直接沿用 Accounting Controller 已載入的 `personalSettlement.transfers`，不新增 Firestore 查詢；原本重複顯示的下方「我的結算結果」區塊從一般畫面移除。

### V2.50｜2026-08-13

- 淨額結算小視窗接上雙方確認流程：付款方可申報「我已付款」或在確認前撤回，收款方可「確認收款」，確認後才從 Activity 帳務餘額扣除。
- 新增 `cars/{carId}/accountingSettlements/{settlementId}` 保存淨額付款、確認與撤回歷史；`accountingViews/activityCurrent.activeNetSettlements` 保存進行中的付款申報，避免開啟小視窗時新增讀取。
- 淨額付款申報會建立責任人為收款方的 `payment_confirmation` Pending Action；完成或撤回後保留 Settlement 歷史並完成待辦，不刪除原始 Transaction 或 Split。

### V2.51｜2026-08-13

- 個人帳務摘要拆成「我欠誰」、「誰欠我」與「互抵後總額」三個入口；前兩者顯示扣抵前的原始應付／應收關係，第三者才顯示最終淨額與付款確認操作。
- `accountingViews/activityCurrent` Schema 升級至 V3，新增 `obligationsByPair` 聚合所有未結清 Split 的付款人關係，不受最近帳目顯示筆數限制，也不需在點擊摘要時重新讀取 Transaction。

### V2.52｜2026-08-13

- 淨額收款確認套用既有離線成員代理規則：收款人尚未使用系統時，主揪可在管理視角執行「代為確認收款」；已使用系統的正式成員仍只能本人確認。
- 代理確認紀錄保存 `confirmedBy`、`confirmedFor` 與 `confirmationAuthority=manager_for_offline_member`，明確區分實際操作者與被代理成員。

### V2.53｜2026-08-13

- Activity Member 的報名／Member／Profile／LINE 識別資料不再自動代表已啟用個人帳務；只有 `accountingSelfServiceEnabled=true` 或目前已驗證登入的本人，才視為帳務自助使用者。
- 現階段手動建立或僅完成報名的玩家預設可由主揪代處理款項；未來個人帳務正式開放時，再於完成帳務啟用流程後寫入 `accountingSelfServiceEnabled=true`。

### V2.54｜2026-08-13

- 主揪同時是淨額付款人、並在管理模式查看未啟用帳務的收款人時，操作按鈕優先顯示「代為確認收款」，避免付款人的「撤回付款」遮蔽代理確認入口。
- 回到付款人自己的帳務視角時仍顯示「撤回付款」，代理確認與本人付款操作依目前視角清楚分離。

### V2.55｜2026-08-13

- 修正 Car Detail「詳細帳目」的逐筆付款按鈕：主揪查看未啟用帳務的收款人視角時，依收款人 `paidBy` 判斷代理權限並優先顯示「代為確認收款」。
- 原先只修正互抵總額小視窗，未涵蓋逐筆帳目中的「撤回」按鈕；本版已讓實際詳細帳目入口套用相同的離線收款人代理規則。

### V2.56｜2026-08-14

- 車團帳務的付款操作改為上方「我的結算結果」依對手人彙總處理，下方 Transaction / Split 明細僅供核對，不再逐筆顯示付款或收款按鈕。
- 付款人可輸入本次部分付款金額，或使用「全部付清」；同一對付款與收款人同時只允許一筆待確認申報。
- 付款申報不會立即扣減餘額；收款方確認，或主揪代未啟用帳務的離線成員確認後，才同步扣減互抵餘額與原始應收應付彙總。
- `cars/{carId}/accountingViews/activityCurrent` 升級為 `schemaVersion=4`，重建摘要時會讀取 `accountingSettlements` 並重播所有已確認的彙總付款，避免重新載入後餘額回復。

### V2.57｜2026-08-14

- 互抵結算改為「每兩位成員一對一」：只會將 A 應付 B 與 B 應付 A 互相扣抵，不再使用全車個人餘額重新配對債務。
- 付款申報上限、收款確認與主揪代離線成員確認，全部以 `obligationsByPair` 的同一對成員淨額驗證，避免跨成員抵銷導致帳款對象改變。
