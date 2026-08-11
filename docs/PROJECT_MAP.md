# JLY Host System｜Project Map

> Status: Working Map
> Version: V1.1
> Established: 2026-08-09
> Last Updated: 2026-08-10
> Project: JLY Host System

---

# 0. 文件定位

`PROJECT_MAP.md` 是 JLY Host System 的正式專案導航文件。

本文件負責維護：

1. Folder Structure
2. Module Responsibility
3. Official File List
4. Dependency Map
5. Firebase / Data Map
6. Legacy / Duplicate Audit
7. Development Entry Points
8. Architecture Change Log

本文件描述：

> JLY Host System 目前實際存在的架構、責任與開發入口。

架構設計原則與工程規範則由：

- `PROJECT_STRUCTURE.md`
- `ENGINEERING_STANDARD.md`

負責。

---

# 1. Project Map Governance

## 1.1 核心規則

> 架構有變，地圖就一起變。

未來只要發生：

- 新增資料夾
- 新增分類
- 新增模組
- 拆分模組
- 合併模組
- 搬移檔案
- 修改模組責任
- 新增正式入口
- 更換正式入口
- 淘汰／取代檔案
- Firebase / Data Structure 架構變更

都必須同步更新 Project Map。

不能只修改實際程式，而沒有更新架構紀錄。

---

## 1.2 新增分類前檢查

新增 Folder / Module / Category 前必須確認：

1. 是否真的需要新的分類？
2. 是否已有相同或高度重疊的責任？
3. 新分類應放在哪一層？
4. 與哪些既有模組相依？
5. 哪些模組會依賴它？
6. 是否造成資料或邏輯重複？
7. Project Map 哪些區域需要同步更新？

---

## 1.3 Rolling Project Map

Project Map 採 Rolling Update。

不要求為整理架構而停止所有功能開發。

開發過程遇到：

- 尚未盤點的舊模組
- 不確定用途的檔案
- 新舊架構並存
- 疑似 Duplicate
- 疑似 Legacy
- 過大的模組
- 責任開始混雜的模組

應在實際走到該區域時進行確認，並同步更新 Project Map。

---

## 1.4 Stable Point Development

2026-08-10 起新增正式開發原則：

> 修復成本開始高於回退成本時，先回上一個穩定點。

重要核心模組修改前：

1. 確認目前版本正常
2. 建立 Git Stable Point
3. 一次只做一個可驗證的小階段
4. Desktop 測試
5. Mobile 測試
6. Related Feature 測試
7. 正常後再建立下一個 Stable Point

若新修改造成既有核心功能失效：

```text
Stop
↓
Identify Last Stable Point
↓
Revert
↓
重新從差異範圍分析

# JLY Host System｜Project Map

> Status: Working Map
> Version: V1.1
> Established: 2026-08-09
> Last Updated: 2026-08-10
> Project: JLY Host System

---

# 0. 文件定位

`PROJECT_MAP.md` 是 JLY Host System 的正式專案導航文件。

本文件負責維護：

1. Folder Structure
2. Module Responsibility
3. Official File List
4. Dependency Map
5. Firebase / Data Map
6. Legacy / Duplicate Audit
7. Development Entry Points
8. Architecture Change Log

本文件描述：

> JLY Host System 目前實際存在的架構、責任與開發入口。

架構設計原則與工程規範則由：

- `PROJECT_STRUCTURE.md`
- `ENGINEERING_STANDARD.md`

負責。

---

# 1. Project Map Governance

## 1.1 核心規則

> 架構有變，地圖就一起變。

未來只要發生：

- 新增資料夾
- 新增分類
- 新增模組
- 拆分模組
- 合併模組
- 搬移檔案
- 修改模組責任
- 新增正式入口
- 更換正式入口
- 淘汰／取代檔案
- Firebase / Data Structure 架構變更

都必須同步更新 Project Map。

不能只修改實際程式，而沒有更新架構紀錄。

---

## 1.2 新增分類前檢查

新增 Folder / Module / Category 前必須確認：

1. 是否真的需要新的分類？
2. 是否已有相同或高度重疊的責任？
3. 新分類應放在哪一層？
4. 與哪些既有模組相依？
5. 哪些模組會依賴它？
6. 是否造成資料或邏輯重複？
7. Project Map 哪些區域需要同步更新？

---

## 1.3 Rolling Project Map

Project Map 採 Rolling Update。

不要求為整理架構而停止所有功能開發。

開發過程遇到：

- 尚未盤點的舊模組
- 不確定用途的檔案
- 新舊架構並存
- 疑似 Duplicate
- 疑似 Legacy
- 過大的模組
- 責任開始混雜的模組

應在實際走到該區域時進行確認，並同步更新 Project Map。

---

## 1.4 Stable Point Development

2026-08-10 起新增正式開發原則：

> 修復成本開始高於回退成本時，先回上一個穩定點。

重要核心模組修改前：

1. 確認目前版本正常
2. 建立 Git Stable Point
3. 一次只做一個可驗證的小階段
4. Desktop 測試
5. Mobile 測試
6. Related Feature 測試
7. 正常後再建立下一個 Stable Point

若新修改造成既有核心功能失效：

```text
Stop
↓
Identify Last Stable Point
↓
Revert
↓
重新從差異範圍分析

4.1 Root
JLY_Host_System/
│
├─ api/
├─ assets/                         🟡
├─ config/
├─ css/
├─ docs/
├─ firebase/
├─ images/                         🟡
├─ js/
├─ node_modules/                   🔒
├─ pages/
├─ services/
├─ shared/
│
├─ .gitignore
├─ index.html
├─ package.json
└─ package-lock.json
4.2 Config
config/
├─ constants.js                    🟡
├─ permissions.js                  🟡
├─ roles.js                        🟡
└─ theme.js                        🟡
4.3 Docs
docs/
├─ CODING_RULE.md                  🟡
├─ DATABASE_RULE.md                🟡
├─ ENGINEERING_STANDARD.md         ✅
├─ PROJECT_STRUCTURE.md            ✅
├─ PROJECT_MAP.md                  ✅
├─ ROADMAP.md                      🟡
└─ VERSION_HISTORY.md              🟡
4.4 Firebase
firebase/
└─ firebase.js
4.5 API

目前已確認：

api/
└─ line-login.js                   ✅

api/line-login.js

目前定位：

LINE Login Backend。

2026-08-10 Revert 的是後續 Account / Secure Login Ticket 整合。

不代表既有 LINE Login Backend 被淘汰。

4.6 CSS
css/
│
├─ cardetail.css
├─ image.png
├─ mycar.css
├─ style.css
├─ ui-system.css
│
├─ components/
│  ├─ buttons.css                  🟡
│  ├─ cards.css                    🟡
│  ├─ forms.css                    🟡
│  ├─ modal.css                    🟡
│  ├─ navigation.css               🟡
│  ├─ seat-engine.css              ✅
│  └─ status-tags.css              🟡
│
└─ pages/
   ├─ car-detail.css               ✅
   ├─ car-view.css                 ✅
   ├─ create-car.css               🟡
   ├─ edit-car.css                 🟡
   ├─ matching-vote.css            ✅
   ├─ matching.css                 ✅
   ├─ member-picker.css            ✅
   ├─ mycar.css                    🟡
   ├─ player-database.css          🟡
   ├─ player-profile.css           🟡
   ├─ recruit.css                  ✅
   └─ studio.css                   🟡

Duplicate / Transitional Candidate：

css/cardetail.css
css/pages/car-detail.css

css/mycar.css
css/pages/mycar.css
4.7 Pages
pages/
├─ car-detail.html
├─ car-view.html
├─ createcar.html
├─ database.html
├─ editcar.html
├─ join.html
├─ line-callback.html
├─ matching-vote.html
├─ matching.html
├─ mycar.html
├─ myprofile.html
├─ players.html
└─ recruit.html

index.html
4.8 Root JS
js/
├─ app.js
├─ carCard.js
├─ cardetail-v2-backup-20260801.js.js    ⚠️
├─ cardetail.js
├─ cars.js
├─ carStatus.js
├─ createcar.js
├─ dashboard.js
├─ database.js
├─ editcar.js
├─ join.js
├─ line-callback.js
├─ line.js
├─ mycar.js
├─ myprofile.js
├─ player.js
├─ playerDatabase.js
├─ seat.js
├─ storage.js
└─ utils.js
4.9 Common
js/common/
├─ app.js
├─ constants.js
├─ navigation.js
├─ permissions.js
├─ storage.js
└─ utils.js

Potential Duplicate Audit:

### App

js/app.js  
✅ Current Runtime  
由 `index.html` 直接載入：

`/js/app.js?v=24`

js/common/app.js  
⚠️ Legacy Candidate  
目前未發現 HTML / JS Runtime 引用。  
先保留，不刪除；完成 Dependency Audit 後再決定是否 Deprecated。

### Storage

js/storage.js  
⚠️ Legacy Candidate  
目前未發現 HTML / JS Runtime 引用。

js/common/storage.js  
⚠️ Legacy Candidate  
目前未發現 HTML / JS Runtime 引用。

Audit Result：

No HTML Script Load  
No JS Runtime Reference  
No JLYStorage Reference

目前兩者皆先保留，不刪除。  
後續完成 Legacy Cleanup Audit 後，再決定是否 Deprecated。

### Utils

js/utils.js  
⚠️ Legacy Candidate  
目前未發現 HTML / JS Runtime 引用。

js/common/utils.js  
⚠️ Legacy Candidate  
目前未發現 HTML / JS Runtime 引用。

Audit Result：

No HTML Script Load  
No JS Runtime Reference  
No JLYUtils Reference

目前兩者皆先保留，不刪除。  
後續完成 Legacy Cleanup Audit 後，再決定是否 Deprecated。

4.10 Identity
js/core/
└─ identity.js                    ✅
4.11 Migration
js/migrations/
└─ car-ownership-v1.js

### 第 2 段／4

```markdown
---

## 4.12 Car

```text
js/car/
│
├─ car-actions.js
├─ car-card.js
├─ car-create.js
├─ car-data.js
├─ car-detail.js
├─ car-edit.js
├─ car-list.js
├─ car-migration.js
├─ car-relations.js
├─ car-status.js
├─ car-view.js
├─ car-view-render.js
│
├─ application/
│  ├─ application-actions.js
│  ├─ application-data.js
│  └─ application-render.js
│
├─ history/
│  ├─ history-actions.js
│  ├─ history-data.js
│  └─ history-render.js
│
├─ player/
│  ├─ car-player-actions.js
│  ├─ car-player-data.js
│  ├─ car-player-editor.js
│  ├─ car-player-render.js
│  └─ car-player-search.js
│
└─ seat/
   ├─ drag.js
   ├─ player-drag.js
   ├─ player-move-executor.js
   ├─ player-move-pipeline.js
   ├─ seat-actions.js
   ├─ seat-assignment.js
   ├─ seat-board.js
   ├─ seat-controller.js
   ├─ seat-data.js
   ├─ seat-layout.js
   ├─ seat-render.js
   └─ seat-rules.js
4.13 Matching
js/matching/
├─ matching-actions.js
├─ matching-calendar.js
├─ matching-conflict.js
├─ matching-controller.js
├─ matching-createcar.js
├─ matching-data.js
├─ matching-matrix.js
├─ matching-render.js
└─ matching-vote.js
4.14 Calendar
js/modules/calendar/
├─ calendar-auth.js
├─ calendar-config.js
├─ calendar-controller.js
├─ calendar-data.js
├─ calendar-detail-actions.js
├─ calendar-provider-google.js
├─ calendar-schedule-check.js
└─ calendar-sync.js
4.15 Car Detail V3
js/modules/car/detail/
│
├─ application/
│  └─ application-actions.js
│
├─ controller/
│  ├─ detail-controller.js
│  ├─ detail-events.js
│  ├─ detail-init.js
│  └─ detail-loader.js
│
├─ core/                           🟡
├─ history/                        🟡
│
├─ matching/
│  └─ matching-confirmation-actions.js
│
├─ player/
│  ├─ player-actions.js
│  ├─ player-editor.js
│  ├─ player-manual-add.js
│  └─ player-search.js
│
├─ render/
│  ├─ application-render.js
│  ├─ detail-page-render.js
│  ├─ history-render.js
│  ├─ seat-section-render.js
│  └─ summary-render.js
│
├─ seat/                           🟡
├─ shared/                         🟡
├─ staff/                          🟡
│
└─ upgrade/
   └─ detail-upgrade.js
4.16 Upgrade
js/modules/core/upgrade/
├─ upgrade-car.js
├─ upgrade-controller.js
├─ upgrade-player.js
└─ upgrade-seat.js
4.17 Member
js/modules/member/
│
├─ member-data.js
├─ member-picker.js
├─ member-schema.js
│
├─ picker/
│  ├─ picker-controller.js
│  ├─ picker-create.js
│  ├─ picker-data.js
│  ├─ picker-events.js
│  ├─ picker-render.js
│  ├─ picker-state.js
│  └─ picker-storage.js
│
├─ profile/                        🟡
└─ relation/                       🟡
4.18 Staff
js/modules/staff/
├─ staff-actions.js
├─ staff-controller.js
├─ staff-data.js
└─ staff-render.js

主要資料來源：

car.staffSlots
4.19 Reserved Modules
js/modules/
├─ notification/                   🟡
├─ report/                         🟡
├─ seat/                           🟡
├─ studio/                         🟡
└─ timeline/                       🟡
4.20 Notification
js/notification/
├─ line-message.js
├─ notification-settings.js
├─ recruitment-text.js
└─ reminder.js
4.21 Player
js/player/
├─ line-account.js
├─ player-database.js
├─ player-profile.js
├─ player-relationships.js
├─ player-search.js
└─ player-stats.js

注意：

line-account.js

需要重新 Audit。

不得因檔名直接視為目前 Account V2 Official Runtime。

4.22 Report
js/report/
├─ car-report.js
├─ export.js
├─ player-report.js
└─ studio-report.js
4.23 UI
js/ui/
├─ components/                     🟡
└─ pages/                          🟡

4.1 Root
JLY_Host_System/
│
├─ api/
├─ assets/                         🟡
├─ config/
├─ css/
├─ docs/
├─ firebase/
├─ images/                         🟡
├─ js/
├─ node_modules/                   🔒
├─ pages/
├─ services/
├─ shared/
│
├─ .gitignore
├─ index.html
├─ package.json
└─ package-lock.json
4.2 Config
config/
├─ constants.js                    🟡
├─ permissions.js                  🟡
├─ roles.js                        🟡
└─ theme.js                        🟡
4.3 Docs
docs/
├─ CODING_RULE.md                  🟡
├─ DATABASE_RULE.md                🟡
├─ ENGINEERING_STANDARD.md         ✅
├─ PROJECT_STRUCTURE.md            ✅
├─ PROJECT_MAP.md                  ✅
├─ ROADMAP.md                      🟡
└─ VERSION_HISTORY.md              🟡
4.4 Firebase
firebase/
└─ firebase.js
4.5 API

目前已確認：

api/
└─ line-login.js                   ✅

api/line-login.js

目前定位：

LINE Login Backend。

2026-08-10 Revert 的是後續 Account / Secure Login Ticket 整合。

不代表既有 LINE Login Backend 被淘汰。

4.6 CSS
css/
│
├─ cardetail.css
├─ image.png
├─ mycar.css
├─ style.css
├─ ui-system.css
│
├─ components/
│  ├─ buttons.css                  🟡
│  ├─ cards.css                    🟡
│  ├─ forms.css                    🟡
│  ├─ modal.css                    🟡
│  ├─ navigation.css               🟡
│  ├─ seat-engine.css              ✅
│  └─ status-tags.css              🟡
│
└─ pages/
   ├─ car-detail.css               ✅
   ├─ car-view.css                 ✅
   ├─ create-car.css               🟡
   ├─ edit-car.css                 🟡
   ├─ matching-vote.css            ✅
   ├─ matching.css                 ✅
   ├─ member-picker.css            ✅
   ├─ mycar.css                    🟡
   ├─ player-database.css          🟡
   ├─ player-profile.css           🟡
   ├─ recruit.css                  ✅
   └─ studio.css                   🟡

Duplicate / Transitional Candidate：

css/cardetail.css
css/pages/car-detail.css

css/mycar.css
css/pages/mycar.css
4.7 Pages
pages/
├─ car-detail.html
├─ car-view.html
├─ createcar.html
├─ database.html
├─ editcar.html
├─ join.html
├─ line-callback.html
├─ matching-vote.html
├─ matching.html
├─ mycar.html
├─ myprofile.html
├─ players.html
└─ recruit.html

index.html
4.8 Root JS
js/
├─ app.js
├─ carCard.js
├─ cardetail-v2-backup-20260801.js.js    ⚠️
├─ cardetail.js
├─ cars.js
├─ carStatus.js
├─ createcar.js
├─ dashboard.js
├─ database.js
├─ editcar.js
├─ join.js
├─ line-callback.js
├─ line.js
├─ mycar.js
├─ myprofile.js
├─ player.js
├─ playerDatabase.js
├─ seat.js
├─ storage.js
└─ utils.js
4.9 Common
js/common/
├─ app.js
├─ constants.js
├─ navigation.js
├─ permissions.js
├─ storage.js
└─ utils.js

Potential Duplicate Audit：

js/app.js
js/common/app.js

js/storage.js
js/common/storage.js

js/utils.js
js/common/utils.js
4.10 Identity
js/core/
└─ identity.js                    ✅
4.11 Migration
js/migrations/
└─ car-ownership-v1.js

### 第 2 段／4

```markdown
---

## 4.12 Car

```text
js/car/
│
├─ car-actions.js
├─ car-card.js
├─ car-create.js
├─ car-data.js
├─ car-detail.js
├─ car-edit.js
├─ car-list.js
├─ car-migration.js
├─ car-relations.js
├─ car-status.js
├─ car-view.js
├─ car-view-render.js
│
├─ application/
│  ├─ application-actions.js
│  ├─ application-data.js
│  └─ application-render.js
│
├─ history/
│  ├─ history-actions.js
│  ├─ history-data.js
│  └─ history-render.js
│
├─ player/
│  ├─ car-player-actions.js
│  ├─ car-player-data.js
│  ├─ car-player-editor.js
│  ├─ car-player-render.js
│  └─ car-player-search.js
│
└─ seat/
   ├─ drag.js
   ├─ player-drag.js
   ├─ player-move-executor.js
   ├─ player-move-pipeline.js
   ├─ seat-actions.js
   ├─ seat-assignment.js
   ├─ seat-board.js
   ├─ seat-controller.js
   ├─ seat-data.js
   ├─ seat-layout.js
   ├─ seat-render.js
   └─ seat-rules.js
4.13 Matching
js/matching/
├─ matching-actions.js
├─ matching-calendar.js
├─ matching-conflict.js
├─ matching-controller.js
├─ matching-createcar.js
├─ matching-data.js
├─ matching-matrix.js
├─ matching-render.js
└─ matching-vote.js
4.14 Calendar
js/modules/calendar/
├─ calendar-auth.js
├─ calendar-config.js
├─ calendar-controller.js
├─ calendar-data.js
├─ calendar-detail-actions.js
├─ calendar-provider-google.js
├─ calendar-schedule-check.js
└─ calendar-sync.js
4.15 Car Detail V3
js/modules/car/detail/
│
├─ application/
│  └─ application-actions.js
│
├─ controller/
│  ├─ detail-controller.js
│  ├─ detail-events.js
│  ├─ detail-init.js
│  └─ detail-loader.js
│
├─ core/                           🟡
├─ history/                        🟡
│
├─ matching/
│  └─ matching-confirmation-actions.js
│
├─ player/
│  ├─ player-actions.js
│  ├─ player-editor.js
│  ├─ player-manual-add.js
│  └─ player-search.js
│
├─ render/
│  ├─ application-render.js
│  ├─ detail-page-render.js
│  ├─ history-render.js
│  ├─ seat-section-render.js
│  └─ summary-render.js
│
├─ seat/                           🟡
├─ shared/                         🟡
├─ staff/                          🟡
│
└─ upgrade/
   └─ detail-upgrade.js
4.16 Upgrade
js/modules/core/upgrade/
├─ upgrade-car.js
├─ upgrade-controller.js
├─ upgrade-player.js
└─ upgrade-seat.js
4.17 Member
js/modules/member/
│
├─ member-data.js
├─ member-picker.js
├─ member-schema.js
│
├─ picker/
│  ├─ picker-controller.js
│  ├─ picker-create.js
│  ├─ picker-data.js
│  ├─ picker-events.js
│  ├─ picker-render.js
│  ├─ picker-state.js
│  └─ picker-storage.js
│
├─ profile/                        🟡
└─ relation/                       🟡
4.18 Staff
js/modules/staff/
├─ staff-actions.js
├─ staff-controller.js
├─ staff-data.js
└─ staff-render.js

主要資料來源：

car.staffSlots
4.19 Reserved Modules
js/modules/
├─ notification/                   🟡
├─ report/                         🟡
├─ seat/                           🟡
├─ studio/                         🟡
└─ timeline/                       🟡
4.20 Notification
js/notification/
├─ line-message.js
├─ notification-settings.js
├─ recruitment-text.js
└─ reminder.js
4.21 Player
js/player/
├─ line-account.js
├─ player-database.js
├─ player-profile.js
├─ player-relationships.js
├─ player-search.js
└─ player-stats.js

注意：

line-account.js

需要重新 Audit。

不得因檔名直接視為目前 Account V2 Official Runtime。

4.22 Report
js/report/
├─ car-report.js
├─ export.js
├─ player-report.js
└─ studio-report.js
4.23 UI
js/ui/
├─ components/                     🟡
└─ pages/                          🟡

4.24 Services
services/
├─ cloud/                          🟡
├─ firebase/                       🟡
├─ line/                           🟡
└─ vercel/                         🟡
4.25 Shared
shared/
├─ dialog/                         🟡
├─ emoji/                          🟡
├─ icons/                          🟡
└─ templates/                      🟡
5. Module Responsibility

Responsibility 分成「已確認」與「待確認」。

尚未讀取實際程式內容的模組，不因檔名看起來合理就直接寫成正式責任。

5.1 LINE Login

目前正式入口：

pages/line-callback.html
js/line.js
js/line-callback.js
api/line-login.js

責任：

pages/line-callback.html
→ LINE Callback Page

js/line.js
→ LINE Login Client Entry

js/line-callback.js
→ Callback
→ State Validation
→ Authorization Code Exchange
→ Login Return

api/line-login.js
→ LINE Login Backend

目前：

Mobile LINE Login
→ Stable

Account / Secure Login Ticket V2
→ Reverted

backup-line-account-v2
→ Backup Only

LINE Login 與未來 LINE Assistant 必須分開。

LINE Login
≠
LINE Assistant
5.2 Identity

正式核心：

js/core/identity.js

責任：

Current Player ID
Current Player Profile ID
Current Player Name
linkedPlayerIds
Historical Identity Linking
Profile Sync
Local Identity Cache

核心關係：

Current Identity
↓
Player Profile
↓
linkedPlayerIds
↓
Historical Player IDs
5.3 Seat Engine

位置：

js/car/seat/

責任：

seat-data.js
→ Seat Data

seat-layout.js
→ Seat Layout

seat-rules.js
→ Seat Rules

seat-assignment.js
→ Seat Assignment

seat-actions.js
→ Seat Actions

seat-render.js
→ Seat Render

seat-board.js
→ Seat Board

seat-controller.js
→ Seat 流程協調

drag.js
→ Seat / Row Drag

player-drag.js
→ Player Drag

player-move-pipeline.js
→ Player Move Pipeline

player-move-executor.js
→ Player Move Execution

玩家與工作人員共用 Seat 規格。

5.4 Matching
js/matching/

責任：

matching-controller.js
→ Flow

matching-data.js
→ Data

matching-actions.js
→ Actions

matching-calendar.js
→ Calendar

matching-conflict.js
→ Conflict

matching-matrix.js
→ Matrix

matching-render.js
→ Render

matching-vote.js
→ Vote

matching-createcar.js
→ Matching → Create Car
5.5 Calendar
js/modules/calendar/

責任：

calendar-auth.js
→ Calendar Authentication

calendar-config.js
→ Calendar Configuration

calendar-controller.js
→ Calendar Flow

calendar-data.js
→ Calendar Data

calendar-detail-actions.js
→ Car Detail Calendar Actions

calendar-provider-google.js
→ Google Calendar Provider

calendar-schedule-check.js
→ Schedule Check

calendar-sync.js
→ Calendar Sync

Google Calendar：

Default = OFF

2026-08-10 已確認：

Google 授權本身可正常進行。

目前需要另外確認：

建立車團後自動同步

因此：

Google Authorization
≠
Car Auto Sync

不得把兩種問題混為同一故障。

5.6 Car Detail

相關：

js/cardetail.js
js/car/car-detail.js
js/modules/car/detail/

目前：

🔄 Transitional

需要持續 Dependency Audit。

5.7 Member
js/modules/member/

負責：

Member Data
Picker
Schema
Member Selection

5.8 Staff
js/modules/staff/

正式資料：

car.staffSlots

Staff 不只代表 DM。

未來可支援：

DM
GM
Assistant DM
櫃檯
客服
店家人員
其他自訂職稱
5.9 Player
js/player/

Player Profile 與 Car Player 必須分離。

5.10 Notification
js/notification/

未來 LINE Assistant 不能全部塞入此舊結構。

若責任開始擴大：

應獨立拆分 Automation / LINE Assistant Layer。

5.11 Report
js/report/
5.12 Studio

目前相關：

js/studio/
js/modules/studio/

狀態：

Working / Reserved / Audit Required
6. Identity / Role / Permission Architecture

2026-08-10 正式確立：

Account
Person / Player Profile
Role
Permission

必須分離。

6.1 Account

Account 代表：

登入者
驗證身份
登入方式

LINE 是 Authentication / Verified Identity Link。

LINE 本身不是：

Player
Host
DM
GM
Admin
6.2 Person / Player Profile

Profile 代表：

這個人是誰。

例如：

燕餃 Profile
↕
Verified JLY Account / LINE

完成正式認領後：

身份關係長期保存。

6.3 Role

Role 代表：

此人在某個 Scope 中扮演什麼角色。

例如：

A 車 → Player
B 車 → DM
C 車 → GM
D 車 → Host

歷史角色不能產生目前車團權限。

6.4 Player / Host

Player 是基礎使用者身份。

Host 不是另一種永久帳號。

任何 Player 建立一台車：

Player
↓
Create Car
↓
Host of Current Car

Host 為：

Car-scoped Role
6.5 Admin

Admin 是：

Platform-level Permission

同一 Account 可同時：

Player
Host
Admin

Admin 功能不應污染一般 Player / Host 使用畫面。

未來可有：

🛡️ 管理中心 5

一般畫面只顯示待處理數量。

詳細內容只有進 Admin Center 才展開。

6.6 Workspace Principle

使用者不需要一直「切換身份」。

系統依 Scope 自動判斷：

進自己的空間
→ Player

進自己建立的車
→ Host Tools

進自己擔任 DM 的車
→ DM Tools

有 JLY Admin Permission
→ Admin Center Entry

核心：

Role 是系統依資料判定，不要求使用者每次重新選擇身份。

7. DM / GM Identity & Authorization

核心原則：

Identity Claim
≠
Role Authorization

「我是燕餃」

不等於：

「我是這台車的 DM」。

7.1 已完成永久身份串聯

例如：

燕餃 Profile
↕
Verified JLY Account / LINE

Host 在某車指定：

DM：燕餃

Host 的 Assignment 本身就是：

Current Car DM Role Authorization

系統：

Resolve 燕餃 Profile
↓
Resolve Verified Account
↓
Create Current Car DM Role Grant

不需要再次申請。

7.2 已綁定 Person 被指定為 Player

若 Host 只把燕餃放在：

Player

燕餃在本車：

只有 Player Role。

即使過去曾經是 DM：

也不能取得本車 DM 權限。

7.3 DM / GM Claim Search

DM / GM 認領：

不能搜尋整個 Player Database。

只能搜尋：

Current Car
↓
staffSlots
↓
Unclaimed DM / GM Records

歷史 DM 身份：

不能作為 Current Car 候選來源。

7.4 Host 已先輸入未綁定 DM

例如：

DM：燕餃

燕餃尚未串聯 JLY Account / LINE。

本人登入後：

點「我是燕餃」
↓
Pending Role Claim

此時：

DM Permission = 0

Host 收到：

請確認此人是否為本車 DM：燕餃

Host Approve 後：

Account / LINE
↕
燕餃 Profile

+

Current Car
↕
DM Role Grant

同時完成：

身份確認與本車 Role Authorization。

7.5 空白 DM / GM Slot Claim

如果：

DM：[空白]

只要本車有可認領空白職位：

使用者可以：

點空白 DM
↓
我是這台車的 DM

建立：

Pending Role Claim

Host 收到：

請確認此人是否為本車 DM / GM

Approve 後：

1. 填入 staffSlots
2. 建立 Current Car Role Grant
3. 開啟 Current Car DM / GM Permission
4. 若尚未永久綁定，同時建立 Person/Profile ↔ Account/LINE 身份關係

Reject：

不建立 Role
不建立 Permission
不污染 Identity
7.6 DM / GM 權限合法取得路徑
Path A
已綁定 Person
↓
Host 指定為本車 DM / GM
↓
自動建立本車 Role Grant
Path B
未綁定 / 空白 Slot
↓
User Claim
↓
Pending
↓
Host Approval
↓
必要時建立 Identity Binding
↓
Current Car Role Grant

禁止：

User 點「我是 DM」
↓
立即開放 DM Data

Pending 狀態：

Sensitive Permission = 0
7.7 Identity Binding

人物身份一旦正確認領：

預設長期有效。

例如：

Account ABC
↕
燕餃 Profile

不因：

離開某車
某車結束
某次 DM Role 結束
離開 LINE 群

而解除 Person Identity。

13.1 Final Casting Authority

測驗只供：

Host / DM

分角參考。

不能：

Quiz Result
↓
Automatically Lock Character

正式分角：

仍由 Authorized Host / DM 決定。

13.2 Casting Quiz Template

支援：

Shared Script Quiz Template
+
Per-Car Override

DM / Studio 可提供：

題目
適配規則
說明
校正建議
13.3 LINE Assistant Integration
Car Ready
↓
Assistant 發送心測
↓
Player Fill
↓
Completion Tracking
↓
Reminder
↓
DM View Result
↓
Final Casting

目前：

LONG-TERM
NOT CURRENT PRIORITY

### 第 4 段／4

```markdown
---

# 14. Personal Recruit Page

Personal Recruit Page：

主要顯示使用者主揪的車。

「我是玩家」目前不作主要招募頁內容。

例外：

某車勾選：

```text
協助揪團

即可出現在個人揪團頁。

14.1 Visibility

車團支援：

Public
Private

Public：

Personal Recruit Page
+
Public Recruitment Area

Private：

Personal Page
或
Single Car Link

不需要第三種公開狀態。

14.2 Link Safety

未來支援：

Rotatable Random Link

避免私人連結永久流傳。

15. Plan / Feature Permission Layer

JLY 所有新功能：

從現在起預留：

Feature Permission Layer

可能方案：

Free
JLY+
Business / Studio

目前：

不急著決定收費項目。

核心：

Feature Module
≠
Plan Permission
15.1 Feature Classification

每個新功能規劃時：

同步標記：

所屬 Village
是否共用 Module
Role Permission
Plan Permission
是否可能 Free
是否可能 Upgrade

核心資料與 Engine：

不得因方案不同重複建立。

16. Firebase / Data Map

本區目前仍為 Working Data Map。

未完成完整 Collection / Document / Read / Write Audit 的部分不得自行推測。

16.1 Firebase Entry
firebase/firebase.js
16.2 Identity Relationship

目前：

Current Identity
↓
Player Profile
↓
linkedPlayerIds[]
↓
Historical Player IDs
↓
Car Player Relationship

未來 Account 正確方向：

Account
↓
Identity Core
↓
Player Profile
↓
linkedPlayerIds[]
↓
Historical Player Data

禁止：

Account
↓
Independent New Player Identity
16.3 Future Role Relationship
Account
↓
Person / Profile
↓
Car Participation
↓
Role Grant
↓
Permission

Account：

登入與驗證。

Profile：

這個人是誰。

Participation：

這個人在某車的參與紀錄。

Role：

本車角色。

Permission：

本 Scope 可操作能力。

16.4 Car
Car
├─ scriptName
├─ gameDate
├─ gameTime
├─ location
├─ organizer
├─ capacity / position configuration
├─ allowCrossPlay
├─ note
├─ status
├─ players[]
├─ applications[]
├─ staffSlots
├─ matching
├─ history[]
├─ createdAt
└─ updatedAt
16.5 Player In Car
playerId
playerName
displayName
hostAlias
hostNote
position
roleChoice
isCrossPlay
status
joinedAt
source
16.6 Player Profile

目前概念：

id
displayName
nickname
aliases[]
isLineLinked
lineDisplayName
linkedPlayerIds[]
createdAt
16.7 Application
playerName
position
isCrossPlay
createdAt
status
hostAlias
16.8 Staff

Current：

Car
└─ staffSlots

Legacy：

dmName
dmList

dmName / dmList

不再作 Matrix V2 正式來源。

16.9 Matching
matching
├─ candidateSlots
├─ responses
├─ selectedDates
├─ commonSlots
└─ selectedSlotId

Participant：

participant
├─ participantType
├─ participantKey
├─ participantId
└─ participantName

DM：

participantType = dm
dmId
dmName

Player：

participantType = player
playerId
playerName
16.10 History
History
├─ type
├─ text
└─ time
16.11 LINE Account Data Note

2026-08-10：

Secure Account Login Ticket V2 整合已 Revert。

因此：

accountLoginTickets

目前不得視為：

Current Official Runtime Dependency

直到未來：

Account Layer Reintroduction
↓
Desktop Test
↓
Mobile Test
↓
Identity Test
↓
Firebase Audit
↓
Project Map Update

完成後才重新升級狀態。

17. Dependency Map
17.1 Identity / My Car
Current Identity
↓
Player Profile
↓
linkedPlayerIds
↓
Historical Player IDs
↓
Car Player Relationship
↓
「我是玩家」
pages/mycar.html
↓
js/mycar.js
↓
Identity / Car Relationship
↓
我主揪的 / 我是玩家
17.2 Seat
Car
↓
Players
↓
Seat Engine
├─ Data
├─ Rules
├─ Layout
├─ Assignment
├─ Actions
├─ Render
└─ Player Move
Player Drag
↓
Move Pipeline
↓
Rules / Validation
↓
Move Executor
↓
Seat / Player State
17.3 Car Detail
pages/car-detail.html
↓
Transitional Runtime
├─ js/cardetail.js              ❓
├─ js/car/car-detail.js         ❓
└─ js/modules/car/detail/
   ├─ controller/
   ├─ player/
   ├─ application/
   ├─ matching/
   ├─ render/
   └─ upgrade/
17.4 Player Car View
pages/car-view.html
↓
js/car/car-view.js
↓
Car Data
↓
js/car/car-view-render.js
↓
Player-facing View

CSS：

css/pages/car-view.css
17.5 Matching
Car
├─ players
├─ staffSlots
└─ matching
↓
js/matching/
↓
Matrix / Calendar / Conflict / Vote
car.players
+
car.staffSlots
+
matching.responses
+
matching.candidateSlots
↓
Matching Matrix
17.6 Calendar
JLY Calendar
↓
Calendar Controller
├─ Config
├─ Auth
├─ Data
├─ Schedule Check
└─ Sync
↓
Google Provider
↓
Google Calendar

Default：

OFF
17.7 Staff
Car
↓
staffSlots
↓
Staff Module
↓
Car Detail / Player View / Matching
17.8 Application
Application
↓
Approve
↓
Player
↓
Seat Assignment
↓
Seat Engine
17.9 Future Account
Account
↓
Identity Core
↓
Player Profile
↓
linkedPlayerIds
↓
Historical Player Data
18. Legacy / Duplicate Audit

疑似舊檔不等於可以刪除。

目前 Audit：

js/cardetail-v2-backup-20260801.js.js

js/cardetail.js
js/car/car-detail.js
js/modules/car/detail/

js/app.js
js/common/app.js

js/storage.js
js/common/storage.js

js/utils.js
js/common/utils.js

js/database.js
js/playerDatabase.js
js/player/player-database.js
js/player/player-search.js

pages/database.html
pages/players.html

css/cardetail.css
css/pages/car-detail.css

css/mycar.css
css/pages/mycar.css

js/seat.js
js/car/seat/

js/car/application/
js/modules/car/detail/application/

js/modules/notification/
js/notification/

js/modules/report/
js/report/

js/modules/seat/
js/car/seat/

js/modules/studio/
js/studio/
18.1 Reverted Account Audit

Account / Secure Login Ticket V2 已 Revert。

相關檔案：

若目前 Main Runtime 已不再載入：

應標示為：

📦 Backup Only
⚠️ Legacy Candidate
或
🗑 Deprecated

但必須實際完成 Dependency Audit 後才能定案。

19. Development Entry Points

修改功能前先查本區。

Entry Point 表示從哪裡開始追，不代表只修改一支檔案。

19.1 Identity
js/core/identity.js
19.2 LINE Login
pages/line-callback.html
js/line.js
js/line-callback.js
api/line-login.js

目前：

Mobile Login = Stable

Account / Secure Login Ticket V2：

REVERTED

Git：

backup-line-account-v2
19.3 My Car
pages/mycar.html
js/mycar.js
js/core/identity.js
js/car/car-relations.js
js/myprofile.js
19.4 Seat Engine
js/car/seat/
├─ seat-data.js
├─ seat-rules.js
├─ seat-layout.js
├─ seat-assignment.js
├─ seat-actions.js
├─ seat-render.js
├─ seat-board.js
├─ seat-controller.js
├─ drag.js
├─ player-drag.js
├─ player-move-pipeline.js
└─ player-move-executor.js

css/components/seat-engine.css
19.5 Matching
pages/matching.html
js/matching/
css/pages/matching.css

主要：

matching-controller.js
matching-data.js
matching-matrix.js
matching-render.js
matching-calendar.js
matching-conflict.js
matching-actions.js
matching-createcar.js

Vote：

pages/matching-vote.html
js/matching/matching-vote.js
css/pages/matching-vote.css
19.6 Car View
pages/car-view.html
js/car/car-view.js
js/car/car-view-render.js
css/pages/car-view.css

## 19.7 Car Detail

```text
pages/car-detail.html
js/modules/car/detail/
js/cardetail.js
js/seat.js
js/car/car-detail.js
js/cardetail-v2-backup-20260801.js.js

19.8 Calendar
js/modules/calendar/

Auth：

calendar-auth.js

Provider：

calendar-provider-google.js

Sync：

calendar-sync.js

Data：

calendar-data.js

Config：

calendar-config.js

Schedule：

calendar-schedule-check.js

Controller：

calendar-controller.js
19.9 Create Car
pages/createcar.html
js/createcar.js

Related：

js/car/car-create.js
js/car/seat/
js/modules/calendar/
19.10 Edit Car
pages/editcar.html
js/editcar.js

Related：

js/car/car-edit.js
19.11 Personal Recruit Page
pages/recruit.html
js/recruit/
css/pages/recruit.css
js/car/car-relations.js
19.12 Player Profile
pages/myprofile.html
js/myprofile.js
js/core/identity.js

Related Candidate：

js/player/player-profile.js

必須保護：

Player Profile
linkedPlayerIds
Historical Identity

13.1 Final Casting Authority

測驗只供：

Host / DM

分角參考。

不能：

Quiz Result
↓
Automatically Lock Character

正式分角：

仍由 Authorized Host / DM 決定。

13.2 Casting Quiz Template

支援：

Shared Script Quiz Template
+
Per-Car Override

DM / Studio 可提供：

題目
適配規則
說明
校正建議
13.3 LINE Assistant Integration
Car Ready
↓
Assistant 發送心測
↓
Player Fill
↓
Completion Tracking
↓
Reminder
↓
DM View Result
↓
Final Casting

目前：

LONG-TERM
NOT CURRENT PRIORITY

### 第 4 段／4

```markdown
---

# 14. Personal Recruit Page

Personal Recruit Page：

主要顯示使用者主揪的車。

「我是玩家」目前不作主要招募頁內容。

例外：

某車勾選：

```text
協助揪團

即可出現在個人揪團頁。

14.1 Visibility

車團支援：

Public
Private

Public：

Personal Recruit Page
+
Public Recruitment Area

Private：

Personal Page
或
Single Car Link

不需要第三種公開狀態。

14.2 Link Safety

未來支援：

Rotatable Random Link

避免私人連結永久流傳。

15. Plan / Feature Permission Layer

JLY 所有新功能：

從現在起預留：

Feature Permission Layer

可能方案：

Free
JLY+
Business / Studio

目前：

不急著決定收費項目。

核心：

Feature Module
≠
Plan Permission
15.1 Feature Classification

每個新功能規劃時：

同步標記：

所屬 Village
是否共用 Module
Role Permission
Plan Permission
是否可能 Free
是否可能 Upgrade

核心資料與 Engine：

不得因方案不同重複建立。

16. Firebase / Data Map

本區目前仍為 Working Data Map。

未完成完整 Collection / Document / Read / Write Audit 的部分不得自行推測。

16.1 Firebase Entry
firebase/firebase.js
16.2 Identity Relationship

目前：

Current Identity
↓
Player Profile
↓
linkedPlayerIds[]
↓
Historical Player IDs
↓
Car Player Relationship

未來 Account 正確方向：

Account
↓
Identity Core
↓
Player Profile
↓
linkedPlayerIds[]
↓
Historical Player Data

禁止：

Account
↓
Independent New Player Identity
16.3 Future Role Relationship
Account
↓
Person / Profile
↓
Car Participation
↓
Role Grant
↓
Permission

Account：

登入與驗證。

Profile：

這個人是誰。

Participation：

這個人在某車的參與紀錄。

Role：

本車角色。

Permission：

本 Scope 可操作能力。

16.4 Car
Car
├─ scriptName
├─ gameDate
├─ gameTime
├─ location
├─ organizer
├─ capacity / position configuration
├─ allowCrossPlay
├─ note
├─ status
├─ players[]
├─ applications[]
├─ staffSlots
├─ matching
├─ history[]
├─ createdAt
└─ updatedAt
16.5 Player In Car
playerId
playerName
displayName
hostAlias
hostNote
position
roleChoice
isCrossPlay
status
joinedAt
source
16.6 Player Profile

目前概念：

id
displayName
nickname
aliases[]
isLineLinked
lineDisplayName
linkedPlayerIds[]
createdAt
16.7 Application
playerName
position
isCrossPlay
createdAt
status
hostAlias
16.8 Staff

Current：

Car
└─ staffSlots

Legacy：

dmName
dmList

dmName / dmList

不再作 Matrix V2 正式來源。

16.9 Matching
matching
├─ candidateSlots
├─ responses
├─ selectedDates
├─ commonSlots
└─ selectedSlotId

Participant：

participant
├─ participantType
├─ participantKey
├─ participantId
└─ participantName

DM：

participantType = dm
dmId
dmName

Player：

participantType = player
playerId
playerName
16.10 History
History
├─ type
├─ text
└─ time
16.11 LINE Account Data Note

2026-08-10：

Secure Account Login Ticket V2 整合已 Revert。

因此：

accountLoginTickets

目前不得視為：

Current Official Runtime Dependency

直到未來：

Account Layer Reintroduction
↓
Desktop Test
↓
Mobile Test
↓
Identity Test
↓
Firebase Audit
↓
Project Map Update

完成後才重新升級狀態。

17. Dependency Map
17.1 Identity / My Car
Current Identity
↓
Player Profile
↓
linkedPlayerIds
↓
Historical Player IDs
↓
Car Player Relationship
↓
「我是玩家」
pages/mycar.html
↓
js/mycar.js
↓
Identity / Car Relationship
↓
我主揪的 / 我是玩家
17.2 Seat
Car
↓
Players
↓
Seat Engine
├─ Data
├─ Rules
├─ Layout
├─ Assignment
├─ Actions
├─ Render
└─ Player Move
Player Drag
↓
Move Pipeline
↓
Rules / Validation
↓
Move Executor
↓
Seat / Player State
17.3 Car Detail
pages/car-detail.html
↓
Transitional Runtime
├─ js/cardetail.js              ❓
├─ js/car/car-detail.js         ❓
└─ js/modules/car/detail/
   ├─ controller/
   ├─ player/
   ├─ application/
   ├─ matching/
   ├─ render/
   └─ upgrade/
17.4 Player Car View
pages/car-view.html
↓
js/car/car-view.js
↓
Car Data
↓
js/car/car-view-render.js
↓
Player-facing View

CSS：

css/pages/car-view.css
17.5 Matching
Car
├─ players
├─ staffSlots
└─ matching
↓
js/matching/
↓
Matrix / Calendar / Conflict / Vote
car.players
+
car.staffSlots
+
matching.responses
+
matching.candidateSlots
↓
Matching Matrix
17.6 Calendar
JLY Calendar
↓
Calendar Controller
├─ Config
├─ Auth
├─ Data
├─ Schedule Check
└─ Sync
↓
Google Provider
↓
Google Calendar

Default：

OFF
17.7 Staff
Car
↓
staffSlots
↓
Staff Module
↓
Car Detail / Player View / Matching
17.8 Application
Application
↓
Approve
↓
Player
↓
Seat Assignment
↓
Seat Engine
17.9 Future Account
Account
↓
Identity Core
↓
Player Profile
↓
linkedPlayerIds
↓
Historical Player Data
18. Legacy / Duplicate Audit

疑似舊檔不等於可以刪除。

目前 Audit：

js/cardetail-v2-backup-20260801.js.js

js/cardetail.js
js/car/car-detail.js
js/modules/car/detail/

js/app.js
js/common/app.js

js/storage.js
js/common/storage.js

js/utils.js
js/common/utils.js

js/database.js
js/playerDatabase.js
js/player/player-database.js
js/player/player-search.js

pages/database.html
pages/players.html

css/cardetail.css
css/pages/car-detail.css

css/mycar.css
css/pages/mycar.css

js/seat.js
js/car/seat/

js/car/application/
js/modules/car/detail/application/

js/modules/notification/
js/notification/

js/modules/report/
js/report/

js/modules/seat/
js/car/seat/

js/modules/studio/
js/studio/
18.1 Reverted Account Audit

Account / Secure Login Ticket V2 已 Revert。

相關檔案：

若目前 Main Runtime 已不再載入：

應標示為：

📦 Backup Only
⚠️ Legacy Candidate
或
🗑 Deprecated

但必須實際完成 Dependency Audit 後才能定案。

19. Development Entry Points

修改功能前先查本區。

Entry Point 表示從哪裡開始追，不代表只修改一支檔案。

19.1 Identity
js/core/identity.js
19.2 LINE Login
pages/line-callback.html
js/line.js
js/line-callback.js
api/line-login.js

目前：

Mobile Login = Stable

Account / Secure Login Ticket V2：

REVERTED

Git：

backup-line-account-v2
19.3 My Car
pages/mycar.html
js/mycar.js
js/core/identity.js
js/car/car-relations.js
js/myprofile.js
19.4 Seat Engine
js/car/seat/
├─ seat-data.js
├─ seat-rules.js
├─ seat-layout.js
├─ seat-assignment.js
├─ seat-actions.js
├─ seat-render.js
├─ seat-board.js
├─ seat-controller.js
├─ drag.js
├─ player-drag.js
├─ player-move-pipeline.js
└─ player-move-executor.js

css/components/seat-engine.css
19.5 Matching
pages/matching.html
js/matching/
css/pages/matching.css

主要：

matching-controller.js
matching-data.js
matching-matrix.js
matching-render.js
matching-calendar.js
matching-conflict.js
matching-actions.js
matching-createcar.js

Vote：

pages/matching-vote.html
js/matching/matching-vote.js
css/pages/matching-vote.css
19.6 Car View
pages/car-view.html
js/car/car-view.js
js/car/car-view-render.js
css/pages/car-view.css
19.7 Car Detail
pages/car-detail.html
js/cardetail.js
js/car/car-detail.js
js/modules/car/detail/
js/car/seat/

狀態：

🔄 Transitional

修改前先做 Dependency Audit。

19.8 Calendar
js/modules/calendar/

Auth：

calendar-auth.js

Provider：

calendar-provider-google.js

Sync：

calendar-sync.js

Data：

calendar-data.js

Config：

calendar-config.js

Schedule：

calendar-schedule-check.js

Controller：

calendar-controller.js
19.9 Create Car
pages/createcar.html
js/createcar.js

Related：

js/car/car-create.js
js/car/seat/
js/modules/calendar/
19.10 Edit Car
pages/editcar.html
js/editcar.js

Related：

js/car/car-edit.js
19.11 Personal Recruit Page
pages/recruit.html
js/recruit/
css/pages/recruit.css
js/car/car-relations.js
19.12 Player Profile
pages/myprofile.html
js/myprofile.js
js/core/identity.js

Related Candidate：

js/player/player-profile.js

必須保護：

Player Profile
linkedPlayerIds
Historical Identity

Current Runtime：

pages/car-detail.html
↓
js/modules/car/detail/            ✅ Current Runtime
├─ application/
├─ controller/
├─ matching/
├─ player/
├─ render/
└─ upgrade/

目前已確認 pages/car-detail.html 直接載入：

js/modules/car/detail/application/
js/modules/car/detail/controller/
js/modules/car/detail/matching/
js/modules/car/detail/player/
js/modules/car/detail/render/
js/modules/car/detail/upgrade/

狀態：

✅ Confirmed Current Runtime
Transitional Runtime
js/cardetail.js

狀態：

🔄 Transitional Runtime

原因：

目前仍有 Runtime Responsibility。

已確認：

detail-init.js
→ 暫時不重複啟動舊 cardetail.js

detail-page-render.js
→ 目前部分申請卡內容仍由 cardetail.js 處理

detail-upgrade.js
→ 仍保留 cardetail.js 相容邏輯

因此：

js/cardetail.js

目前不可刪除、不可標示 Legacy。

Compatibility Runtime
js/seat.js

狀態：

🔄 Compatibility Runtime

原因：

目前仍明確保留給：

cardetail.js
editcar.js

等舊 Runtime 使用。

因此：

不得先行移除。

Legacy Candidate
js/car/car-detail.js

狀態：

⚠️ Legacy Candidate

目前 Audit 結果：

未發現 HTML Runtime 引用
未發現 JS Runtime 引用

目前先保留。

禁止直接刪除。

後續若確認：

No Import
No Script Load
No Runtime Call
No Data Dependency

才可升級為：

🗑 Deprecated
Backup
js/cardetail-v2-backup-20260801.js.js

狀態：

📦 Backup Only

用途：

Historical Reference
Rollback Reference
Code Comparison

不作 Current Runtime。

Car Detail Current Architecture
pages/car-detail.html
│
├─ js/modules/car/detail/        ✅ Current Runtime
│
├─ js/cardetail.js               🔄 Transitional Runtime
│
├─ js/seat.js                    🔄 Compatibility Runtime
│
├─ js/car/car-detail.js          ⚠️ Legacy Candidate
│
└─ cardetail-v2-backup...        📦 Backup Only

核心：

Car Detail
目前仍處於 Transitional Migration。

新模組已正式進入 Runtime，

但舊 cardetail.js 尚未完全退場。

因此：

Do Not Delete Transitional Files
Before Dependency Audit Is Complete
19.8 Calendar

貼好、存檔後，**Car Detail 這組就正式完成第一輪 Audit**。

下一組我建議處理最容易混淆的：

```text
js/app.js
vs
js/common/app.js

因為這組通常可以很快判斷誰是真入口。