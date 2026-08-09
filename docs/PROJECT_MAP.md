# JLY Host System｜Project Map

> Status: Working Map
> Version: V1
> Established: 2026-08-09
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

# 2. Status Legend

## ✅ Confirmed

已確認實際存在，且已有內容或已確認目前功能關係。

注意：

「存在／有內容」不一定等於「Official Runtime Entry」。

---

## 🟡 Reserved / Empty

已建立但目前：

- 空白
- 尚未實作
- 作為未來架構預留

不得因為空白直接視為 Legacy。

---

## 🔄 Transitional

新舊架構目前同時存在。

可能代表：

- 新模組正在逐步接管
- 舊入口仍負責部分 Runtime
- Migration 尚未完成

不得直接刪除舊檔。

---

## ⚠️ Legacy Candidate

疑似：

- 舊版本
- Backup
- Duplicate
- 已被新架構取代

但尚未完成 Dependency Audit。

只能列入 Audit，不得直接刪除。

---

## 🗑 Deprecated

已正式確認不再作為開發入口。

是否實際刪除仍需另外確認。

---

## ❓ Audit Required

已確認檔案存在，但：

- 尚未讀取內容
- 尚未確認 HTML 載入
- 尚未確認 Runtime Dependency
- 尚無足夠證據判定責任

不得把推測寫成正式事實。

---

## 🔒 External Dependency

第三方套件或外部依賴。

例如：

`node_modules/`

不納入 JLY 自有模組盤點。

---

# 3. Current Development State

2026-08-09 已完成「我的車」Identity 歷史資料修復。

目前已確認：

- 「我是玩家」歷史資料成功找回
- 正確舊 Player Profile ID 已找回
- 原 46 台歷史玩家車成功辨識
- 不同歷史 Player ID 可透過 `linkedPlayerIds` 串聯
- `linkedPlayerIds` 已開始保存至 Firebase Player Profile
- `identity.js` / `myprofile.js` 已進行 Identity 安全化
- 「我主揪的」與「我是玩家」已正常分開
- Tab 與 Car Card 身份燈號使用同一套角色判斷方向

目前：

**JLY Account V1 / Mobile Cross-device Identity 暫停。**

未來 Account V1 必須建立於現行 Identity 架構之上，不建立第二套 Player Identity。

---

# 4. Folder Structure

> 本區以 2026-08-09 實際專案檔案樹為基準。
>
> `node_modules/` 不展開。
>
> `project-files.txt`、`project-tree.txt` 為本次盤點產生的輔助檔案，不列為正式功能模組。

## 4.1 Root

```text
JLY_Host_System/
│
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
├─ index.html
├─ package.json
└─ package-lock.json

config/
├─ constants.js                    🟡
├─ permissions.js                  🟡
├─ roles.js                        🟡
└─ theme.js                        🟡

config/
├─ constants.js                    🟡
├─ permissions.js                  🟡
├─ roles.js                        🟡
└─ theme.js                        🟡

docs/
├─ CODING_RULE.md                  🟡
├─ DATABASE_RULE.md                🟡
├─ ENGINEERING_STANDARD.md         ✅
├─ PROJECT_STRUCTURE.md            ✅
├─ PROJECT_MAP.md                  ✅
├─ ROADMAP.md                      🟡
└─ VERSION_HISTORY.md              🟡

firebase/
└─ firebase.js

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
   css/cardetail.css

css/pages/car-detail.css

css/mycar.css
css/pages/mycar.css

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

js/common/
├─ app.js
├─ constants.js
├─ navigation.js
├─ permissions.js
├─ storage.js
└─ utils.js

js/app.js
js/storage.js
js/utils.js

js/core/
└─ identity.js                    ✅

js/migrations/
└─ car-ownership-v1.js


---

## 第 3 段／8：Folder Structure 下半部

```markdown
---

## 4.11 Car

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

js/modules/calendar/
├─ calendar-auth.js
├─ calendar-config.js
├─ calendar-controller.js
├─ calendar-data.js
├─ calendar-detail-actions.js
├─ calendar-provider-google.js
├─ calendar-schedule-check.js
└─ calendar-sync.js

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

   js/modules/core/upgrade/
├─ upgrade-car.js
├─ upgrade-controller.js
├─ upgrade-player.js
└─ upgrade-seat.js

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

js/modules/staff/
├─ staff-actions.js
├─ staff-controller.js
├─ staff-data.js
└─ staff-render.js

js/modules/
├─ notification/                   🟡
├─ report/                         🟡
├─ seat/                           🟡
├─ studio/                         🟡
└─ timeline/                       🟡

js/notification/
js/report/
js/studio/
js/car/seat/

js/notification/
├─ line-message.js
├─ notification-settings.js
├─ recruitment-text.js
└─ reminder.js

js/player/
├─ line-account.js
├─ player-database.js
├─ player-profile.js
├─ player-relationships.js
├─ player-search.js
└─ player-stats.js

js/report/
├─ car-report.js
├─ export.js
├─ player-report.js
└─ studio-report.js

js/ui/
├─ components/                     🟡
└─ pages/                          🟡

js/vendor/

services/
├─ cloud/                          🟡
├─ firebase/                       🟡
├─ line/                           🟡
└─ vercel/                         🟡

shared/
├─ dialog/                         🟡
├─ emoji/                          🟡
├─ icons/                          🟡
└─ templates/                      🟡

node_modules/                       🔒


---

## 第 4 段／8：Module Responsibility＋Official File List

```markdown
---

# 5. Module Responsibility

> Responsibility 分成「已確認」與「待確認」。
>
> 尚未讀取實際程式內容的模組，不因檔名看起來合理就直接寫成正式責任。

## 5.1 Identity

```text
js/core/identity.js

js/car/seat/

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

js/matching/

matching-controller.js
→ 流程協調

matching-data.js
→ Matching Data

matching-actions.js
→ Matching Actions

matching-calendar.js
→ Matching Calendar

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

js/modules/calendar/

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

js/modules/car/detail/

Controller
Player
Application
Matching
Render
Upgrade

js/cardetail.js
js/car/car-detail.js

js/player/

js/modules/staff/

car.staffSlots

Identity
→ js/core/identity.js

Firebase
→ firebase/firebase.js

Car Domain
→ js/car/

Seat Engine
→ js/car/seat/

Matching
→ js/matching/

Calendar
→ js/modules/calendar/

Car Detail V3
→ js/modules/car/detail/

Member
→ js/modules/member/

Staff
→ js/modules/staff/

Player
→ js/player/

Recruit
→ js/recruit/

Notification
→ js/notification/

Report
→ js/report/

Studio
→ js/studio/

Migration
→ js/migrations/

Home
→ index.html

Car Detail
→ pages/car-detail.html

Car View
→ pages/car-view.html

Create Car
→ pages/createcar.html

Edit Car
→ pages/editcar.html

Join
→ pages/join.html

Matching
→ pages/matching.html

Matching Vote
→ pages/matching-vote.html

My Car
→ pages/mycar.html

My Profile
→ pages/myprofile.html

Recruit
→ pages/recruit.html

LINE Callback
→ pages/line-callback.html

Player / Database
→ pages/players.html
→ pages/database.html

js/app.js
vs
js/common/app.js

js/storage.js
vs
js/common/storage.js

js/utils.js
vs
js/common/utils.js

js/cardetail.js
vs
js/car/car-detail.js
vs
js/modules/car/detail/

js/playerDatabase.js
vs
js/player/player-database.js

css/cardetail.css
vs
css/pages/car-detail.css

css/mycar.css
vs
css/pages/mycar.css


---

## 第 5 段／8：Dependency Map

```markdown
---

# 7. Dependency Map

> 本區只記錄目前已有足夠依據的依賴方向。
>
> 尚未實際確認 import / script loading / function call 的關係，以 `❓` 標示。

## 7.1 Identity / My Car

目前核心關係：

```text
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

pages/car-detail.html
        ↓
Old / Transitional Runtime
        │
        ├─ js/cardetail.js              ❓
        ├─ js/car/car-detail.js         ❓
        │
        └─ js/modules/car/detail/
             ├─ controller/
             ├─ player/
             ├─ application/
             ├─ matching/
             ├─ render/
             └─ upgrade/

             pages/car-view.html
      ↓
js/car/car-view.js
      ↓
Car Data
      ↓
js/car/car-view-render.js
      ↓
Player-facing View

css/pages/car-view.css

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

Matching
    ↓
Selected Result
    ↓
matching-createcar.js
    ↓
Car

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

Default = OFF

Car
 ↓
staffSlots
 ↓
Staff Module
 ↓
Car Detail / Player View / Matching

dmName
dmList

Application
     ↓
Approve
     ↓
Player
     ↓
Seat Assignment
     ↓
Seat Engine

Account
   ↓
Identity Core
   ↓
Player Profile
   ↓
linkedPlayerIds
   ↓
Historical Player Data

Account
   ↓
New Independent Player Identity


---

## 第 6 段／8：Firebase / Data Map

```markdown
---

# 8. Firebase / Data Map

> 本區目前為 Working Data Map。
>
> 只記錄已由現行開發確認的資料關係。
>
> 完整 Collections / Documents / Read / Write Audit 尚未完成，未確認內容不得自行補猜。

## 8.1 Firebase Entry

```text
firebase/firebase.js

Player Profile
├─ Current Player Profile ID
└─ linkedPlayerIds[]

js/core/identity.js

Account                    ← Future
   ↓
Player Profile
   ↓
linkedPlayerIds[]
   ↓
Historical Player IDs
   ↓
Car.players

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

Player In Car
├─ playerId
├─ playerName
├─ displayName
├─ hostAlias
├─ hostNote
├─ position
├─ roleChoice
├─ isCrossPlay
├─ status
├─ joinedAt
└─ source

Application
├─ playerName
├─ position
├─ isCrossPlay
├─ createdAt
├─ status
└─ hostAlias

Car
└─ staffSlots

dmName
dmList

matching
├─ candidateSlots
├─ responses
├─ selectedDates
├─ commonSlots
└─ selectedSlotId

participant
├─ participantType
├─ participantKey
├─ participantId
└─ participantName

participantType = dm
dmId
dmName

participantType = player
playerId
playerName

History
├─ type
├─ text
└─ time

Collection
→ Document
→ Field
→ Read By
→ Write By
→ Migration
→ Legacy Fields


---

## 第 7 段／8：Legacy / Duplicate Audit

```markdown
---

# 9. Legacy / Duplicate Audit

> 本區只負責標記與風險管理。
>
> 「疑似舊檔」不等於「可以刪除」。

## 9.1 Backup Candidate

```text
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
js/modules/report/
js/modules/seat/
js/modules/studio/

js/notification/
js/report/
js/car/seat/
js/studio/


---

## 第 8 段／8：Development Entry Points＋Change Log

```markdown
---

# 10. Development Entry Points

> 未來修改功能時先查本區。
>
> Entry Point 表示「從哪裡開始追」，不代表只修改這一支檔案。

## 10.1 我是玩家

Start：

```text
pages/mycar.html
js/mycar.js
js/core/identity.js

js/car/car-relations.js
js/myprofile.js

Identity
  ↓
Player Profile
  ↓
linkedPlayerIds
  ↓
Historical Player IDs
  ↓
Car Player Relationship
  ↓
我是玩家

pages/mycar.html
js/mycar.js

js/car/car-list.js
js/car/car-card.js
js/car/car-data.js
js/car/car-status.js
js/core/identity.js

js/car/seat/
seat-data.js
seat-rules.js
seat-layout.js
seat-assignment.js
seat-actions.js
seat-render.js
seat-board.js
css/components/seat-engine.css
seat-controller.js
drag.js
player-drag.js
player-move-pipeline.js
player-move-executor.js
pages/matching.html
js/matching/
css/pages/matching.css

matching-controller.js

matching-data.js
matching-matrix.js
matching-render.js
matching-calendar.js
matching-conflict.js
matching-actions.js
matching-createcar.js

pages/matching-vote.html
js/matching/matching-vote.js
css/pages/matching-vote.css

matching-data.js
matching-matrix.js
matching-calendar.js

pages/car-view.html
js/car/car-view.js
js/car/car-view-render.js
css/pages/car-view.css

car.staffSlots

pages/car-detail.html
js/cardetail.js
js/car/car-detail.js
js/modules/car/detail/
js/modules/car/detail/player/
player-search.js
player-manual-add.js
player-actions.js
js/car/seat/

js/modules/car/detail/application/application-actions.js
js/car/application/
Application
 ↓
Player
 ↓
Seat Engine

10.10 工作人員

Start：

js/modules/staff/

Data：

car.staffSlots

Car Detail：

js/modules/car/detail/

Player View：

js/car/car-view-render.js

Matching：

js/matching/

10.11 Calendar

Start：

js/modules/calendar/

Auth：

calendar-auth.js

Google Provider：

calendar-provider-google.js

Sync：

calendar-sync.js

Data：

calendar-data.js

Config：

calendar-config.js

Schedule Check：

calendar-schedule-check.js

Car Detail：

calendar-detail-actions.js

Controller：

calendar-controller.js

10.12 建立車團

Start：

pages/createcar.html
js/createcar.js

Audit / Related：

js/car/car-create.js

涉及 Seat：

js/car/seat/

涉及 Calendar：

js/modules/calendar/
10.13 編輯車團

Start：

pages/editcar.html
js/editcar.js

Audit / Related：

js/car/car-edit.js
10.14 個人揪團頁

Start：

pages/recruit.html
js/recruit/
css/pages/recruit.css

Car Relation：

js/car/car-relations.js
10.15 Player Profile

Start：

pages/myprofile.html
js/myprofile.js
js/core/identity.js

Related Candidate：

js/player/player-profile.js

任何修改必須保護：

Player Profile
linkedPlayerIds
Historical Identity
10.16 Player Database

先確認目標頁：

pages/database.html
pages/players.html

Possible Related：

js/database.js
js/playerDatabase.js
js/player/player-database.js
js/player/player-search.js

狀態：

❓ Dependency Audit Required

10.17 Studio

Start：

js/studio/

依功能：

DM Profile
→ dm-profile.js

DM Schedule
→ dm-schedule.js

Studio Car
→ studio-car.js

Permissions
→ studio-permissions.js

Studio Profile
→ studio-profile.js

Script
→ studio-script.js

js/modules/studio/ 目前為 Reserved，不自行搬移。

10.18 Notification / LINE Reminder

Start：

js/notification/
LINE Message
→ line-message.js

Settings
→ notification-settings.js

Recruitment Text
→ recruitment-text.js

Reminder
→ reminder.js
10.19 Report / Export

Start：

js/report/
Car Report
→ car-report.js

Player Report
→ player-report.js

Studio Report
→ studio-report.js

Export
→ export.js
10.20 Identity / Account

Current Identity：

js/core/identity.js

Account V1：

PAUSED

Future：

Account
 ↓
Identity Core
 ↓
Player Profile
 ↓
linkedPlayerIds
 ↓
Historical Player Data

禁止建立另一套獨立 Player Identity。

11. Project Map Maintenance Checklist

每次完成涉及架構的開發時檢查：

 Folder Structure 是否改變
 Module Responsibility 是否改變
 Official File List 是否改變
 Dependency Map 是否改變
 Firebase / Data Map 是否改變
 Legacy / Deprecated List 是否改變
 Development Entry Points 是否改變

若沒有架構變更，不需要為了形式修改 Project Map。

若任何一項有變：

程式與 Project Map 同一輪更新。

12. Architecture Change Log
2026-08-09｜Project Map V1 Established

建立第一版 JLY Host System Project Map。

完成：

Root Folder Inventory
CSS Folder Inventory
JS Folder Inventory
HTML Page Inventory
Services / Shared Reserved Structure
Identity Core Location
Seat Engine Location
Matching Location
Calendar Location
Car Detail V3 Location
Player / Recruit / Notification / Report / Studio Location
Initial Official File List
Initial Dependency Map
Initial Firebase / Data Map
Initial Legacy / Duplicate Audit
Development Entry Points

同日 Identity 修復狀態：

歷史「我是玩家」資料恢復
linkedPlayerIds 架構開始正式保存
歷史不同 Player ID 可回歸同一 Identity
我主揪／我是玩家分類恢復
Account V1 暫停

13. Current Project Map Status

目前 Project Map：

Folder Structure              → V1 Established
Module Responsibility         → Working
Official File List            → Working
Dependency Map                → Working
Firebase / Data Map           → Working
Legacy / Duplicate Audit      → Working
Development Entry Points      → V1 Established

尚未完成的部分不阻塞正常開發。

後續採 Rolling Audit：

開發功能
   ↓
查 Project Map
   ↓
進入正式 Entry Point
   ↓
遇到未確認舊／新架構
   ↓
Audit
   ↓
修改程式
   ↓
同步更新 Project Map
14. Permanent Architecture Principle

JLY Host System 不依賴使用者記住每支程式的位置。

「功能在哪支檔案」由 Project Map 管理。

未來新增、拆分、搬移、取代任何架構時：

「架構有變，地圖就一起變。」

Project Map 必須持續反映實際專案，而不是停留在建立當天的歷史快照。


