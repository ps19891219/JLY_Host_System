# JLY Cloud View Core V1｜Phase G

## 這一版做什麼

正式 `js/mycar.js` 已加入安全的 MyCar View-first 入口。

### 預設狀態

安裝 Phase G 後，View-first 預設「關閉」。

因此：
- 不會自動 Bootstrap
- 不會因為安裝檔案突然讀 Core
- 現有 MyCar 仍可先照 V2.81 使用
- 等 Bootstrap + Consistency 通過後才人工開啟

### View-first 開啟後

正常 MyCar：

```text
myCarViews/{viewerId}
→ 一次 document read
→ Tab / Search / Pagination 全部在這份 View 內完成
```

此分支刻意「沒有 Cars Query fallback」。

如果 View 不存在：
- 顯示錯誤
- 不偷偷改回 Cars full/index query

這是為了避免 Firestore Reads 問題再次被藏起來。

## Migration 操作

在正式 MyCar 頁載入：

`/js/data-view/mycar-view-migration.js`

然後只在你明確要執行 migration 時呼叫：

```js
await JLYMyCarMigration.bootstrapAndCheck()
```

期待：

```text
consistency.ok = true
missingInView = []
staleInView = []
```

確認一致後才：

```js
JLYMyCarMigration.enableViewFirst()
```

重新整理 MyCar。

需要緊急回退：

```js
JLYMyCarMigration.disableViewFirst()
```

重新整理即可。

## 注意

Bootstrap / Checker 會明確讀 Core。
這是一次性 migration / audit 成本，不是正常頁面成本。

不要反覆執行 Bootstrap / Checker。
