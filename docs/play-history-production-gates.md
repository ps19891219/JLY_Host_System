# JLY 共同場次／Person 去重／遊玩紀錄：正式施工基準

狀態：**PR #330 已完成第一版程式及 CI 測試，仍待受保護 Preview 的真實 LINE 登入／手機驗收及 Production Firestore Rules 核對。未取得核准前不可合併、部署或寫入 Production。**
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

## PR #330 現況（2026-10-23 核對）

- PR Head `eafa358ace9ce9c317b0a4ac99938d3e4a55770c`；受保護 Preview Deployment `dpl_2pPTkz1RiZKG4rcTc82TNYyp3xsm` 狀態 READY，並非 Production。
- `pages/my-play-history.html` 及 `js/play-history-page.js` 已串接 `/api/play-history` 與既有 LINE 登入 Session；localStorage 舊預覽資料**不會自動匯入**。請勿再引用舊版「只有 localStorage 預覽」描述。
- `playHistorySessions/{sessionId}` 是共同歷史場次 Source of Truth，正式 Car 使用 `car:{carId}`；`personPlayHistoryViews/{canonicalPersonId}` 保存精簡個人讀取視圖。
- Car 完成時保留原 Car ID，需 Car 已結束且未取消，並由授權管理者明確確認實際出席；主揪與玩家指向同一 canonical Person 時去重。
- 伺服器透過既有 LINE Session 與 canonical Person 授權查詢；變動寫入共同場次與受影響 Prepared Views 的交易。
- 本輪 CI 測試已通過，但**未**代表受 Vercel Authentication 保護的 Preview 已完成真實手機登入驗收。
- Repository 內未取得實際部署中的 Firestore Security Rules 原始設定；Rules 仍須透過 Firebase 專案管理權限核對，不得以測試假資料代替。
- 目前尚未執行 Production 寫入、Person 合併、歷史補登或正式部署。

## 正式上線前尚未通過的關卡

1. 以具 Vercel 專案權限的帳號進入上述 Preview，使用真實 LINE 登入，在手機驗證本人列表、共同參與者、無權限拒讀及管理者實際出席流程。
2. 從 Firebase 專案核對當前**已部署**的 Firestore Security Rules 與 API 授權邊界，尤其 `playHistorySessions`、`personPlayHistoryViews` 及既有 Car/Person 路徑是否能被前端直接越權讀取或寫入。
3. 針對既有 canonical Person 合併流程，確認會同步遷移或回補 `personPlayHistoryViews`，並有回復與去重測試；不能只依本 PR 的 Alias 查詢測試推定合併遷移已驗收。
4. 以實際資料形狀估算高 Alias 深度、大名單交易的讀寫成本，嚴守 Spark 免費方案。
5. 確認所有關卡後，另行取得使用者合併 PR、正式部署及 Production 資料異動的明確核准。

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
