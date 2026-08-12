# JLY Host System｜Project Map

> Status: Working Map
>
> Version: V2.0
>
> Rebuilt: 2026-08-12
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

目前沒有正式的建置指令，也沒有可執行的自動測試套件；`npm test` 仍為預設失敗腳本。

---

## 3. 根目錄

```text
JLY_Host_System/
├─ api/                 Vercel API 入口
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

`assets/`、`images/` 與部分預留模組目錄目前沒有正式執行檔案，不應視為已完成模組。

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

目前專案中不存在舊文件曾列出的 `api/line-login.js`。前端登入是否依賴外部端點或不同部署設定，需另行確認。

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

`services/line/group-binding-service.js` 已通過語法與 CommonJS 模組載入檢查，可作為群組綁定查詢服務使用。目前尚未由 `event-router.js` 或 `message-router.js` 呼叫，因此屬於已完成但尚未接入 LINE Runtime 的基礎模組。

伺服器環境變數：

- `LINE_MESSAGING_CHANNEL_SECRET`
- `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

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
- 舊地圖列出的 `api/line-login.js` 不存在。
- `ROADMAP.md`、`VERSION_HISTORY.md`、`CODING_RULE.md`、`DATABASE_RULE.md` 目前是空檔。
- 專案缺少正式測試與部署驗證指令。
- LINE 群組綁定查詢服務尚未接入 Event Router／Message Router。

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
2. 將 LINE Group Binding Service 接入 Event Router／Message Router。
3. 為 LINE Webhook／Group Binding 增加自動測試。
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
