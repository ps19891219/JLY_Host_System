# JLY Cloud View Core V1｜Phase F Final Membership Write Audit

## Audit 結論

本輪依目前正式上傳檔案重新檢查 Player / Staff / Car Data 寫入路徑。

### A. Player Manual Add

`player-manual-add.js` 的「既有玩家補入空位」不是新增 Membership。

它只修改：

- `car.slots`
- `updatedAt`

因此：
- 不需要改 `players[]`
- 不需要改 `playerIds`
- 但必須更新 Car Detail View

Phase F 已接 `slots → View Coordinator`。

### B. Player Search

`player-search.js` 目前仍有高風險讀取：

```text
collection("players").get()
```

也就是每搜尋一次名字，都可能讀完整 Players Collection。

這不是 Membership Write 漏洞，但屬 Firestore Reads 高風險來源。

Phase F 不直接把它改成 `normalizedName` Query，原因是：
- 歷史 Player 不保證都有 `normalizedName`
- aliases / nickname / lineDisplayName 目前都可作為搜尋名稱
- 直接切 Query 可能讓歷史玩家搜尋不到

正確後續：
1. 建 Player Search Index / normalizedSearchNames
2. 明確一次性 migration
3. Profile 建立／改名時增量維護
4. 完成一致性檢查後，移除全 Players Collection Scan

### C. Player Actions / Editor / Application / Matching

Phase E 後已確認：
- Players 正式變更同步維護 `playerIds`
- 加入／移除玩家會觸發 Membership View Sync
- 已 bootstrap Viewer 才增量更新 MyCar View
- View 不存在時不偷偷掃 Cars 建立

### D. Staff

Staff 使用 `car.staffSlots[]`，不是 `car.players[]`。

因此：
- Staff / DM 不應被誤算成「我是玩家」
- 不應寫入 `playerIds`
- 但 staffSlots 是 Car Detail View 的必要資料

Phase F 已將 `saveStaffSlots()` 接到 Car Detail View 更新。

### E. DM Application

Project Map 顯示 DM 核准流程會直接修改 `staffSlots`。

目前本輪未取得正式 `dm-application-actions.js` 原檔，因此：
- 不對該檔猜測修改
- Car Detail View 正式切 View-first 前，仍需補這條 direct write path
- 這不阻塞「我的車」MyCar View-first，因為 DM / Staff 目前不屬 MyCar player relationship

## Firestore Reads 另外發現

### Player Search Collection Scan

目前明確存在：

```text
players
→ collection.get()
→ 前端再比對名稱
```

資料越多，每次搜尋越貴。

### Car Data Legacy Fallback

`car-data.js` 仍保留：
- playerIds index migration
- legacy full Cars scan fallback

正常 MyCar View-first 切換後：
- UI 不可再呼叫 legacy scan
- 只能保留在 migration / repair / audit

## Phase F 後切換條件

MyCar 可進 Bootstrap / Consistency 階段，但正式切 View-first 前需：

1. 取得目前正式 `js/mycar.js`
2. 建立 MyCar View-first loader
3. 明確執行一次 Bootstrap
4. 執行 Consistency Checker
5. Host / Player / linkedPlayerIds 數量一致
6. 再關閉 MyCar 正常 UI 的 Cars Query

Car Detail View-first 則另需先補：
- `dm-application-actions.js`
- 其他 direct staffSlots write path
