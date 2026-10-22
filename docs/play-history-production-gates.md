# JLY 共同場次／Person 去重／遊玩紀錄：正式施工基準

狀態：設計基準與安全關卡；**尚未完成正式實作，不可部署或寫入 Production**。
範圍：PR #330 feature/play-records-ui。取代「每個 viewer 各自擁有歷史場次」的舊提案。

## 不可變原則
1. 一場活動只有一個正式場次識別。既有正式車團沿用 Car ID；歷史補登須有穩定的共用場次 ID，且不能假造或覆寫既有 Car。
2. Car／共同場次是 Source of Truth。主揪、玩家、DM、NPC 是同一場次上的參與關係及授權角色，不是場次所有權。
3. Person Directory 使用既有 canonical Person／Identity／LINE。相同真人的重複 Person 經核對後歸戶為一個 canonical Person；舊 ID 只作內部 alias/redirect，不在全部、會員、訪客、搜尋、選人清單重複出現。
4. 歷史參與關係必須經 canonical Person 正規化；LINE 日後認領同一 Person 時，能看到其既有參與場次。不能只靠同名或未驗證 candidate 擅自認領。
5. 正式車團與歷史場次均只存一份共同資料。個人「我的遊玩紀錄」是由參與關係產生的讀取視圖，不是個人複製的 Source of Truth。
6. 寫入時同步維護受影響的 Prepared View；一般頁面只讀 Prepared View，不掃 Car、Person、participants 全庫。View 可以是共用場次摘要加個人輕量 ID 索引，**不必複製整台車給每位玩家**。
7. 每次存取由伺服端安全規則／授權邊界驗證身份及場次角色。共用資料不等於公開主揪私人備註、聯絡資訊或未授權欄位。
8. 維持 Spark 免費方案；禁止整庫掃描、升級 Billing、重建第二套 Car/Person/Identity、直接刪除歷史關聯。

## 施工分支目前實作
- `playHistorySessions/{sessionId}` 是唯一共同歷史場次來源；正式車團 ID 使用 `car:{carId}` 指向既有 Car，不複製 Car。
- `personPlayHistoryViews/{canonicalPersonId}` 僅含精簡場次卡及共同場次 ID；交易同時更新來源及所有受影響 Person View。
- `scripts/person-canonical-migration-dry-run.js` 只讀 `personDirectoryViews/canonical` 一份 Prepared View；舊版全庫遞迴掃描已停用。因未掃描正式 Car／Identity 來源，此輸出只可列候選，不可核准歸戶。
- `services/firebase/person-directory-view-repository.js` 保留 canonical 可見列；晚到的 merged legacy 更新只併入 alias，不會刪掉 canonical 列。
- `pages/my-play-history.html` 仍為 localStorage 預覽；候選 Person ID 仍只是線索，尚未接入共用場次 API。
- Repository 尚無可確認的正式 Firestore 安全規則來源；未驗證前不啟用 Production 寫入。
- `pages/my-play-history.html` 仍為 localStorage 預覽，不可宣稱跨帳號同步完成。
- 既有 Car、MyCar Prepared View、Person Directory canonical、LINE Identity 需先檢視實際 schema 與權限，再接入，不憑空新增相似 collections。
- Repository 尚無可確認的正式 Firestore 安全規則來源；未驗證前不啟用 Production 寫入。

## 實作次序與驗收
1. **Audit**：正式 Car 參與者在 `cars/{carId}`，手機／列表透過 `carDetailViews/{carId}` 與 MyCar Prepared View；Person Directory 使用 `players` Source 與 `personDirectoryViews/canonical`；LINE 認領使用既有玩家 Identity 欄位與核准流程。沒有 Production schema/rules 憑證時不接通寫入。
2. **Person 去重 dry-run**：只讀既有 Prepared View 產出候選群組；同名是線索，不是唯一證據。逐組檢查會員／訪客、LINE 身分、Car 參與關係衝突；提出 canonical 與舊 ID 對照表，使用者確認後才允許受控歸戶。歸戶前保存受影響 View 快照；不能遺失歷史。
3. **共用場次模型**：正式 Car 直接參照 Car ID；非正式歷史補登用共用 session ID。每場 participants 指向 canonical Person，含玩家／主揪／DM／NPC 的場次角色及出席狀態。禁止以同劇本同日期直接合併不同場次。
4. **Read View**：測試 adapter 同步寫共同場次與受影響 Person 的精簡索引；API 授權仍須接上現有 LINE session、canonical Person resolve 與場次角色驗證，才能供頁面使用。
5. **跨人員驗收**：A 建立場次並加入厭角；厭角 LINE 認領 canonical Person 後可見同一場次；兩人看到相同的公開事實、不同角色權限。原本 A/B/C 三筆厭角只顯示一人，三者舊場次都正確歸戶；同一場次不重複計數。
6. **權限與負載驗收**：未參與者拒讀；角色越權拒絕；離團／取消／出席未確認可正確反映；跨裝置；Prepared View 寫入一致性與修復；Firestore 單文件大小／Reads／Writes 成本。
7. **上線關卡**：測試完成後另行取得合併、部署、Production 資料歸戶及正式匯入的明確核准。任何階段不得自行執行 Production 變更。

## 成功定義
「一個人、一個 canonical 身分；一場活動、一份正式紀錄；所有確認參與者依角色查看同一場活動；網頁只讀已整理的 Prepared View。」
