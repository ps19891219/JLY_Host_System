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

## 既有程式稽核結論
- `js/data-view/play-history-storage.js` 使用 `playHistorySessions/{viewerId}/sessions/{sessionId}` 作正式來源，`playHistoryViews/{viewerId}` 存完整場次。**此個人擁有場次的模型已不符合共同場次規格，必須保持 dormant，禁止啟用正式寫入。**
- `js/data-view/play-history-core.js` 的 `candidates` 只是 Person 線索，並非已驗證參與關係。
- `pages/my-play-history.html` 仍為 localStorage 預覽，不可宣稱跨帳號同步完成。
- 既有 Car、MyCar Prepared View、Person Directory canonical、LINE Identity 需先檢視實際 schema 與權限，再接入，不憑空新增相似 collections。
- Repository 尚無可確認的正式 Firestore 安全規則來源；未驗證前不啟用 Production 寫入。

## 實作次序與驗收
1. **Audit**：找出正式 Car 參與者欄位、既有 Person canonical／alias、`personDirectoryViews/canonical`、LINE 認領、既有 MyCar Prepared View 的精準讀寫路徑；確認目前 main 版本。
2. **Person 去重 dry-run**：只讀既有 Prepared View 產出候選群組；同名是線索，不是唯一證據。逐組檢查會員／訪客、LINE 身分、Car 參與關係衝突；提出 canonical 與舊 ID 對照表，使用者確認後才允許受控歸戶。歸戶前保存受影響 View 快照；不能遺失歷史。
3. **共用場次模型**：正式 Car 直接參照 Car ID；非正式歷史補登用共用 session ID。每場 participants 指向 canonical Person，含玩家／主揪／DM／NPC 的場次角色及出席狀態。禁止以同劇本同日期直接合併不同場次。
4. **Read View**：寫入受影響場次時，同步整理共用場次摘要及受影響 Person 的輕量參與索引。進入我的遊玩紀錄只讀索引與授權摘要；不讀整庫，不把所有場次內容塞入一個無限成長的文件。
5. **跨人員驗收**：A 建立場次並加入厭角；厭角 LINE 認領 canonical Person 後可見同一場次；兩人看到相同的公開事實、不同角色權限。原本 A/B/C 三筆厭角只顯示一人，三者舊場次都正確歸戶；同一場次不重複計數。
6. **權限與負載驗收**：未參與者拒讀；角色越權拒絕；離團／取消／出席未確認可正確反映；跨裝置；Prepared View 寫入一致性與修復；Firestore 單文件大小／Reads／Writes 成本。
7. **上線關卡**：測試完成後另行取得合併、部署、Production 資料歸戶及正式匯入的明確核准。任何階段不得自行執行 Production 變更。

## 成功定義
「一個人、一個 canonical 身分；一場活動、一份正式紀錄；所有確認參與者依角色查看同一場活動；網頁只讀已整理的 Prepared View。」
