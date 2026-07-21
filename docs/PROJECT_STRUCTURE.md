# JLY Host System 專案分類規則

> Version：1.0
>
> 更新日期：2026-07
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

## 1.

先建立架構，再持續填充內容。

允許空模組存在。

避免未來大量搬移程式。

---

## 2.

一個功能只應有一個主要負責模組。

例如：

席位功能

↓

永遠放 seat 模組。

不要今天放 cardetail，

明天又放 player。

---

## 3.

若已有專用模組，

新功能不得再加入大型舊檔案。

---

## 4.

頁面負責：

- 畫面
- 按鈕
- 顯示

不要負責大量商業邏輯。

---

## 5.

資料操作應集中。

不要同一件事情分散很多地方修改。

---

## 6.

所有功能皆需預留：

- 玩家
- 主揪
- DM
- 工作室
- 管理員

等角色權限。

---

## 7.

所有功能皆須考慮未來跨功能整合。

例如：

玩家

↓

劇本人生

↓

統計

↓

通知

↓

LINE

不得互相衝突。

---

# 三、專案目錄

```
docs/
    專案規範

css/
    網站樣式

js/
    JavaScript 模組

firebase/
    Firebase 設定

pages/
    HTML 頁面

images/
    圖片

assets/
    靜態資源
```

---

# 四、JavaScript 模組

## common

共用工具。

```
js/common/
```

負責：

- app
- utils
- storage
- navigation
- constants
- permissions

---

## car

車團核心。

```
js/car/
```

負責：

- 建立車
- 編輯車
- 車團詳細
- 車團列表
- 車團狀態
- 車團資料
- 車團操作
- 舊資料升級

---

### seat

```
js/car/seat/
```

負責：

- 建立席位
- 玩家入座
- 空位
- 換位
- 自動配置
- 席位排序
- 席位資料

---

### player

```
js/car/player/
```

負責：

- 車內玩家
- 玩家資料
- 編輯玩家
- 加入
- 移除
- 玩家畫面

---

### application

```
js/car/application/
```

負責：

- 玩家報名
- 待審核
- 核准
- 拒絕
- 候補

---

### history

```
js/car/history/
```

負責：

- 車團時間軸
- 歷史紀錄
- 系統事件
- 玩家事件

---

## player

```
js/player/
```

負責：

- 玩家資料庫
- 玩家搜尋
- 玩家統計
- 個人資料
- LINE 綁定
- 關係紀錄

---

## studio

```
js/studio/
```

負責：

- 工作室
- DM
- 劇本資料
- 排班
- 店家權限

---

## notification

```
js/notification/
```

負責：

- 行前提醒
- LINE 訊息
- 徵人文案
- 通知設定

---

## report

```
js/report/
```

負責：

- 統計
- 報表
- 匯出
- 文字檔

---

# 五、CSS 規劃

## 共用元件

```
css/components/
```

包含：

- buttons
- cards
- forms
- modal
- navigation
- status-tags

---

## 頁面樣式

```
css/pages/
```

包含：

- mycar
- car-detail
- create-car
- edit-car
- player-profile
- player-database
- studio

---

# 六、Docs 文件

```
docs/

PROJECT_STRUCTURE.md
```

專案總架構。

---

```
CODING_RULE.md
```

程式撰寫規範。

---

```
DATABASE_RULE.md
```

資料庫規範。

---

```
VERSION_HISTORY.md
```

版本紀錄。

---

```
ROADMAP.md
```

未來規劃。

---

預計新增：

```
UI_RULE.md
```

UI 設計規範。

```
NAMING_RULE.md
```

命名規範。

```
FIREBASE_RULE.md
```

Firebase 規範。

---

# 七、重構原則

目前舊版 JavaScript 保留。

不得直接刪除。

所有搬移皆採：

滾動式重構。

也就是：

碰到哪個功能，

就搬移哪個功能。

不得一次全部重寫。

---

# 八、版本原則

所有重大修改：

- 保留上一版
- 完成測試
- 確認正常
- 再移除舊程式

---

# 九、未來方向

JLY Host System 並非單一網站。

未來將逐步擴充：

- 玩家系統
- 主揪系統
- 工作室系統
- DM 系統
- 劇本資料庫
- LINE 整合
- Theme Workshop
- 權限系統
- 統計中心
- 手機 App

所有新功能皆需遵守本文件架構。

---

# 十、最重要的原則

功能可以慢慢增加。

程式可以慢慢重構。

但是：

**架構不能亂。**

分類永遠優先於方便。

可維護性永遠優先於短期速度。

這份文件將作為 JLY Host System 的長期開發藍圖。