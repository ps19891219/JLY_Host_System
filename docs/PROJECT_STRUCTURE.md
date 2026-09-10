# JLY Host System 專案分類規則

> Version：1.1
>
> 更新日期：2026-09-10
>
> 本文件為 JLY Host System 專案的主要架構說明。
>
> 所有新功能、重構與擴充，皆以本文件為最高架構依據。

---

# 一、開發理念

JLY Host System 採用模組化設計。

目標不是一次完成所有功能，而是建立一套可以持續成長、多人維護、容易擴充的系統。

所有功能皆採用：

> 滾動式重構（Rolling Refactor）

也就是：

- 新功能正常開發
- 修改舊功能時，同步搬移到新模組
- 不一次全部重寫
- 不破壞目前可正常使用的功能

---

# 二、核心開發原則

## 1. 先建立架構，再持續填充內容

允許空模組存在，避免未來大量搬移程式。

## 2. 一個功能只應有一個主要負責模組

例如席位功能永遠放在 seat 模組，不要今天放 cardetail，明天又放 player。

## 3. 若已有專用模組，新功能不得再加入大型舊檔案

## 4. 頁面只負責畫面、按鈕、顯示

不要負責大量商業邏輯。

## 5. 資料操作應集中

不要同一件事情分散很多地方修改。

## 6. 所有功能皆需預留角色權限

包含玩家、主揪、DM、工作室、管理員等。

## 7. 所有功能皆須考慮未來跨功能整合

玩家 → 劇本人生 → 統計 → 通知 → LINE，不得互相衝突。

## 8. 已定案模組不得被其他功能順手重寫

修改前先確認本文件、對應 Project Map／Module Contract 與既有完成狀態。跨模組修改必須有明確依賴理由，並完成相關 Regression。

## 9. Read View 不得成為第二份 Core

一般查看優先讀取可重建的 View／Projection。新增、修改、刪除時更新正式 Core 並同步受影響 View；編輯只讀取需要的正式單筆或有限範圍資料。不得為了顯示頁面反覆掃描整個正式資料庫。

---

# 三、專案目錄

```
docs/       專案規範
css/        網站樣式
js/         JavaScript 模組
firebase/   Firebase 設定
pages/      HTML 頁面
images/     圖片
assets/     靜態資源
```

---

# 四、JavaScript 模組

## common

`js/common/`

負責 app、utils、storage、navigation、constants、permissions。

## car

`js/car/`

負責建立車、編輯車、車團詳細、車團列表、車團狀態、車團資料、車團操作、舊資料升級。

### seat

`js/car/seat/`

負責建立席位、玩家入座、空位、換位、自動配置、席位排序、席位資料。

### player

`js/car/player/`

負責車內玩家、玩家資料、編輯玩家、加入、移除、玩家畫面。

### application

`js/car/application/`

負責玩家報名、待審核、核准、拒絕、候補。

### history

`js/car/history/`

負責車團時間軸、歷史紀錄、系統事件、玩家事件。

## player

`js/player/`

負責玩家資料庫、玩家搜尋、玩家統計、個人資料、LINE 綁定、關係紀錄。現行 canonical Person collection 名稱仍為 `players`，語意為 Person Directory；其他功能不得另建人物核心。

## studio

`js/studio/`

負責工作室、DM、劇本資料、排班、店家權限。

## work-schedule

`js/modules/work-schedule/`

Work Schedule 正式責任邊界：

- `work-schedule-model.js`：純資料規則、legacy 相容與跨日計算。
- `work-schedule-read-view.js`：Cloud View／Projection Builder。一般 Dashboard 與 Work Hub 只讀這層；僅在缺 View 的 bootstrap 或正式 write 後重建受影響範圍。
- `work-schedule-dashboard.js`：每日班表 View、月份切換、只看我的、批次入口、Google 同步入口。不得在一般瀏覽時掃描 Person Directory 或直接查整月 Core Shift。
- `work-schedule-staff-slots.js`：單日 Shift Assignment／工作人員欄位與批次欄位修改。資料來源由 Dashboard View 傳入；只有開啟人員選擇時才載入 Person Directory。
- `work-schedule-work-hub.js`：Work 與 Role Pool 設定、從既有 Work 建立 Shift。Work 首頁讀 Work Index View；進入編輯後才讀取單一正式 Work。
- `work-schedule-person-create.js`：在 Role Pool 搜尋時建立 canonical Person 並掛回該 Role Pool。不得承擔 Work 修復、排班儲存或頁面 reload。
- `work-schedule-google.js`：Work Schedule 對既有 Calendar Core 的 Adapter，不建立第二套 Google OAuth／Calendar Provider。
- `work-schedule-v2.js`：保留作歷史／回退參考，不再載入正式 Work Schedule 頁面，不得在背景執行重複讀取或綁定事件。

正式資料：`workScheduleWorks`、`workShifts`、canonical Person `players`。

可重建 View：`workScheduleViews`。View 不是第二份正式資料來源。

嚴禁在正常頁面啟動流程中使用全域 `MutationObserver` 反覆改寫 Dashboard DOM、重複載入 Dashboard script、掃描全部 Works、掃描全部 Person Directory、或以 `location.reload()` 作為寫入後同步方式。

## notification

`js/notification/`

負責行前提醒、LINE 訊息、徵人文案、通知設定。

## report

`js/report/`

負責統計、報表、匯出、文字檔。

---

# 五、CSS 規劃

## 共用元件

`css/components/`

包含 buttons、cards、forms、modal、navigation、status-tags。

## 頁面樣式

`css/pages/`

包含 mycar、car-detail、create-car、edit-car、player-profile、player-database、studio、work-schedule。

---

# 六、Docs 文件

- `PROJECT_STRUCTURE.md`：專案總架構與最高分類規則。
- `ENGINEERING_STANDARD.md`：工程標準。
- `JLY_CLOUD_VIEW_CORE_V1.md`：Cloud View／Projection 規則。
- `PERSON_DIRECTORY_V1.md`：canonical Person Directory 規則。
- `CODING_RULE.md`：程式撰寫規範。
- `DATABASE_RULE.md`：資料庫規範。
- `VERSION_HISTORY.md`：版本紀錄。
- `ROADMAP.md`：未來規劃。

預計新增 UI_RULE、NAMING_RULE、FIREBASE_RULE 等規範時，必須同步本文件。

---

# 七、重構原則

目前舊版 JavaScript 可保留作回退與歷史參考，但不得因「保留」而同時在正式頁面背景執行。所有搬移採滾動式重構：碰到哪個功能，就把該功能搬到責任模組；不一次全部重寫，也不允許新舊兩套同時互相改同一份 UI。

---

# 八、版本原則

所有重大修改：保留上一版 → 完成測試 → 確認正常 → 退出舊 runtime → 同步架構文件與完成狀態。

狀態需分開記錄：CODE READY、TEST PASSED、CI PASSED、MERGED、PRODUCTION DEPLOYED、PRODUCTION VERIFIED。

---

# 九、未來方向

JLY Host System 並非單一網站。未來將逐步擴充玩家系統、主揪系統、工作室系統、DM 系統、劇本資料庫、LINE 整合、Theme Workshop、權限系統、統計中心、手機 App。所有新功能皆需遵守本文件架構。

---

# 十、最重要的原則

功能可以慢慢增加，程式可以慢慢重構，但是：

**架構不能亂。**

分類永遠優先於方便。

可維護性永遠優先於短期速度。

已定案的功能必須有清楚責任邊界，其他模組施工不得無意牽動。

這份文件將作為 JLY Host System 的長期開發藍圖。
