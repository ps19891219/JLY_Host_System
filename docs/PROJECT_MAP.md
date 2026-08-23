# JLY Host System｜Project Map

> Status: Working Map
>
> Version: V2.99
>
> Last Updated: 2026-08-24
>

## V2.99 Accounting Person View Correction（2026-08-24）

- Activity Summary 正式縮減為「目前總支出＋我的帳務三格摘要＋待處理 Action Index」。移除重複的第二套我欠誰／誰欠我／互抵後大卡，以及店家、分帳、人物付款、待確認四格進度 Dashboard；各狀態回到店家固定區、逐筆帳目、人物明細與 Pending 的正式責任層。
- Person View 第一層固定為 **Expense Responsibility**：共用 `activity-accounting-view-model` 聚合店家基本劇本費、店家額外費分攤與每筆 Transaction Split，顯示總支出／已付／待付／待收及逐項來源。同名不同 Transaction 仍依 `transactionId` 保留多筆，不因標題相同合併。
- 店家基本劇本費人物來源沿用同一 Fee Plan；Current `playerIds × playerFee` 之外，相容既有正式 `memberCharges[]`，避免舊 Fee Plan 已有正式人物負擔但人物頁漏掉劇本費。沒有建立 Person Transaction、Schema、Migration 或 Backfill。
- Person View 第二層才是 **Settlement Relationship**：`帳目／待付／待收／處理中` 四個子分頁依正式 Pairwise 方向與 active Settlement 狀態互斥分流；已申報付款只出現在處理中，不再同時保留第二個付款入口。Transaction、Split、Pairwise 與 Settlement 規則不變。
- `paidAmount` 仍採正式 `accountingFeeCollections + settled Split + settled Settlement` 認列口徑，不以 `總支出 - 待付` 在 Render 猜測；`receivableAmount` 由同一 Pairwise Person Projection 提供。Car Detail 與 LINE 繼續共用同一 Person Projection，LINE 只同步第四格待收顯示，不建立專用計算。
- Pending Navigation 維持 V2.98 Navigation State：待分帳定位 Transaction、待付款定位 Person 待付、待確認定位 Person 處理中，未退回近似 scroll。
- Runtime cache entry：`activity-accounting-view-model.js?v=2`、`accounting-render.js?v=20`、`accounting-controller.js?v=23`、`group-assistant.js?v=13`。新增 Person Projection Unit／Integration coverage 與 390px 真 Browser fixture；完整測試與 Browser 結果以本輪完成回報為準。

## V2.98 Accounting UX Consolidation（2026-08-24）

- Activity Accounting 正式改為「店家帳務固定上層＋玩家帳務四分頁」。店家費用、店家總應收／已支付／還要付與四個收合明細不再是玩家 Tab；玩家分頁只保留總覽／逐筆帳目／人物明細／歷史紀錄。既有 `studio` Navigation State 會安全正規化至總覽，店家 Pending／劇本金額仍透過同一 Navigation State 精準定位固定店家卡。
- 店家主畫面移除大型「新增付款」，右上選單統一為「新增額外費用／支付店家／登記玩家繳費／記錄店家退款」。調整紀錄以正式 Activity Member 顯示名稱解析操作者；無法解析時只顯示主揪／系統使用者，不向 UI 暴露 UUID。
- 我的帳務摘要壓縮為「我欠誰／誰欠我／互抵後」三格，點擊仍導向目前 Person 的人物明細；付款操作收進指定 Person Pair 的第二層 Payment Sheet，支援本次金額（部分／分次）、一般付款、次要選單的幫他代付與請人代付，不增加工程名詞按鈕。
- Delegated request lifecycle 正式校正為 `pending_acceptance → accepted → payment_claimed → settled`。接受只完成原接受待辦並建立責任人為 delegate 的 `delegated_payment_due`；delegate 另按付款時才建立正式 Settlement 與收款確認 Pending。`accepted ≠ paid`，原債務人／實際付款人／收款人語意保持分離。
- Full directed transfer 與 reimbursement 超額代墊仍為 **INCOMPLETE / BLOCKED**；LINE 還款文字指令仍為 Future。本輪不改 Firestore Schema、不 Migration、不建立第二套 Ledger；LINE 仍讀同一 canonical Settlement 狀態。
- LINE Accounting 不新增指令或第二套 Action；只同步 Pending 文案，使 `delegated_payment_acceptance` 顯示待回覆、`delegated_payment_due` 顯示已接受待付款，避免 accepted 後仍顯示成未接受。
- Runtime cache entry：`accounting.css?v=18`、`accounting-repository.js?v=18`、`accounting-render.js?v=19`、`accounting-navigation.js?v=2`、`accounting-actions.js?v=11`、`accounting-controller.js?v=22`、`activity-fee-controller.js?v=11`、`group-assistant.js?v=12`。

## V2.97 Accounting UI Focus Pass 1（2026-08-24）

- 店家帳務移除「先 Render 舊摘要、再隱藏並插入新摘要」的 Transitional UI 接線，現在只建立一套正式主摘要：劇本費算式／額外費用／店家總應收／已支付／還要付；費用項目、玩家繳費、付款紀錄與調整紀錄維持第二層收合。「核銷紀錄」因實際內容是付款新增／修改／取消等 Audit，UI 更名為「調整紀錄」，底層 Action Type 與 Accounting Core 不變。
- 逐筆帳目第一層正式責任限定為該 Transaction 自己的 `title / amount / paidBy / Split / splitStatus`；移除「已列入彙總」及 Split 的 Settlement 狀態文字，狀態只呈現待分帳／分帳中／分帳完成。付款人仍只讀正式 `paidBy / payments` 相容資料，不以 createdBy 或 current user 猜測。
- Duplicate Person Render policy：Split 只按正式 `personId` 辨識，不因同名合併。不同 personId 同名時以「成員 1／成員 2」安全辨識；同一 personId 在同一 Transaction 出現多筆時視為 legacy／資料異常，UI 合成一列、保留每筆金額並顯示待確認警示，不修改、Migration 或回寫 Core 資料。
- Runtime cache entry 更新為 `accounting.css?v=17`、`accounting-render.js?v=18`、`activity-fee-controller.js?v=10`。新增 `accounting-ui-focus` Unit／Integration coverage 與 390px 真 Browser fixture；本輪沒有修改人物明細、Pairwise、LINE、Firestore Schema 或 Production Data。

## V2.96 MyCar Safari Runtime P0 Fix（2026-08-24）

- `5b28166` 的身份正規化接線在 `renderMyCars()` 中錯誤引用另一個 function scope 內的區域變數 `module`；Safari 因 Browser global 不存在 Node `module` 而拋出 `Can't find variable: module`，使 Prepared View 讀取後直接落入「讀取失敗」。這不是 CommonJS export、Prepared View Schema 或 Firestore 資料問題。
- 最小修復為 `renderMyCars()` 自行透過既有 `ensureMyCarViewModule()` 取得 `myCarViewModule`，再呼叫正式 `compactCar()`；沒有改寫 MyCar、Identity Core、Prepared View、Firestore 或 owner/player 身份規則。
- Runtime cache entry 更新為 `mycar.js?v=47`，動態 MyCar View asset 與正式 loader 對齊 `mycar-view.js?v=6`。
- 新增 `tests/data-view/mycar-browser-runtime.test.js`，直接執行 production `js/mycar.js` 且刻意不提供 Node `module`，驗證 Prepared View 能進入 Render、不顯示「讀取失敗」；另以真實本機 Browser 載入 `tests/fixtures/mycar-browser-runtime.html` 驗證正式 asset 執行、卡片 Render 與 Console 無錯誤。owner 綠燈、player-only 藍燈、owner + player 綠燈回歸仍通過；完整測試為 `261 pass / 0 fail`。

## V2.95 Accounting Hierarchy／Navigation／MyCar Identity Regression Fix（2026-08-24）

- Activity Accounting 的 UI 層級確認為兩個不同正式費用來源、同一 Accounting Core：`店家帳務` 顯示劇本基本費／自訂店家費／店家總應收／已支付／還要付與付款紀錄；`逐筆帳目` 只處理餐費、飲料、停車等玩家額外 Transaction 與 Split。店家原有重複摘要維持隱藏，同一組店家數字只呈現一次；V2.94 的 Current Total 計算邊界不變。
- Car Detail 頂部 `金額` 標題由舊 `scrollIntoView(activityFeeSection)` 改接既有 Accounting Navigation State；`summary-render.js` 呼叫 `JLYAccountingController.navigateToStore()`，不 reload 頁面，直接切換 `店家帳務` View 並定位 Accounting 主區。只有 Studio Pending 的 `subview=payment` 才自動展開付款表單，一般劇本金額導覽不誤開表單。
- MyCar 身份燈號正式規則恢復為 `Green = owner / host`、`Blue = player membership`，owner + player 仍依既有 owner precedence 顯示綠燈。`compactCar()` 在已有正式 viewer identities 時只依 `ownerId` 與玩家 Membership 判斷，不再讓 Prepared View／Core 上的舊 `isHost / role / ownerType` 相容欄位覆蓋正式身份。
- MyCar 正常讀取 Prepared View 後，會用該 View 已知的 `identityIds` 與既有 `compactCar()` 重新正規化卡片身份；不新增角色欄位、不 Query Cars、不 Backfill／修改 Firestore。招募、已滿或結束等 car status 不參與身份燈號判斷。
- Runtime cache entry：`summary-render.js?v=2`、`accounting-controller.js?v=21`、`mycar.js?v=46`、`mycar-view.js?v=6`。Regression coverage 新增店家／玩家 View 分層、劇本金額精準導覽、owner/player precedence、stale role flag、status independence 與實際燈號 Render；完整測試為 `260 pass / 0 fail`。

## V2.94 Activity Accounting View Model V1（2026-08-24）

- 新增 Current 共用純 Projection `shared/accounting/activity-accounting-view-model.js`，正式資料流定案為 `店家費用 → 玩家額外 Transaction → Split → Person Projection → Settlement → Activity Summary`。Car Detail 與 LINE Accounting 都呼叫同一個 View Model；它不寫 Firestore、不建立 Person Ledger／LINE Ledger，也不是新的正式帳務來源。
- 五個 View 的正式責任調整為：`總覽`＝活動實際支出與完成狀態、`逐筆帳目`＝玩家額外 Transaction + Split、`人物明細`＝店家 Person Share + Transaction Split 形成的 Person Expense、`店家帳務`＝店家應收／實付／待付、`歷史紀錄`＝已發生操作 Audit。Settlement 只回答人物最後如何付款，不取代 Expense Responsibility。
- 店家 Projection 沿用 `accountingFeePlans/scriptFee` 的 `playerFee × requiredPlayerCount`、`feeItems[].allocations`、`accountingFeeCollections` 與 `accountingExternalPayments`。`店家總應收` 與 `店家實際支付淨額` 分離；未支付的店家應收不進目前活動總支出，付款才加入，退款獨立保存並從實支淨額扣回。
- `cars/{carId}/accountingViews/activityCurrent` 升級為 `schemaVersion=8 / summaryVersion=3`，增加完整玩家額外支出的衍生 `transactionExpenseProjection` 與 `settledPaidByPerson`，讓人物來源不受最近五筆摘要限制。它仍是由 canonical Transaction／Split／Settlement 重建的 Prepared View；既有 mutation invalidation 會使下一次讀取重建，不需要 Migration 或 Production Backfill。
- Activity Current Total 定案為 `店家實際支付淨額 + 玩家額外 expense Transaction`。Split、Obligation、Settlement、代付與還款只做責任分配／結算，不得重複增加活動支出；History 亦不得反向成為 Current Balance Source。
- Person Expense 顯示店家基本費／額外費分攤與每筆 Transaction Split 的來源；已付只採正式玩家收款、已結清 Split／Settlement 的可認列支付，且不因 UI 直接硬減 Pairwise 數字。人物第一層為 `總支出／已付／待付／待收`，誰欠誰與 Settlement 維持第二層。
- 總覽移除完整重複的「我欠誰／誰欠我」卡，只保留精簡 `我的帳務：待付／待收` 並導航 current Person；同時顯示店家付款、分帳、人物付款及待確認等可驗證完成狀態，不自行發明百分比權重。
- Pending Navigation 延續 V2.93：待分帳定位逐筆帳目指定 Transaction、人物待付款／待確認定位指定 Person 與 source Settlement、店家待付款定位店家新增付款。沒有退回近似 scroll。
- LINE `pages/group-assistant.html?tab=accounting` 由 `api/group-assistant-context.js` 取得 canonical scoped 資料後使用同一 View Model；個人頁同步顯示劇本費、額外支出來源、總支出／已付／待付與第二層 Pairwise。LINE 還款指令仍為 Future。
- **INCOMPLETE**：reimbursement 正式持久化、完整三方直接轉付、accepted → later payment 與已連結 JLY Studio 的雙方 Settlement 尚未完成；本輪沒有在 View 假裝完成或擴大 Delegated Payment Core。
- Runtime entry 更新：`pages/car-detail.html` 載入 `activity-accounting-view-model.js?v=1`、`accounting.css?v=16`、`accounting-controller.js?v=20`、`activity-fee-controller.js?v=9`；`pages/group-assistant.html` 載入 `group-assistant.js?v=11`。新增 `tests/accounting/activity-accounting-view-model.test.js`；完整測試為 `252 pass / 0 fail`，coverage 屬 Unit／Integration；Browser 驗收狀態必須依本輪實際本機驗收另行回報，不以 source assertion 冒充 E2E。

## V2.93 Activity Accounting Navigation Calibration（2026-08-23）

- 修正 V2.92 手機 Runtime 只看得到單一大型 active Tab 的 Regression：`css/pages/accounting.css` 現在以 scoped `width:auto / min-width:max-content` 覆蓋全域按鈕寬度，Car Detail 帳務固定顯示可橫向滑動的 `總覽／逐筆明細／人物明細／工作室帳務／歷史紀錄` 五個入口。
- 新增 Current UI 模組 `js/modules/accounting/accounting-navigation.js`，只負責 Car Detail Accounting 的 View Navigation State（target view、Person、人物子分頁與 canonical source id）；它不是 Firebase Schema、Prepared View 或第二份帳務資料。`pages/car-detail.html` 在 Controller 前載入此模組。
- `總覽` 恢復目前 Person 的 `我要支付／我要收回／處理後還要支付／處理後還待收回`，來源仍是既有 gross Obligation 與 Pairwise Projection。`人物明細` 改為 `帳目／待付／待收／處理中` 按鈕式子分頁，不建立 balance 欄位。
- Pending Action 現在是正式 Action Index：待分帳定位指定 Transaction、待付款定位指定 Person 的待付、待確認與 Delegated request 定位處理中、Studio 待付款定位付款表單。導覽沿用 source id，不再只收合 Pending 或近似捲動到某個大區塊。
- 工作室帳務 View 的主畫面校正為 `總費用／還要付／＋新增付款／付款紀錄`；既有費用、玩家收款、Audit 與低頻修正能力仍沿用 Activity Fee Runtime，未修改 Studio Accounting Core。
- 本輪只校正 Car Detail Render／Navigation；Transaction、Split、Pairwise、Settlement、LINE canonical/scoped read 與受限操作均未修改。自動測試基準更新為 `241 pass / 0 fail`；目前是 DOM + Navigation State integration coverage，仍不等同真實手機 Browser E2E。

## V2.92 Activity Accounting Experience V1（2026-08-23）

- Car Detail 的正式 Activity Accounting View 改為手機優先的五個不重載分頁：`總覽／逐筆明細／人物明細／工作室帳務／歷史紀錄`。分頁只重新安排既有 Controller／Render 與 canonical 資料，不建立第二份 Transaction、Person Ledger 或 Derived Ledger；Tab 切換保留頁面位置，逐筆與歷史仍按需讀取。
- 總覽只呈現正式 Activity expense Transaction 加總與「待處理」Action Index；Settlement、代付與退款不重複計入活動總額。`accountingPendingActions` 繼續只保存責任人與 source ID，`去分帳／去確認／去處理` 導向正式 Transaction 或 Person 處理區，不複製帳務內容。
- 人物明細沿用 Pairwise View；只允許相同兩位 Person 雙向互抵，來源仍由 `sourceObligations / offsetObligations → transactionId` 回查 canonical Transaction。禁止跨第三 Person 最佳化的 V2.90 Core invariant 不變。
- `pages/group-assistant.html?tab=accounting` 改為同語意的 LINE Accounting Web View：`總覽／逐筆明細／人物帳務／待處理／歷史`。`api/group-assistant-context.js` 直接讀同一台 Car 的 `accountingEntries`、`accountingSettlements`、`accountingPendingActions`，只輸出目前安全識別 Person 相關的 Transaction、Pair、Pending 與 History；未登入時只提供公開 Activity 摘要。
- 新增 `api/group-assistant-accounting-action.js` 作為 LINE Person 的受限 Action Entry；正式成員只能申報自己的 Pairwise 應付款，只有正式收款 Person 可確認同一筆 `payment_claimed` Settlement。兩個入口都寫回同一 `accountingSettlements` 與 Pending Action，並使 `activityCurrent` summary cache 失效；未建立 LINE Ledger 或第二份付款狀態。
- Studio V1 的未連結工作室付款改為「主揪確認支付即完成」，保存 `createdBy / paidBy` 與 `settlementAuthority=manager_confirmed_payment_v1`，不再建立多一步人工核銷。付款紀錄低頻選單新增修正（Audit before／after）、soft cancel（不再計入已付但不刪歷史）與獨立退款紀錄；玩家收款與工作室付款仍是兩條金流。
- **BLOCKED / INCOMPLETE**：reimbursement 目前仍只有 Delegated Payment 的衍生能力，尚未具備可安全持久化並形成新人物債務的完整 Repository／Pending 生命周期；本輪沒有用 UI View 假裝完成「超過既有應付的額外代墊」。直接轉付的完整三方重導與 accepted → later payment UX 亦維持後續項目。
- LINE 既有「小助手 記帳」Parser 保留；「還款」文字指令仍為 Future，本輪未新增。已連結 JLY Studio 的雙方 Settlement 仍是 Future，不因未連結 Studio V1 流程而宣告完成。
- Runtime entry／cache：新增 `/api/group-assistant-accounting-action`；`pages/group-assistant.html` 載入 `group-assistant.css?v=5`、`group-assistant.js?v=10`；`pages/car-detail.html` 載入 `accounting.css?v=14`、`accounting-render.js?v=17`、`accounting-controller.js?v=18`、`activity-fee-data.js?v=5`、`activity-fee-repository.js?v=4`、`activity-fee-controller.js?v=7`。
- 測試新增 `tests/accounting/activity-accounting-experience.test.js`，涵蓋 Tab 結構、Pending source navigation、LINE canonical/scoped read、受限 Action Entry 與 Studio V1 歷史語意。此 coverage 屬 Unit／Integration 與 Runtime source regression；正式手機 Browser E2E 尚未執行，不可宣稱為完整實機驗收。


## V2.91 Reminder Due Queue + MyCar Seat Projection Sync（2026-08-23）

- Reminder 正式規則仍為每台 Car 明確開啟一份 `cars/{carId}/reminders/preTrip`；開啟當下依 `gameDate`、`offsetDays=1`、`sendTime=15:00`、`Asia/Taipei` 先算好 `scheduledAt`，Scheduler 只喚醒 due-job Dispatcher，不以瀏覽器 Timer 或 Cars full scan 判斷提醒。
- 修正 Reminder starvation：舊 Repository 先以 `scheduledAt <= now` 取前 30 筆後才在記憶體排除 `sent`，歷史已寄送文件可能長期佔滿 limit，使新到期提醒無法進入 Dispatcher。V2.91 改為 Firestore query 先限制 `status=scheduled AND scheduledAt<=now`、按 `scheduledAt` 排序後再 limit；正式複合 Collection Group index 定義於 `firestore.indexes.json`，Firebase 設定入口為 `firebase.json`。
- 新增 `shared/notification/reminder-schedule.js` 作為 Browser／Server 共用的純 Schedule Core；LINE 開啟提醒、Car Detail 設定與 Edit Car 日期重排共用同一個 Asia/Taipei 計算規則。Activity 日期修改會更新同一份 schedule；Activity 取消／結束會將尚未寄送的 schedule 改為 `cancelled` 並清空 `scheduledAt`；既有 Firestore Transaction Claim 仍負責 duplicate protection。
- Scheduler Adapter 維持 cron-job.org → `POST /api/run-reminders`；Dispatcher 只讀已到期、尚未處理的 Reminder，再依 `carId` 讀單台最新 Car 與 active LINE binding。沒有新增 browser polling、Cars full scan 或第二套雲端排程平台。
- MyCar stale seat summary 根因為 `view-impact-resolver.js` 未把 `players`、`playerIds`、`slots` 與 capacity 欄位列入 MyCar impact；玩家核准／移除雖更新正式 Car 與 Car Detail View，MyCar Prepared View 被 Resolver 跳過。V2.91 將正式 Membership／Seat／Capacity mutation 接回既有 MyCar projection。
- `membership-view-sync.js` 會以 mutation 已知的 before／after `playerIds` 與 `players[]` 解析這台 Car 的既有 Viewer Alias，增量更新 Owner 與所有已建立的 member MyCar Views；不掃 Cars、不掃 `myCarViews`，Staff／DM 不會混入 Player Membership。
- MyCar 卡片的男女位、總人數與反串結果仍由正式 `slots[]`（以 `originalType` 判斷座位本質）建立 `seatSummary`；不新增第二份 count、不在 UI 手動加減，也不複製 Seat Engine 的寫入責任。
- Runtime／cache entry 更新：`pages/car-detail.html` 載入 Common Reminder Schedule Core；`pages/editcar.html` 使用 `editcar.js?v=29`；View Runtime Loader 升級 Resolver cache version，Membership mutation loaders 升級 `membership-view-sync.js?v=2`。
- Regression coverage：Reminder 15:00／Asia-Taipei、建立、日期重排、取消、防重複、due-only query；MyCar 玩家加入／移除、固定男女位、總人數、反串與所有已知 member views 同步。本輪不讀寫 Production Firestore、不 Migration、不 Push／Deploy。

## V2.90 Accounting Core Stabilization V1（2026-08-23）

- Studio Accounting 右上操作選單維持既有三個 Action，並由 `css/pages/accounting.css` 的 scoped `.accounting-fee-menu button` 明確覆寫深色文字；不修改全站 `button` 規則，disabled 狀態仍使用灰色。此修復解決正式手機站白底 Popover 內白字不可見的 regression。
- `services/accounting/transaction.js` 修正 completed Transaction 的 return 順序；正式 Transaction 現在會保存由 Split／Payment 產生的 `obligations[]`、`sourceTransactionId` 與 `responsibilityModel=pairwise_v1`，舊資料仍由 Pairwise 相容讀取，不 Migration、不回寫正式資料。
- Accounting Runtime 移除跨 Person 最佳化的 degraded fallback：Repository 缺少 Pairwise Engine 時回報 `accounting_pairwise_engine_unavailable`，Controller 缺少正式 `settlementTransfers` 時回報 `accounting_pairwise_view_unavailable`；不得以 `balanceByPerson` 偷偷重新配對第三人。舊 helper 暫保留供 Legacy Audit，但不再是正式 Runtime fallback。
- Delegated Payment Repository 在主動代付、建立請人代付與接受／拒絕前，會重新讀取該 Car 並驗證實際操作者／被指定者屬於正式 Activity Membership；不能只靠前端按鈕或傳入 `delegated_claim` 取得權限。被指定者接受／拒絕的 Domain 限制保持不變。
- Settlement History 依正式 `debtorPersonId/fromPersonId`、`paidBy/paymentClaimedBy`、`receiverPersonId/toPersonId` 呈現；一般付款顯示「A 付款給 B」，第三人代付顯示「C 代 A 支付給 B」，舊資料缺 `paidBy` 時安全回退一般付款顯示。
- Delegated Payment 已進 Runtime，但目前正式狀態仍為 **INCOMPLETE**：本輪只穩定 Membership 權限與歷史方向；reimbursement 持久化／管理 UI、完整管理與歷史頁、以及 accepted 後另行付款流程均未施工。現行「接受並申報已付款」保持不變。
- Studio Accounting 仍是 Script Village Activity Fee Extension；`accountingExternalPayments.settlementStatus` 是 Extension-level 平行核銷狀態，尚未完全統一進 Common `accountingSettlements`。已連結 JLY Studio 雙方 Settlement、Studio Pending、折扣及錯誤更正完整 Audit 仍未完成。
- Runtime 修改：`services/accounting/transaction.js`、`shared/accounting/delegated-payment.js`、`js/modules/accounting/accounting-repository.js`、`accounting-controller.js`、`accounting-render.js`、`css/pages/accounting.css`；`pages/car-detail.html` 同步更新上述資產 cache version。Regression tests 更新 `accounting-core.test.js`、`accounting-view-chain.test.js`、`accounting-ui.test.js`、`delegated-payment.test.js`。
- Automated tests：`217 tests / 217 pass / 0 fail`；本輪未讀寫 Production Firestore、未 Migration、未 Push／Deploy。

## V2.89 Delegated Payment V1 Runtime（2026-08-22）

- 新增 `shared/accounting/delegated-payment.js` 作為跨 Activity 的代付 Domain；正式區分原債務人 `debtorPersonId/fromPersonId`、實際付款人 `paidBy/paymentClaimedBy` 與收款人 `toPersonId`，不改寫 Transaction、Split 或原始 Pairwise Obligation。
- 「幫他代付」可由正式 Activity Member 主動申報部分金額，不需要原債務人批准；付款仍進入既有 `accountingSettlements` 的 `payment_claimed → 收款方確認 → settled` 流程，核銷時只降低原本同一對 Person 的責任。
- 「請人代付」使用 `accountingDelegatedPayments/{requestId}` 保存請求、接受／拒絕、金額、雙方 Person ID 與 Audit History；被指定者的 `delegated_payment_acceptance` 保存於既有 `accountingPendingActions`，接受前不視為付款，拒絕或接受後完成該 Pending。
- 代付支援部分與多次付款；建立請求、接受請求及主動代付都以目前 View 的同一對 Person 未結清金額作上限，禁止跨第三 Person 自動最佳化。
- reimbursement 預設不產生；只有請求明確保存 `reimbursementRequired=true`、被指定者接受且代付款正式 settled 後，才從 Settlement 歷史衍生 `obligationType=reimbursement` 的一對一責任。該責任 `affectsActivityExpense=false`，不增加 Activity 支出。
- Car Detail Accounting Web 在互抵後明細提供低頻「幫他代付／請人代付」操作，待接受請求顯示於既有「待處理」區；沒有新增 LINE Notification 或手機 Push。
- Runtime 更新：`shared/accounting/delegated-payment.js`、`accounting-repository.js`、`accounting-render.js`、`accounting-actions.js`、`pages/car-detail.html`；測試新增 `delegated-payment.test.js`。
- Schema：新增未來新資料使用的 `accountingDelegatedPayments` 子集合及 Settlement 代付相容欄位；不 Migration 舊資料、不批次修改正式 Car／Settlement、不讀寫 Production Firestore。
- Automated tests：`210 tests / 210 pass / 0 fail`；保留原 193 項並新增 17 項 Delegated Payment Domain／Audit／reimbursement 測試。

## V2.88 Studio Accounting V1 實機驗收修正（2026-08-22）

- Car Detail 店家帳務的「費用項目／玩家繳費／工作室收付款／核銷紀錄」改為四列精簡 Accordion；全部預設收合，點擊同一列切換展開／收起，既有內容、金額與操作不刪除。
- 未連結 JLY 的外部工作室付款沿用 `accountingExternalPayments`，新付款明確保存 `createdBy` 與 `paidBy`，兩者概念保持分離；一般「新增付款」固定以目前登入 Person 為實際付款人，不提供任意 Person 下拉選單。
- 未連結工作室的新付款先記錄 `settlementStatus=payment_claimed`，但不建立無責任人的 Pending Action；主揪可在工作室收付款明細執行「人工核銷」，原付款原地轉為 `settled` 並於 `accountingFeeAuditLogs` 保存 `vendor_payment_manually_settled`、操作者、before／after、時間與 `manager_for_unlinked_vendor` 權限來源。
- 舊 `accountingExternalPayments` 若沒有 Settlement 欄位，維持 Historical Compatibility 並視為既有已核銷歷史，不批次回填、不 Migration。已連結正式工作室的雙方 Settlement 仍維持安全停止，不自行建立 Identity／Settlement Schema。
- 本輪只對 Script Village Activity Fee Extension 增加相容欄位與 UI；沒有建立新 Collection、沒有改動 Common Accounting Core、Pairwise、Transaction、Split、Obligation 或既有 Settlement。
- Future：QR Code 定位為同一筆 Settlement 的短效安全 Action Entry；未來由正式收款方掃描 Token 後開啟同一 Accounting Web 確認收款，不建立 QR 帳務副本、不在 URL 裸露核銷權限。本輪不建立 QR Runtime。
- Runtime 更新：`activity-fee-repository.js`、`activity-fee-controller.js`、`css/pages/accounting.css`、`pages/car-detail.html`；新增 `activity-fee-repository.test.js`，並同步 `accounting-ui.test.js`。
- Automated tests：`193 tests / 193 pass / 0 fail`；原有 191 項無 regression，新增未綁定工作室付款身分／無孤兒 Pending 與人工核銷歷史兩項測試。Git commit／push／deployment 依授權流程暫停。

## V2.87 Studio Accounting V1 店家帳務收口（2026-08-22）

- 本節續寫既有 JLY Accounting Core 藍圖；Studio Accounting 是 Activity Fee 的工作室 View，不建立第二份 Common Transaction／Split；但目前 `accountingExternalPayments.settlementStatus` 仍是 Extension-level 平行核銷狀態，尚未完全接入 Common `accountingSettlements`。
- KEEP：工作室名稱由正式 Car 的 `studioName / organizerName / organizer` 帶入；基本劇本費固定使用 `totalPeople × car.price`；玩家繳費 `accountingFeeCollections` 與店家收付款 `accountingExternalPayments` 維持兩條獨立金流；額外費用仍沿用 `accountingFeePlans/scriptFee.feeItems[]` 與既有分攤邏輯。
- 店家摘要正式規則：沒有額外費用時只顯示「劇本費用／已付款／待付款」；存在正式額外費用時才增加「額外費用／總額」。付款與退款只改變已付／待付，不改寫基本費或費用總額。
- 店家收付款改為 append-only 顯示：可分次登記預付、尾款等付款，退款使用獨立 `kind=refund` 紀錄；原付款、退款、時間及 `accountingFeeAuditLogs` 歷史預設收合並永久保留。
- 「新增額外費用」移除重複的固定費用類型選單，名稱改為自由輸入；工作室低頻操作收進右上 `⋯`，包含新增額外費用、新增付款與新增收款，玩家繳費維持獨立收合區。
- 未連結 JLY 的外部工作室沿用主揪人工登記／核銷與 Audit，不建立等待不存在工作室帳號的 Pending Action，也不形成跨 Activity 工作室餘額。
- PARTIAL：正式工作室 Identity 的「付款方申報 → 工作室確認」雙方 Settlement 尚無可安全沿用的 Activity Fee 狀態／權限接線；為避免主揪直接替已連結工作室 settled，已連結工作室暫停新增收付款操作，留待正式 Settlement Schema／Identity 決策後完成。
- TODO：折扣／減免 Event、錯誤更正 before/after Audit 與工作室正式 Pending Action 尚無既有正式模型；本輪未自行新增 Schema、未 Migration、未讀寫正式 Firestore 資料。
- Runtime 更新：`activity-fee-data.js`、`activity-fee-repository.js`、`activity-fee-controller.js`、`css/pages/accounting.css`、`pages/car-detail.html`；測試由 `activity-fee.test.js` 與 `accounting-ui.test.js` 覆蓋。
- Automated tests：`191 tests / 191 pass / 0 fail`；新增 Studio 摘要條件、額外費用、分次付款、退款與玩家／店家金流分離測試。Git commit 仍須依提交授權流程另行補記。

## V2.86 Accounting V1 三項 Regression 收口（2026-08-22）

- 本節是既有 JLY Accounting 藍圖的正式現況更新，不另建第二份 Accounting 架構文件。
- 正式顯示規則固定為：「我欠誰」＝原始尚未結清應付；「誰欠我」＝原始尚未結清應收；「互抵後總額」＝相同兩位 Person 之間依正式 `fromPersonId / toPersonId` 雙向互抵後的付款或收款結果。
- `shared/accounting/pairwise-obligation.js` 與 Accounting View 負責正式 Pairwise 方向及金額；Renderer 只依既有 `fromPersonId / toPersonId` 顯示「付款／收款」，不得在 UI 重算或跨第三人重新配對。
- Car Detail 的帳務摘要與明細維持同一套正式資料：摘要先顯示，詳細 Transaction／Split 預設收合；使用者第一次展開時才分頁讀取 `accountingEntries`，並按需讀取最近的 `accountingSettlements` 付款／收款／核銷歷史。收合後再次展開不重複查詢。
- Transaction、Split、Settlement 與付款／收款歷史不因結清而刪除；結清只影響目前待處理與摘要金額。詳細帳目仍是唯讀核對區，彙總付款操作保留在「互抵後總額」。
- 劇本費／工作室帳務確認為既有 Script Village Activity Fee Extension，並非第二套 Accounting Core：`activity-fee-controller.js` 從正式 Car 自動取得工作室名稱、固定總人數與每人金額，使用 `固定總人數 × 每人劇本費` 建立／同步基本費；玩家待收與店家待付維持兩條獨立金流，既有訂金、尾款、退款及額外費用接線保留。
- 本輪只修改 UI 語意、正式明細按需接線、Runtime cache version 與測試；未修改 Accounting Core 計算、Firestore Schema 或正式資料，無 Migration。
- 本輪 Runtime 修改：`accounting-render.js`、`accounting-actions.js`、`accounting-controller.js`、`accounting-repository.js`、`pages/car-detail.html`、`css/pages/accounting.css`；測試由 `tests/accounting/accounting-ui.test.js` 覆蓋。
- 尚未處理且不得混入本輪：代付、訪客 Person、完整 Pending Action 擴充及其他後續 Accounting Web 功能。
- Automated tests：`189 tests / 189 pass / 0 fail`；本輪新增兩項 UI／接線回歸測試，既有 187 項未刪除、未放寬。Git commit 仍須依提交授權流程另行補記。

## V2.85 Car Detail Mobile Swipe Runtime 修復（2026-08-20）

- 補回 Transitional Runtime `js/cardetail.js` 的 `swipeNavigationInitialized` 狀態宣告，避免 Detail render 啟用手機左右滑動導覽時因未定義變數中止。
- 此修復與 V2.84 同屬先前 Cloud View 整理時誤刪的基礎宣告；未改動 Car Core、MyCar View-first 或任何資料。


## V2.84 Car Detail Runtime 緊急修復（2026-08-20）

- 修復 Transitional Runtime `js/cardetail.js` 遺失 `getCarId()`，導致 Car Detail 在依 URL `?id={carId}` 讀取 Core Car 前即中止的 regression。
- `pages/car-detail.html` 繼續由 `js/modules/car/detail/controller/detail-loader.js` 依 `carId` 讀取 `cars/{carId}`；本次沒有導入 Car Detail Prepared View、Migration 或資料修改。
- MyCar View-first、MyCar Bootstrap／Repair 邊界與 Cloud View Core V1 封版內容均未變更。


## V2.83 JLY Cloud View Core V1｜MyCar View-first 正式封版（2026-08-20）

### 封版驗證結果

- MyCar Bootstrap 與 Consistency Check 已完成一次正式驗證：`hostReadDocuments=105`、`playerReadDocuments=50`、`uniqueCars=105`、`Core Count=105`、`View Count=105`、`Missing In View=0`、`Stale In View=0`。
- 上述 Bootstrap 已完成，不得因正常開頁、重新整理、切 Tab、搜尋或分頁再次執行。
- MyCar View-first 已成為唯一正常 Runtime，不再由瀏覽器 localStorage 開關決定；`pages/mycar.html` 正常開啟只讀 `myCarViews/{viewerId}`。
- 「全部／規劃中／開團中／已結束」、「我主揪的／我是玩家」、搜尋、排序與分頁均使用同一份已載入 Prepared View，不重新 Query `cars`。
- View 不存在、Schema／viewerId／資料格式不符或讀取失敗時，頁面明確要求人工 Repair；禁止靜默回退 `getCarsByOwner()`、`getCarsByPlayerId()` 或 Cars Collection Scan。

### Runtime 與維護工具邊界

```text
正常 MyCar Runtime
myCarViews/{viewerId}
        ↓ 一份 Prepared View
MyCar UI / Tab / Search / Sort / Pagination

明確維護 Runtime（不可由正常頁面觸發）
Bootstrap / Consistency Checker / Repair / Migration / Audit
        ↓
允許依維護目的讀取 Core
```

- Core 是唯一正式資料；Prepared View 是可重建的線上 Read Model，不是第二份 Core。
- 正常 mutation 使用已知 `beforeCar + updateData/afterCar`，經 View Mutation Coordinator 只更新受影響 View；禁止為了判斷剛才的修改再讀一次完整 Core。
- Car 建立與媒合完成 write path 已補接共同 `syncCarViewsFromKnownMutation()`；使用剛完成寫入的已知資料增量更新 MyCar View。
- Application 核准、Player Editor、Player Actions、Matching Confirmation 與既有 Member 補位維持 Membership View Sync；`players[]` 改變時同步重建 `playerIds` Query Index。
- `playerIds` 只作 Query Index，不是 Player Core；Staff／DM 正式關係仍為 `staffSlots[]`，不得寫入 `playerIds` 或出現在「我是玩家」。
- Viewer Alias 使用 `myCarViewAliases/{aliasId}` 將 current identity、Player Profile ID、`linkedPlayerIds` 與 historical IDs 導向已建立的 Viewer View。若 Viewer 尚未有 View，Core mutation 正常完成，但不得偷偷掃 Core 建立 View。

### 下一階段排程（本輪不實作）

1. Player Search Index（移除正常搜尋的 `collection("players").get()`）。
2. Car Detail View-first。
3. Accounting View。
4. Home / Pending View。
5. Calendar / Notification / LINE Read Audit。
6. 全系統 Runtime Firestore Audit。

本節為 MyCar Cloud View V1 的正式封版基準；後續不得以舊 MyCar Cars Query 方案重新取代正常 Runtime。

## V2.82 JLY Cloud View Core V1｜Firestore Read Architecture（2026-08-20）

### 正式資料原則

- Firestore Core 保持唯一正式資料來源。
- 正常 UI / Mobile / LINE 優先讀「已整理好的線上 View」，不得每次開頁重新掃 Core 組畫面。
- View 是 Read Model / Projection，不是第二份正式 Core。
- 正式資料發生建立、修改、刪除或狀態改變時，才更新受影響的 View。
- Bootstrap / Repair / Audit 可以明確讀 Core；正常 UI 不得偷偷 fallback 成 full collection scan。

### Cloud View Core

目前已建立的資料層：

```text
js/data-view/
├─ view-core.js
├─ view-impact-resolver.js
├─ view-mutation-coordinator.js
├─ view-runtime-loader.js
├─ cloud-car-view.js
├─ mycar-view.js
├─ mycar-view-bootstrap.js
├─ mycar-view-checker.js
├─ mycar-view-alias.js
├─ membership-view-sync.js
├─ home-view.js
└─ accounting-view-adapter.js
```

### MyCar View

正式方向由 V2.78 原本「每頁重新 Firestore Pagination」升級為 Prepared View：

```text
myCarViews/{viewerId}
```

View 保存「我的車」所需 compact read model：
- 我主揪的
- 我是玩家
- linkedPlayerIds / Historical Player IDs 關係
- Car list summary
- Tab / Search / Pagination 可於已載入 View 內處理

V2.83 起正常頁面正式 Runtime：

```text
進入我的車
→ 讀 myCarViews/{viewerId}
→ Tab / Search / Pagination 不再重新 query Cars
```

舊 `getCarsByOwner*` / `getCarsByPlayerId()` 只可由明確 migration / repair / bootstrap 工具使用，不是正常 MyCar UI 路徑。

### Membership Mutation

已接：
- Application 核准玩家
- Player Editor 新增／編輯
- Player Actions 移除
- Matching Confirmation 玩家保留／移除／完成
- Player Manual Add 既有玩家補位的 slots View 更新

Players 正式變更時同步維護 `playerIds` Query Index。

### Viewer Alias

新增：

```text
myCarViewAliases/{aliasId}
```

用途：
將 current identity / Player Profile / linkedPlayerIds / Historical IDs
指向同一個已 bootstrap 的 `myCarViews/{viewerId}`。

Alias 只在 Membership 真正修改時查詢；
正常開 MyCar / 切 Tab / 搜尋 / 分頁不查 Alias。

### Staff / DM

- Staff 正式資料仍為 `car.staffSlots[]`。
- Staff / DM 不等於玩家，不寫入 `playerIds`，也不應出現在「我是玩家」。
- `staff-actions.js` 的 staffSlots mutation 已接 Car Detail View 更新。
- `dm-application-actions.js` 仍有 direct staffSlots write path，Car Detail 正式切 View-first 前需再接入。

### Accounting

Accounting Core 與 View 分離：
- Transaction / Split / Settlement / Pending Action 為正式 Core。
- 正常帳務畫面讀 Accounting View。
- 帳務變更時才增量更新 View。
- Full rebuild 僅允許 bootstrap / repair / audit / migration。

### 已確認的額外 Reads 高風險

`player-search.js` 目前搜尋名字仍會：

```text
collection("players").get()
```

這會隨 Players Collection 成長而線性增加 Reads。

後續必須建立 Player Search Index / normalizedSearchNames migration，
完成後移除正常搜尋流程的 full Players Collection scan。




## V2.78 LINE 行前通知開啟流程 + Reminder 日期重排（2026-08-20）

- LINE 群組已綁定 Car 後，「🔔 行前通知」按鈕的正式語意固定為「開啟行前通知」；按鈕送出文字指令 `開啟行前通知`，不在開啟當下產生完整行前內容。
- 開啟當下使用既有 `groupId → carId` 綁定取得 Car，僅讀取正式 `gameDate` 以計算排程；預設規則為 `offsetDays=1`、`sendTime=15:00`、`timezone=Asia/Taipei`。
- 開啟成功以 LINE Reply 回覆 `✅ 已開啟行前通知`；不再由 Scheduler 額外 Push「已開啟／已關閉」狀態訊息，避免不必要的 LINE 主動訊息額度。
- `cars/{carId}/reminders/preTrip` 仍只保存 Reminder 規則與生命週期，不複製劇本名稱、店家、地點、玩家等 Car 正式資料；真正發送時由 Dispatcher 重新讀取最新 Car。
- 每台 Car 的 `preTrip` 只允許一份正式 Reminder；已開啟後再次叫出小助手時，行前通知入口顯示為已開啟／已發送狀態，不再建立第二筆提醒。
- 預設行前提醒尾文：
  - `大家明天見唷～～～請準時到場❤️`
  - `有問題請提前回報，感謝🙏`
- 正式 Car 的 `gameDate` 若在 Reminder 發送前修改，`editcar.js` 會重新計算同一份 `preTrip.scheduledAt`；只修改 `gameTime` 不改排程時間，因為正式提醒仍固定前一天 15:00，但發送內容會於發送當下取得最新 `gameTime`。
- 若修改後的新排程時間已經過去，Reminder 改為 `action_required`／`needsHostAction=true`，不偷偷補發；主揪介面需明確提示重新確認提醒時間。
- Reminder 已 `sent` 後，後續修改 Car 不重新啟用第二次行前通知，維持「一台車一次通知」原則。
- DM 對日期／時間的修改若採送審流程，必須等主揪核准、正式 Car 真正更新後才觸發 Reminder 重排；送審中的草稿不得改正式提醒。

### My Cars 100+ 台效能改善｜V2.82 已由 Prepared MyCar View 方向取代

- 問題已由未來風險升級為現況效能議題：使用者已有 100+ 台 Car，`我的車` 不應再一次抓取／Render 全部歷史 Car 與完整內部資料。
- 正式方向採 `JLY Common List Loading Pattern`：列表為輕量 Summary / Projection，詳細頁才載單台完整 Car；正式 Car 仍只有一份，不建立資料副本。
- `我的車` 第一版目標每頁 20 台，必須是真正 Firestore Pagination / Cursor 分批讀取，不接受「先抓全部 100+ 台再只顯示 20 台」的假分頁。
- 每頁 20 台只保留列表必要欄位，例如 `carId`、劇本名稱、日期／時間、狀態、人數摘要、主揪／玩家關係；完整 players、applications、history、Seat、Accounting、Matching 等在進入單台 Detail 時才讀。
- 列表 Cache 只作畫面加速，不是正式來源；返回前一頁可重用短期 Cache，但查看／編輯仍以正式 Car 為準。
- 查看／編輯單台 Car 後，列表優先局部刷新該台 Summary，不重新載入整頁或全部歷史 Car。
- 搜尋不可只搜尋目前載入的 20 台；分頁實作時需同步設計後端搜尋／索引策略，避免第 21 台以後被誤判為不存在。
- 分頁後總數不可再直接使用目前頁面的 `cars.length`；需改為正式 Count／摘要策略。
- 這套 Pattern 未來可共用到其他 Village、個人活動列表與 Accounting 歷史 View，但需先在 `我的車` 驗證後再提升為 Common Core。

## V2.77 玩家車友名單查詢修正（2026-08-19）

- 修正 `pages/join.html` 玩家已核准後雖出現「查看車友」按鈕，但 `approved_only` 模式仍被舊 placeholder 邏輯擋住的問題。
- `js/join.js` 現在於 `guestListVisibility=approved_only` 時，以目前報名頁記住的玩家名稱確認本人已存在正式 `car.players[]` 後允許查看車友。
- 車友顯示名稱相容 `playerName`、`name`、`displayName`，避免正式玩家資料只有 `playerName` 時顯示未命名。
- 移除舊 `showGuestList()`「功能開發中」placeholder，只保留 `toggleGuestList()` 正式展開／收合名單流程。
- `pages/join.html` 將 `join.js` cache version 升至 `v=3`，避免 LINE 內建瀏覽器繼續讀舊版腳本。

## V2.76 報名審核閉環 + 首頁 Pending Actions V1（2026-08-19）

- 玩家與 DM 前台入口保持分離：玩家 `pages/join.html`，DM `pages/dm-join.html`；兩者 URL 同時相容 `id` / `carId`，LINE 歡迎卡正式使用 `?id=...`。
- DM Join 不直接寫入 `staffSlots`；本人可認領既有未綁定 DM 或選擇新增本人，送出後形成 `car.dmApplications[]`、`status=pending`。
- 車團詳情新增正式 `dm-application-actions.js`，DM 待審核直接納入 Detail Page Render，不再靠 DOM 後掛，避免被重新 Render 覆蓋。
- DM 核准時：認領既有 DM 則補正式 `memberId`；若新增本人或原認領位置已被使用，動態新增新的 `staffSlots` DM 位置。拒絕不修改 Staff。
- 新增 `js/modules/pending/pending-actions.js` 作為首頁／報名審核頁共用 View Core；只聚合正式來源，不建立第二份 Pending 資料。
- 劇本村首頁 `待我處理` 第一階段分類固定顯示：`報名審核`、`帳務處理`、`媒合確認`。目前報名審核已接正式計數；0 筆仍保留入口／功能提示。
- 新增 `pages/application-review.html` → `js/application-review.js`，報名審核進入第二層後分類為 `玩家` / `DM`，再依車團顯示待審核內容並前往正式 Car Detail 處理。
- 首頁報名審核只讀目前 owner 的 Car，禁止把其他主揪的 pending applications 算入自己的待辦。
- 首頁 UI 目前先以功能骨架為主，待主要功能齊全後統一 Polish。

## V2.75 LINE 入群歡迎詞 + DM / Player 雙入口（2026-08-19）

- LINE Webhook 的新成員事件使用 `memberJoined`，與 Bot 自己加入群組的 `join` 事件分離。
- 只有已綁定正式 Car 的 LINE 群組才發送歡迎卡；未綁定群組保持安靜。
- 新增 `services/line/member-welcome-card.js`，歡迎卡固定兩個 URI 入口：上方 `🎭 我是本場 DM` → `/pages/dm-join.html?id=...`；下方 `🎮 我要報名玩家` → `/pages/join.html?id=...`。
- `services/line/event-router.js` 新增 `memberJoined` route，先解析 group binding，再取得正式 Car，最後使用既有 LINE Reply Service 回覆 Flex Message。
- DM 與 Player 前台入口分離，但仍共用 JLY Person / Identity 核心；歡迎卡不建立任何人員副本。
- 新增 `tests/line/member-welcome.test.js` 驗證按鈕順序、已綁定群組歡迎、未綁定群組靜默。

## V2.74 Player Join / DM Join V1（2026-08-19）

- 玩家與 DM 使用不同前台入口，但共用 JLY Person / Identity。
- 新增 `pages/dm-join.html` / `js/dm-join.js` 作為本場 DM 身分連結入口；DM 寫入既有 `car.staffSlots[]`，不占玩家 Seat。
- DM Join V1 是已確定 DM 的本人身分連結，不等同公開徵 DM。

## V2.73 車團權限、Audit、Edit Calendar 與公開設定整合（2026-08-19）

- 車團編輯新增正式 Permission Gate：目前 Runtime 位於 `js/modules/car/detail/core/permissions.js`，依 `JLYIdentity` 判斷目前操作者；一般模式維持 owner 權限，System Admin Mode 可作最終支援／修復 Override。
- System Admin 是暫時操作身分，不取代原本玩家／主揪資料；切換後仍使用原操作者 Identity，正式資料必須留下實際操作者與權限來源。
- 新增 `js/modules/car/detail/core/audit.js` 作為車團修改 Audit Runtime；`editcar.js` 透過 `updateCarWithAudit()` 讓 Car 更新與 `cars/{carId}/auditLogs/{auditId}` 在同一 Firestore Transaction 完成，保存 actor、actorMode、authorityReason、changedFields、before／after 與時間。
- `js/common/system-admin-switcher.js` 為跨頁右上角 System Admin 身分切換 UI；`editcar.js` 監聽 `jly:admin-mode-changed`，切換後立即重新判斷編輯權限，不必返回首頁。
- `pages/editcar.html` 已接入 Identity、Permission、Audit、System Admin Switcher 與 Google Calendar Runtime；編輯頁不再只有基本 Car 表單。
- Edit Calendar 正式支援舊資料升級：編輯頁固定提供 Google Calendar 同步選項，不要求車團建立當下已有 `calendar` 新欄位。
- Calendar Lifecycle：未同步車勾選後先檢查目標日期行程，再建立新 Event；已同步車修改日期／時間／地點等同步欄位時，排除自己原 Event 後做衝突檢查，再更新原 `eventId`；取消勾選只停止後續同步，V1 不主動刪除既有 Google Event。
- `calendar-schedule-check.js`／`calendar-controller.js` 新增 Edit 專用 `checkBeforeUpdate()` 路徑，避免沿用 Create 文案，也避免把目前車團／目前 Event 當成自己的衝突。
- 編輯車團新增 `visibility = private / public`；舊車缺少欄位時採安全預設 `private`，避免只因進入新版編輯頁就意外公開。
- 個人揪團關係正式使用 `players/{playerId}/carRelations/{carId}.assistRecruiting`；公開頁可從「我主揪」與「我協助揪團」兩種關係合併 Car，Relation 仍只是個人與 Car 的關係資料，不複製 Car。
- 開發交付規範補充：多檔修改以保留 `JLY_Host_System/` 完整資料夾層級的小型 ZIP 交付；固定流程為 `npm test` → Git commit / push → Vercel 部署 → 線上實機驗收。

## V2.72 Accounting V1 正式資料鏈修復（2026-08-18；現況由 V2.86 取代舊顯示語意）

- Accounting 正式來源維持 `cars/{carId}/accountingEntries/{transactionId}`；LINE、Car Detail 與群組帳務網頁只作輸入／View，不建立第二份 Transaction。
- 正式 Split 使用 `splits[].personId`；`shares`／`memberId` 僅保留 Legacy Compatibility。
- 此版曾短暫採全車應收池／應付池最佳化；目前正式規則已由 V2.86 修正為一對一 Person 責任，同一對 Person 才可雙向互抵，禁止跨第三人重新配對。
- `accountingViews/activityCurrent` 定位為可重建 View／Cache；目前正式版本為 `schemaVersion=7`、`summaryVersion=2`，以最新 Transaction／Settlement `updatedAt` 組成 `summarySourceVersion`，來源變更才重建。
- `accounting-repository.js` 由唯一正式 Transaction／Settlement 建立 View，`shared/accounting/pairwise-obligation.js` 保存一對一責任；UI 不建立第二份債務資料。
- `accounting-controller.js` 與 `accounting-render.js` 分開呈現原始 `grossObligations` 與互抵後 `settlementTransfers`；「我欠誰／誰欠我」不是互抵後淨額，只有「互抵後總額」呈現同一對 Person 的淨結果。
- `api/group-assistant-context.js` 僅接受 `summaryVersion >= 2` 的快取；`js/group-assistant.js` 顯示成員金額時優先讀取核銷後 `currentNetAmount`，LINE 車團帳務網頁／玩家查看因此讀取同一份新版全車淨額摘要。
- 修正 `services/firebase/car-accounting-repository.js` 的多人付款正規化：正式 `payments[].personId` 不再被舊 `memberId` filter 誤刪。

### Accounting 前端正式模組分類

`js/modules/accounting/` 分成兩條責任線：

- Common Activity Accounting：`accounting-controller.js`（頁面協調）、`accounting-data.js`（前端 Domain Logic）、`accounting-repository.js`（Firestore／View）、`accounting-render.js`（Renderer）、`accounting-actions.js`（UI Events）。
- Script Village Activity Fee Extension：`activity-fee-controller.js`（劇本費控制）、`activity-fee-data.js`（劇本費計算）、`activity-fee-repository.js`（劇本費 Firestore）。

劇本費三檔屬劇本村 Extension，不得升格成 Accounting Core；Common Accounting 五檔不得寫死劇本費／工作室專屬規則。

## V2.71 LINE 行前提醒 V1 與自動排程（2026-08-16）

- 啟用既有 `js/notification/` 預留模組：`notification-settings.js` 管理可擴充提醒設定與排程時間計算、`reminder.js` 負責 Car Detail 行前提醒 UI／Firestore 讀寫／預覽、`line-message.js` 負責 LINE 提醒文字預覽；`pages/car-detail.html` 已正式載入三支檔案。
- Car Detail 的行前提醒設定保存於 `cars/{carId}/reminders/preTrip`；Reminder 文件只保存提醒設定與生命週期，不複製劇本名稱、日期、時間、地點等 Activity 正式資料，真正發送時重新讀取最新 Car。
- LINE 群組小助手已恢復「⏰ 行前提醒」入口；`JLY 提醒` 由 `message-router.js` 路由為 `assistant_reminder_menu`，`event-router.js` 取得群組正式綁定 `carId` 後讀取同一份 Reminder，群組查詢只簡潔顯示 `🟢 已綁定` 或 `⚪ 已關閉`。
- 新增 `services/firebase/reminder-repository.js`、`services/line/reminder-service.js`、`services/line/line-push.js`、`services/line/reminder-dispatch-service.js` 與 `api/run-reminders.js`；LINE Reply 與主動 Push 保持分離。
- `POST /api/run-reminders` 以 `Authorization: Bearer <REMINDER_DISPATCH_SECRET>` 保護，只由排程器呼叫；V1 Scheduler Adapter 使用 cron-job.org，每 1 分鐘呼叫一次，排程器只負責喚醒 JLY，不保存車團或帳務資料。
- Dispatcher 會先處理 Reminder 狀態通知，再找已到期 `preTrip`；到期後重新讀取最新 Car 與目前 active 的 `lineGroupBindings`，向正式綁定群組 Push 行前提醒。
- Reminder 發送採 Firestore Transaction 先由 `scheduled → sending` 原子 Claim，成功後標記 `sent`／`sentAt`；人工連續執行已驗證第二次 `candidateCount=0`、`sentCount=0`，不會重複發送。
- V2.71 曾由 Dispatcher 處理 Reminder「已綁定／已關閉」狀態 Push；V2.78 起此行為停用，開啟確認改由 LINE 按鈕事件直接 Reply。既有 `notice*` 欄位只保留 Legacy Compatibility，不再作為正式啟用通知 Runtime。
- Firestore Collection Group 單欄位索引已啟用：`reminders.noticeStatus ASC`、`reminders.scheduledAt ASC`。
- 實測完成：Secret 驗證、Firestore Collection Group 查詢、LINE 主動 Push、sent 防重複、cron-job.org Test Run `200 OK / success:true` 均已通過；Scheduler 已正式啟用。

## V2.70 車團總帳頁第一版（2026-08-14）

- 現有 `pages/group-assistant.html?tab=accounting` 正式定位為 LINE 群組綁定車團的總帳入口，不另建重複頁面。
- 新增 `services/accounting/activity-accounting-summary.js`，從唯一正式 Transaction 與 Settlement 建立總收入、總支出、成員實際付款／應負擔及一對一互抵後待結清摘要。
- `api/group-assistant-context.js` 改讀 Accounting Core 摘要並以 `accountingViews/activityCurrent.summaryVersion` 快取；先比較帳目與核銷的最新更新版本，只有資料改變時才從正式帳目重建。
- 總帳頁保留歷史實際付款金額，核銷只降低待結清金額；LINE 小助手既有「車團帳務／快速記帳」連結繼續進入同一頁面。

## V2.69 LINE 快速記帳結果回覆（2026-08-14）

- 正式入帳後的群組回覆固定顯示項目、金額、付款人與「待分帳」狀態，讓使用者能立即確認寫入結果。
- 付款人無法唯一辨識時，只顯示已暫存、項目、金額與車團帳務待確認提示；不在 LINE 群組公開候選成員姓名。

## V2.68 LINE 群組使用說明（2026-08-14）

- 群組小助手卡片的「使用說明」改為 LINE message action，不再開啟重複的群組助手資訊網頁。
- 說明文字只列目前可用的店家、時間、人員快捷指令，以及按鈕／文字快速記帳範例；使用者可再次輸入 `JLY 小助手` 叫出選單。

## V2.67 LINE 車團時間欄位對齊（2026-08-14）

- LINE「時間資訊」與小助手卡片日期改以正式 Car Detail 欄位 `gameDate`、`gameTime` 為第一優先，舊資料才回退 `date`／`startDate` 與 `time`／`startTime`。
- 玩家公開資料裁切同步保留 `gameDate`、`gameTime`，避免正式車團已有時間卻顯示尚未設定。

## V2.66 玩家查看頁成員完整視圖（2026-08-14）

- 新增 `api/car-view-context.js` 與 `services/car/car-view-access.js`，使用既有 30 天 LINE Member Session 比對車團 owner、`players` 與 `staffSlots` 的正式身份 ID。
- 正式車團成員可在 `pages/car-view.html` 查看完整車團、玩家、工作人員及座位資料；非成員只接收公開基本資訊，不回傳成員名單、座位或私人備註。
- 玩家頁改由同網域 API 取得依權限裁切的資料；不需要每台車重新驗證，帳務、私人玩家資料及主揪管理操作仍不屬於玩家完整視圖。

## V2.65 LINE 車團總覽連結（2026-08-14）

- LINE 群組小助手的「車團總覽」直接開啟目前綁定車團的玩家查看頁 `pages/car-view.html?id={carId}`。
- 連結使用群組綁定 Context 的正式 `carId`，不依賴車團文件內容是否另外保存 ID；已送出的 LINE 舊卡片不會更新，部署後需重新呼叫小助手取得新卡片。
- 快速記帳仍使用具簽章 Token 的 `pages/group-assistant.html`；玩家總覽不再誤連到群組小助手資訊分頁。

## V2.64 LINE 快速記帳待確認流程（2026-08-14）

- 新增 `services/accounting/pending-entry.js`：付款人名稱正規化、唯一／相似／同名判斷，以及待確認記帳 Schema。
- 新增 `services/line/quick-accounting-service.js`：解析群組綁定車團成員；唯一付款人可正式入帳，無法唯一辨識時不建立 Transaction。
- 新增 `services/firebase/accounting-draft-repository.js`：待確認資料寫入 `cars/{carId}/accountingDrafts/{draftId}`，稽核寫入 `cars/{carId}/accountingDraftAuditLogs/{auditId}`。
- LINE 支援 `@JLY小助手 記帳 <項目> <金額> [付款人]付`；待確認時群組只顯示簡短暫存結果，不展開候選名單。
- Car Detail 帳務區僅向主揪讀取待確認記帳；可指定正式 Person ID、調整金額、確認建立唯一 Transaction，或留下刪除稽核紀錄。
- 待確認資料在確認前不進入 `accountingEntries`、分帳、應收應付或互抵計算。
- 唯一辨識付款人的 LINE 快速記帳直接使用 `activity-accounting-repository` 建立正式 Transaction；寫入後將 `accountingViews/activityCurrent` 標記重建，避免只寫入舊 LINE 帳本而未出現在 Car Detail。
- LINE 群組小助手快捷卡新增「店家資訊、時間資訊、人員資訊」切片查詢；`services/line/car-info-slices.js` 只從綁定車團即時組合該區塊，不建立資訊副本。
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
- Vercel API Handler：LINE Webhook 與 Reminder Dispatcher API 入口。
- LINE Messaging API：Webhook 驗證、文字回覆及伺服器端群組 Push。
- cron-job.org：Reminder V1 的可替換 Scheduler Adapter，目前每 1 分鐘以受保護 POST 呼叫 JLY Dispatcher；不保存 JLY Activity 資料。
- Google Identity Services／Calendar API：行事曆授權與同步。

### 2.3 套件與測試

`package.json` 目前依賴：

- `firebase`
- `firebase-admin`

目前沒有正式的建置指令。`npm test` 使用 Node.js 內建 Test Runner 執行 `tests/**/*.test.js`；目前已建立 LINE Event Router 的基礎測試。

---

## 3. 根目錄

```text
JLY_Host_System/
├─ api/                 Vercel API 入口
├─ assets/              正式圖像與靜態資產
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

`images/` 與部分預留模組目錄目前沒有正式執行檔案，不應視為已完成模組。`assets/line/` 保存 LINE Rich Menu 正式圖像。

---

## 4. 頁面入口

| 頁面 | 用途 | 主要執行入口 |
|---|---|---|
| `index.html` | 首頁統計與導航 | `js/app.js` |
| `pages/mycar.html` | 我的車團、篩選與招募分享 | `js/mycar.js` |
| `pages/createcar.html` | 建立車團 | `js/createcar.js`、`js/core/identity.js` |
| `pages/editcar.html` | 編輯車團、公開設定、Calendar 補建／更新 | `js/editcar.js`、`js/seat.js`、`js/core/identity.js`、`js/modules/car/detail/core/permissions.js`、`js/modules/car/detail/core/audit.js`、`js/common/system-admin-switcher.js`、`js/modules/calendar/` |
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

#### 5.4.1 Car Permission / Audit Runtime

目前 `js/modules/car/detail/core/` 已不再是純預留空目錄：

- `permissions.js`：車團編輯權限 Runtime，依 `JLYIdentity` 判斷 owner 與 System Admin Override，對外提供 `window.JLYPermissions`。
- `audit.js`：車團正式修改 Audit Runtime，對外提供 `window.JLYAudit`；目前 Edit Car 透過它在同一 Transaction 寫入 Car 與 `auditLogs`。
- `config/permissions.js` 仍屬 Config／規則定義預留，與上述 Runtime 不是同一責任；未完成 Dependency Audit 前不可互相取代或刪除。
- 目前 Permission／Audit 放在 `car/detail/core/`，但已被 `pages/editcar.html` 使用；若未來更多 Car 頁面共用，需另做分類 Audit 再決定是否提升至更上層 Car Core，現在不為了整理而搬檔。


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

主要整合點為建立車團、編輯車團與車團詳情。同步功能應由設定開關控制，未授權時不可假設可用。

Edit Calendar V1 規則：

```text
未同步／舊車
  ↓ 編輯頁勾選同步
Schedule Check（排除目前 Car）
  ↓
syncCreatedCar()
  ↓
保存 calendar.eventId

已同步車
  ↓ 修改 Calendar 相關欄位
Schedule Check（排除目前 Car + 原 eventId）
  ↓
syncUpdatedCar()
  ↓
更新原 Google Event，不建立分身

已同步車
  ↓ 取消同步
calendar.syncEnabled = false
  ↓
停止後續自動同步；V1 保留既有 Google Event
```

舊資料缺少新版 `calendar` 欄位時，不得因此永久失去 Calendar 功能；編輯頁需提供安全補建入口。

### 5.9 個人招募頁

`js/recruit/`：

- `recruit-controller.js`
- `recruit-data.js`
- `recruit-render.js`
- `recruit-tabs.js`
- `recruit-share-data.js`
- `recruit-share.js`

`pages/mycar.html` 管理分享連結；`pages/recruit.html` 透過 Token 顯示公開招募內容。

個人揪團關係補充：

- `js/car/car-relations.js` 管理 `players/{playerId}/carRelations/{carId}`。
- `assistRecruiting=true` 表示該使用者協助這台車揪團，不代表 Car ownership 轉移。
- `recruit-controller.js` 會合併頁主「我主揪的 Car」與 Relation 中的「協助揪團 Car」，同一 Car 去重後再進招募狀態篩選。
- Car Relation 僅保存關係旗標與識別，不複製劇本名稱、日期、地點等正式 Car 資料。

### 5.10 通知、報表與 Studio

- `js/notification/notification-settings.js`：Reminder 預設值、正規化與 `scheduledAt` 計算。
- `js/notification/reminder.js`：Car Detail 行前提醒 UI、Firestore 讀寫、狀態與預覽；正式由 `pages/car-detail.html` 載入。
- `js/notification/line-message.js`：前端 LINE 提醒文字預覽，不直接持有 LINE Token 或主動 Push。
- `js/notification/recruitment-text.js`：招募文字預留／既有模組。
- `js/report/`：車團、玩家、Studio 報表及匯出。
- `js/studio/`：Studio 資料、權限、車團、DM 行程與個人資料。

`js/notification/` 的 Reminder Runtime 已於 V2.71 正式啟用；`js/report/`、`js/studio/` 仍應在修改前做 HTML Runtime 依賴稽核。

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

`api/line-login.js` 會在伺服器端向 LINE 交換授權碼、取得已驗證的 LINE Profile，並把 `lineUserId` 寫入目前的 JLY Member。連結時會確認 Member 存在、裝置身分相符，且同一 LINE 不得連結到另一位 Member。

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

`services/line/group-binding-service.js` 已通過語法與 CommonJS 模組載入檢查。`event-router.js` 會在群組內明確呼叫小助手後查詢群組綁定；普通聊天、私人訊息及非文字訊息不會觸發群組查詢。查詢失敗時會記錄錯誤但保留原有小助手回覆，避免整批 Webhook 事件失敗。

伺服器環境變數：

- `LINE_MESSAGING_CHANNEL_SECRET`
- `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `REMINDER_DISPATCH_SECRET`：保護 `/api/run-reminders` 的伺服器端 Bearer Secret；不可寫入 Git、前端或 URL。

### 6.4 LINE 小助手按鈕選單

第一版 Rich Menu 提供三個可持續擴充的入口：

- `記帳` → 傳送 `JLY 記帳`
- `車團資訊` → 傳送 `JLY 車團資訊`
- `使用說明` → 傳送 `JLY 使用說明`

相關檔案：

- `assets/line/jly-assistant-rich-menu-v1.png`：2172 × 724 的三區選單圖片。
- `assets/line/jly-assistant-rich-menu-v1.jpg`：實際上傳 LINE 的壓縮版本，必須維持在 1 MB 以下。
- `scripts/setup-line-rich-menu.js`：建立、上傳並設為預設 Rich Menu 的設定程式。
- `api/setup-line-rich-menu.js`：受管理密碼與啟用開關保護的 Vercel 套用端點。
- `pages/setup-line-rich-menu.html`：手機可使用的一次性設定頁。
- `services/line/message-router.js`：處理三個入口事件。
- `tests/line/message-router.test.js`：入口路由測試。
- `tests/line/rich-menu.test.js`：選單區域與事件設定測試。
- `tests/line/setup-rich-menu-api.test.js`：部署端授權、停用與 Token 保護測試。

`npm run line:rich-menu` 預設只執行 Dry Run，不呼叫 LINE API。只有在明確核准且具備 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` 時，才可使用 `-- --apply` 將選單套用至 LINE Official Account。

部署端套用流程需要：

- `JLY_RICH_MENU_SETUP_SECRET`：由使用者自行設定的一次性管理密碼。
- `JLY_RICH_MENU_SETUP_ENABLED=true`：短期啟用套用端點。

手機設定頁只會把管理密碼放在 POST Body 送往同網域 API，不保存密碼，也不接觸或回傳 LINE Access Token。套用完成後必須將 `JLY_RICH_MENU_SETUP_ENABLED` 改為 `false` 並重新部署，停用管理端點。

Rich Menu 只顯示在 LINE Official Account 的一對一聊天室。群組內改用 LINE Quick Reply：使用者輸入 `JLY 小助手` 後，回覆 `記帳`、`提醒`、`車團資訊`、`使用說明` 四個按鈕，按鈕會在原群組送出對應的 `JLY ...` 指令，因此 Event Router 可保留該群組的 `groupId`。

群組快速選單相關檔案：

- `services/line/group-quick-menu.js`：建立四個 LINE Quick Reply message actions。
- `services/line/event-router.js`：只在群組呼叫小助手時傳送快速選單；一對一回覆維持原行為。
- `tests/line/group-quick-menu.test.js`：驗證四個按鈕的 LINE 訊息格式。
- `tests/line/event-router.test.js`：驗證群組綁定查詢順序與實際回覆 payload。

群組按鈕中的記帳與行前提醒已接入正式資料。提醒按鈕會以群組綁定的 `carId` 讀取 `cars/{carId}/reminders/preTrip`，只顯示已綁定／已關閉；實際排程與 Push 由 Reminder Dispatcher 處理。

### 6.5 LINE 群組記帳

群組記帳第一版指令：

- `JLY 支出 350 聚餐飲料`
- `JLY 收入 1000 成員繳費`

群組帳本查詢指令：

- `JLY 今日帳目`：依台北時區查詢當日帳目、收支與結餘。
- `JLY 本月帳目`：依台北時區查詢本月帳目、收支與結餘。
- `JLY 帳本餘額`：查詢群組帳本建立至今的總收入、總支出與結餘。
- `JLY 最近帳目`：列出最近 10 筆帳目及可用於修改／刪除的八碼帳目編號。

今日與本月查詢最多列出最近 10 筆明細，但合計涵蓋查詢期間內全部帳目；沒有資料時回覆空帳本提示。所有查詢都只使用目前 LINE 群組的 `groupId`，私人聊天室不可查詢群組帳本。

資料路徑：

```text
cars/{carId}/accountingEntries/{LINE messageId}
```

正式帳本以 JLY `carId` 歸屬車團，LINE `groupId` 只保留來源資訊；LINE `messageId` 作為帳目文件 ID，讓同一則 Webhook 重送時不產生重複帳目。未綁定車團的 LINE 群組不能建立正式帳目。舊的 `lineGroupAccounts/{groupId}` 僅作為綁定時的一次性遷移來源。

相關檔案：

- `services/line/accounting-command.js`：解析與驗證群組記帳指令。
- `services/line/group-accounting-service.js`：將 LINE Event Context 轉為帳目資料。
- `services/firebase/line-group-accounting-repository.js`：寫入及按時間範圍查詢群組帳本 Firestore 路徑。
- `services/line/event-router.js`：限制只有群組可寫入並回覆記帳結果。
- `tests/line/accounting-command.test.js`：指令格式與金額測試。
- `tests/line/group-accounting-service.test.js`：群組識別與寫入資料測試。

帳目管理指令：

- `JLY 修改帳目 ABCD1234 支出 400 新說明`
- `JLY 刪除帳目 ABCD1234`
- `JLY 異動紀錄`：僅已驗證的主揪或系統管理者可查看最近 10 筆。

權限規則：

- 所有群組成員可新增及查詢帳目。
- 原記帳者可修改或刪除自己建立的帳目。
- 已完成 LINE 身分連結，且目前群組已綁定車團的車團 `ownerId`，可管理該群組全部帳目。
- 車團 `staffSlots` 中，欄位標籤明確包含主揪、協辦、管理、財務或會計，且選取正式 `memberId` 的成員，可管理該群組全部帳目。
- `players.roles` 含 `admin`、`administrator` 或 `system_admin` 的已連結使用者可管理全部帳目。
- 身分無法驗證時一律不提供提升權限。

權限只比對正式 Member／Player ID 與 LINE `lineUserId` 連結，不使用顯示名稱推測身分。一般 DM 或 Staff 不會因角色名稱以外的原因自動取得帳務管理權限。

刪除採軟刪除：帳目保留於 `entries`，標記 `status=deleted`，一般查詢不顯示。每次新增、修改、刪除都以 Firestore Transaction 同步寫入：

```text
cars/{carId}/accountingAuditLogs/{auditId}
```

稽核紀錄包含操作類型、帳目 ID、操作者 LINE userId、權限依據、修改前資料、修改後資料與時間。一般成員無法由 LINE 指令查看，主揪與系統管理者可使用 `JLY 異動紀錄`。

### 6.6 Accounting Core V1（目前正式基準；後續能力仍分階段施工）

Accounting Core 定位為跨 Activity 的共用帳務領域，不是 LINE 或劇本村專用帳本。劇本車是第一個正式 Activity 實作，現階段停止擴充 LINE 帳務功能，既有 LINE Messaging API、Webhook、群組事件與 `groupId → carId` 綁定只保留為未來快速記帳入口。

核心模組：

- `services/accounting/transaction.js`：Transaction 標準結構；保留 `activityId`、`activityType`、`villageType`、`carId`，並分離 `createdBy` 與 `paidBy`。
- `services/accounting/split.js`：平均分帳、尾差及自訂金額合計驗證。
- `services/accounting/settlement.js`：付款申報、撤回、收款確認、退回與整筆結清判定。
- `services/accounting/pending-action.js`：依帳務狀態產生具責任人的待分帳、待付款、待確認收款與退回待辦。
- `services/accounting/compatibility.js`：將具正式身分的既有帳目原地映射成 Transaction，並為現行帳務快照提供暫時欄位別名。
- `services/firebase/activity-accounting-repository.js`：以同一個 Firestore Transaction 寫入正式 Transaction，並同步完成舊待辦、產生下一階段 Pending Action。
- `shared/accounting/pairwise-obligation.js`：從正式 Transaction／Split 產生一對一 Person 責任，並只在相同兩位 Person 間套用 Settlement 與雙向互抵；禁止跨第三人最佳化。
- `shared/accounting/delegated-payment.js`：代付／請人代付的正式 Domain、接受／拒絕與有條件 reimbursement；不建立 Activity 支出副本。
- `js/modules/accounting/accounting-repository.js`：維護 `accountingViews/activityCurrent` 衍生 View、原始應收應付、互抵後 Settlement Transfer，以及按需讀取正式 Transaction／Settlement 歷史。
- `js/modules/accounting/accounting-render.js`：只呈現 View 已決定的正式方向；「我欠誰／誰欠我」顯示原始尚未結清金額，「互抵後總額」顯示同一對 Person 的淨付款／收款方向。
- `js/modules/accounting/activity-fee-data.js`：劇本費計畫、玩家代收、店家付款與車團暫存餘額的純計算規則。
- `js/modules/accounting/activity-fee-repository.js`：劇本費計畫、玩家收款與外部店家訂金／尾款／退款的 Firestore 讀寫及稽核。
- `js/modules/accounting/activity-fee-controller.js`：Car Detail 劇本費與店家核銷介面；工作室、固定玩家人數與每人劇本費資料完整時自動建立／同步基本劇本費，現階段由主揪管理，LINE 入口未擴充。
- `tests/accounting/accounting-core.test.js`：Accounting Core 純領域規則測試。

正式資料來源仍規劃沿用：

```text
cars/{carId}/accountingEntries/{transactionId}
```

既有文件將以同一文件原地補齊通用 Transaction 欄位，不建立「車團帳、個人帳、LINE 帳」等重複交易。個人家計簿與跨村總帳未來只建立查詢／聚合視圖。

劇本車第一版 Firestore 路徑：

```text
cars/{carId}/accountingEntries/{transactionId}
cars/{carId}/accountingPendingActions/{pendingActionId}
```

Pending Action 是流程與責任人資料，不是第二份金額來源。完成的待辦改為 `status=completed` 並保留 `history`，不刪除；Transaction 內只保存目前有效的 `pendingActionIds`，供低讀取量首頁摘要使用。

Car Detail 明細預設收合，第一次展開才分頁讀取正式 `accountingEntries` 並讀取最近 `accountingSettlements`；Transaction、Split、付款／收款及 Settlement 歷史不因結清消失。劇本費與工作室核銷仍由 Script Village Activity Fee Extension 負責，玩家收款與工作室付款不得合併成同一狀態。

Delegated Payment 已由 V2.89 接入 Runtime，並於 V2.90 完成基礎權限與歷史方向穩定化，但整體仍為 INCOMPLETE；後續待辦是 reimbursement 正式持久化／管理 UI、Delegated Payment 完整管理與歷史頁、訪客 Person 與完整 Pending Action 擴充。不得把「代付整體尚未開始」或「代付已完整完成」列為目前基準。

早期帳目若缺少正式 `createdBy`／`paidBy` Person ID，必須保留原資料並標記 `identity_resolution_required`；不可把 LINE userId 當作 Person ID，也不可用顯示名稱猜測。完成身分解析前不產生個人 Pending Action。

帳務參與者需由該 Activity 的正式關係合併取得：建立主揪、`players[]`、`staffSlots[]`。唯一識別使用正式 `memberId`／`playerId`／Person ID，顯示名稱只作快照與介面顯示。

### 6.7 LINE 行前提醒 V1

正式 Runtime：

```text
Car Detail Reminder Settings
        ↓
cars/{carId}/reminders/preTrip
        ↓
cron-job.org（每 1 分鐘）
        ↓
POST /api/run-reminders
        ↓
services/line/reminder-dispatch-service.js
        ├─ reminder-repository.js：due / notice query、claim、sent / failed
        ├─ line-group-binding-repository.js：carId → active groupId
        ├─ getCarById()：重新讀最新 Activity
        └─ line-push.js：LINE Messaging API Push
        ↓
LINE 已綁定群組
```

相關檔案：

- `js/notification/notification-settings.js`
- `js/notification/reminder.js`
- `js/notification/line-message.js`
- `services/firebase/reminder-repository.js`
- `services/firebase/line-group-binding-repository.js`
- `services/line/reminder-service.js`
- `services/line/reminder-dispatch-service.js`
- `services/line/line-push.js`
- `services/line/message-router.js`
- `services/line/event-router.js`
- `api/run-reminders.js`
- `pages/car-detail.html`

Firestore：

```text
cars/{carId}/reminders/preTrip
```

主要欄位包含 `enabled`、`triggerType`、`offsetDays`、`sendTime`、`timezone`、`templateId`、`customMessage`、`targetType`、`scheduledAt`、`status`、`sentAt`、`lastError`，以及設定狀態通知使用的 `noticeType`、`noticeStatus`、`noticeRequestedAt`、`noticeSentAt`、`noticeLastError`。Activity 正式欄位不複製進 Reminder。

必要 Firestore Collection Group 單欄位索引：

- `reminders.noticeStatus`：Collection Group / Ascending
- `reminders.scheduledAt`：Collection Group / Ascending

Scheduler 安全規則：

- `api/run-reminders.js` 只接受 POST。
- Header 必須為 `Authorization: Bearer <REMINDER_DISPATCH_SECRET>`。
- Secret 只存在 Vercel Environment Variables 與排程器安全設定，不放入原始碼、前端、Git 或 URL。
- Scheduler Adapter 可替換；cron-job.org 不是 Reminder Core，也不是資料來源。

已驗證：到期提醒第一次執行 `candidateCount=1 / sentCount=1`，立即第二次執行為 `candidateCount=0 / sentCount=0`；cron-job.org Test Run 回 `200 OK` 且 `success=true`。

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
- `cars/{carId}/reminders/preTrip`：行前提醒設定與發送生命週期；不保存 Activity 資料副本。

部分集合名稱由常數或 Repository 動態提供，部署前應再與 Firestore Rules 及正式資料庫核對。

### 7.3 Car 概念模型

```text
Car
├─ ownerId
├─ scriptName
├─ visibility = private / public
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

### 7.4 Car Audit / Relation 補充

```text
cars/{carId}/auditLogs/{auditId}
├─ entityType / entityId
├─ actionType / source
├─ actorId / actorProfileId / actorName
├─ actorMode
├─ authorityReason
├─ changedFields[]
├─ before
├─ after
└─ createdAt

players/{playerId}/carRelations/{carId}
├─ playerId
├─ carId
├─ assistRecruiting
└─ updatedAt
```

Audit 是正式操作軌跡，不取代 Car；Relation 是 Person ↔ Car 關係，不取代 Car 或 Membership 正式內容。

### 7.5 Player / Member 概念模型

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

### 7.6 Matching 概念模型

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
- `js/notification/`（Reminder Runtime 已啟用）與空的 `js/modules/notification/`（仍不可混用）
- `js/report/` 與空的 `js/modules/report/`
- `js/studio/` 與空的 `js/modules/studio/`
- `config/permissions.js` 與 `js/modules/car/detail/core/permissions.js` 名稱相近但責任不同：前者為 Config 預留／定義，後者為目前 Car Permission Runtime；未完成依賴稽核前不得視為 Duplicate。
- `js/modules/car/detail/core/` 已由預留目錄升級為 Current Runtime（`permissions.js`、`audit.js`）；舊 Map 若仍標示空／Reserved，應以本版為準。
- `js/common/system-admin-switcher.js` 已成為身分切換 Runtime；若未來擴至全站，需檢查所有頁面載入點，不可只靠單頁複製。

只有在完成以下檢查後才能標示 Deprecated 或刪除：

1. HTML `<script>`／`<link>` 載入。
2. JavaScript 全域函式與 `window.JLY*` 呼叫。
3. Firebase 資料讀寫依賴。
4. 桌面與手機主要流程測試。
5. Git Stable Point／可回復提交。

### 10.3 已確認的待辦缺口

- `pages/players.html` 引用 `/js/players.js`，但目前不存在該檔案；實際存在的是 `js/player.js`。
- LINE 登入後端已補齊；正式環境需設定 `LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET` 與 `LINE_REDIRECT_URI`。
- `ROADMAP.md`、`VERSION_HISTORY.md`、`CODING_RULE.md`、`DATABASE_RULE.md` 目前是空檔。
- 專案已有 LINE Event Router 基礎測試，但仍缺少完整整合測試與部署驗證指令。
- LINE 群組可由已連結 LINE 身分的車團建立主揪，以 `JLY 綁定車團 <carId>` 安全綁定；既有群組帳目會一次性遷移至車團帳本，同一群組不可直接覆蓋綁定到另一車團。

---

## 11. 功能修改入口

| 要修改的功能 | 建議先看 |
|---|---|
| 首頁統計 | `index.html`、`js/app.js` |
| 我的車團 | `pages/mycar.html`、`js/mycar.js`、`js/data-view/mycar-view.js`；維護時才看 Bootstrap／Checker／Alias／Membership Sync |
| 建立車團 | `pages/createcar.html`、`js/createcar.js`、Calendar 模組 |
| 編輯車團 | `pages/editcar.html`、`js/editcar.js`、`js/seat.js`、`js/core/identity.js`、Car Permission／Audit、`js/modules/calendar/` |
| 車團詳情 | `pages/car-detail.html`、`js/modules/car/detail/`、`js/cardetail.js` |
| 座位與拖曳 | `js/car/seat/`、`js/seat.js` |
| 玩家端車團頁 | `pages/car-view.html`、`js/car/car-view*.js` |
| 報名 | `pages/join.html`、`js/join.js`、Car Detail application |
| 時間媒合 | `pages/matching*.html`、`js/matching/` |
| Staff／DM | `js/modules/staff/`、Member Picker |
| 玩家身分 | `js/core/identity.js`、`js/myprofile.js` |
| 個人招募 | `pages/recruit.html`、`js/recruit/`、`js/car/car-relations.js`、`js/car/car-data.js` |
| Google Calendar | `js/modules/calendar/`、`pages/createcar.html`、`pages/editcar.html` |
| System Admin／車團權限 | `js/core/identity.js`、`js/common/system-admin-switcher.js`、`js/modules/car/detail/core/permissions.js` |
| 車團 Audit | `js/modules/car/detail/core/audit.js`、`js/editcar.js`、`cars/{carId}/auditLogs` |
| LINE 登入 | `js/line.js`、`js/line-callback.js` |
| LINE Bot | `api/line-webhook.js`、`services/line/` |
| LINE 行前提醒 | `js/notification/`、`services/firebase/reminder-repository.js`、`services/line/reminder-*.js`、`services/line/line-push.js`、`api/run-reminders.js` |
| Reminder Scheduler | cron-job.org → `POST /api/run-reminders`；Vercel `REMINDER_DISPATCH_SECRET` |
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
- 多檔交付／覆蓋時使用小型 ZIP，ZIP 內保留從 `JLY_Host_System/` 開始的完整資料夾層級，只包含本輪需要新增／覆蓋的正式檔案。
- Vercel 線上驗收流程固定為：`npm test` 全綠 → 精準 `git add` 本輪檔案 → commit / push → 等待 Vercel 部署 → 線上實測。避免使用 `git add .` 把修復包、暫存檔或未分類檔案一起提交。
- 每次新增、拆分、搬移、啟用預留目錄或改變 Runtime Entry Point，除了更新功能本身，也要順便檢查 Project Map 的「未歸類／Reserved／Legacy Candidate」是否已過期。


---

## 14. 正式下一階段排程

1. Player Search Index。
2. Car Detail View-first。
3. Accounting View。
4. Home / Pending View。
5. Calendar / Notification / LINE Read Audit。
6. 全系統 Runtime Firestore Audit。

上述項目不得混入 V2.83 MyCar Cloud View V1 封版提交；其他既有 UI Polish、Legacy Audit 與文件缺口保留在各自後續任務處理。
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

### V2.2｜2026-08-12

- 將 Group Binding Service 接入 LINE Event Router。
- 限制只有群組內明確呼叫小助手時才查詢群組綁定。
- 查詢失敗時採降級處理，避免中斷既有小助手回覆。
- 新增 Node.js Test Runner 與 LINE Event Router 基礎測試。

### V2.3｜2026-08-12

- 新增 JLY 小助手三按鈕 Rich Menu 圖像與安全設定程式。
- 新增記帳、車團資訊及使用說明三個可擴充入口。
- 設定程式預設採 Dry Run，避免未授權修改 LINE Official Account。
- 新增 Message Router 與 Rich Menu 自動測試。

### V2.4｜2026-08-12

- 新增 1 MB 以下的 LINE Rich Menu JPEG 上傳資產與大小測試。
- 新增受管理密碼與啟用開關保護的 Vercel 套用 API。
- 新增可從手機操作的一次性 LINE 選單設定頁。
- 確保伺服器端 LINE Token 不會回傳至前端。

### V2.5｜2026-08-12

- 新增群組專用的四按鈕 LINE Quick Reply 選單。
- 使用者在群組呼叫 `JLY 小助手` 時，保留目前 `groupId` 並顯示記帳、提醒、車團資訊及使用說明入口。
- 一對一聊天室維持原本回覆，正常群聊仍不查詢 Firebase、不觸發小助手。
- 新增群組快速選單與 Event Router payload 自動測試。

### V2.6｜2026-08-12

- 新增 LINE 群組收入與支出文字指令。
- 新增按 `groupId` 分帳、按 LINE `messageId` 防重複的 Firestore 帳目結構。
- 保存記帳者 LINE userId、金額、說明、類型及建立時間。
- 私人聊天室不可寫入群組帳本；格式錯誤時提供正確輸入範例。
- 新增群組記帳指令、服務與 Event Router 自動測試。

### V2.7｜2026-08-12

- 新增今日帳目、本月帳目與帳本餘額三個群組查詢指令。
- 日與月的範圍依台北時區計算，不受 Vercel 執行區域影響。
- 查詢回覆包含總收入、總支出、結餘及最近帳目。
- 查詢僅限目前 LINE 群組，空帳本與私人聊天室有明確提示。
- 補充記帳入口與使用說明中的查詢指令。

### V2.8｜2026-08-12

- 新增最近帳目、修改帳目、刪除帳目及管理者異動紀錄指令。
- 原記帳者可管理自己的帳目；已驗證主揪與系統管理者可管理群組全部帳目。
- 刪除改採軟刪除，所有新增、修改與刪除以 Transaction 保存不可省略的異動快照。
- 新增 LINE 身分、車團 ownerId 與系統角色的後端權限解析。
- Webhook 重送不會重複建立帳目或新增稽核紀錄。

### V2.9｜2026-08-12

- 將帳務管理權限接入車團頁 `staffSlots` 的正式 Member 選擇結果。
- 主揪、協辦、管理、財務及會計標籤可授予該車團群組帳務管理權限。
- 一般 DM／Staff 不會自動取得帳務管理權限。
- 權限僅比對 LINE `lineUserId`、Player／Member ID、車團 ownerId 與設定角色，不以顯示名稱猜測。

### V2.10｜2026-08-12

- JLY 車團成為正式帳務資料來源，LINE 僅作為記帳、查詢及管理入口。
- 正式帳目與稽核紀錄改存於 `cars/{carId}` 的子集合。
- 新增主揪限定的 `JLY 綁定車團 <carId>` 指令，並防止既有群組綁定被直接覆蓋。
- 群組首次綁定時會把舊 LINE 群組帳目一次性遷移到車團，保留來源與稽核紀錄。
- 車團詳細頁新增「複製 LINE 群組綁定指令」按鈕，方便手機貼到 LINE 群組。

### V2.11｜2026-08-12

- 新增 `/api/line-login` 後端，完成 LINE OAuth 授權碼交換與 Profile 驗證。
- LINE 驗證成功後，會正式把 `lineUserId` 寫入目前的 JLY Member。
- 阻止同一個 LINE 帳號重複連結到不同 Member，並檢查目前裝置身分。
- 回到「我的資料」後顯示身分連結成功提示，之後可進行 LINE 群組車團綁定。

### V2.12｜2026-08-12

- 首頁新增「登入／找回我的身分」入口，手機可直接進入 LINE 身分流程。
- 「我的車」缺少本機身分時顯示明確說明與登入按鈕，不再只顯示空白內容。
- 已連結 LINE 的 JLY Member 可在 LINE 內建瀏覽器或新裝置重新登入並恢復 Member ID。
- 第一次連結仍須由原本持有該 JLY Member 的瀏覽器確認，避免以名稱冒領他人身分。

### V2.13｜2026-08-12

- LINE OAuth state 除原本瀏覽器儲存區外，另寫入 10 分鐘短效 Secure Cookie。
- LINE 內建瀏覽器完成授權跳轉後，可使用 Cookie 驗證原始登入請求。
- state 驗證完成或失敗後立即清除 Cookie，保留防止登入冒用的安全檢查。

### V2.14｜2026-08-12

- 新增 `/api/line-login-state`，登入前由 JLY 後端簽發 10 分鐘有效的 LINE OAuth state。
- 簽章內容包含 Member、JLY Identity 與安全返回路徑，手機端無法竄改。
- `/api/line-login` 會在交換 LINE 授權碼前驗證簽章與期限。
- 登入流程不再依賴 LINE 內建瀏覽器、Safari 或其他授權視窗之間共享儲存區或 Cookie。

### V2.15｜2026-08-12

- 「我的車」登入按鈕會帶入安全返回路徑 `/pages/mycar.html`。
- LINE 登入前將原始目標頁寫入後端簽章，成功後直接返回「我的車」。
- 返回路徑僅允許站內絕對路徑，避免被利用跳轉至外部網站。

### V2.16｜2026-08-12

- LINE 群組綁定的建立主揪檢查新增 Member `identityId` 比對。
- 相容較早建立、以 JLY Identity ID 寫入 `cars.ownerId` 的既有車團。
- 不需改寫舊車團 ownerId，即可由已連結 LINE 的原建立主揪安全綁定。

### V2.17｜2026-08-12

- 帳務管理權限解析新增 Member `identityId` 比對，與群組綁定使用相同身分鏈。
- 舊車團建立主揪可查看帳目異動紀錄，並管理車團內所有帳目。
- 修改與刪除仍保留完整稽核紀錄，一般成員權限不變。

### V2.18｜2026-08-12

- 新帳目稽核紀錄新增 `actorMemberId` 與操作當時的 `actorDisplayName`。
- 查詢舊異動紀錄時，會以 `actorUserId` 補查目前綁定的 JLY Member 名稱。
- LINE 畫面優先顯示操作者名稱；查不到名稱時才顯示縮短的 LINE ID，完整 ID 仍保留於後端。

### V2.19｜2026-08-12

- `JLY 異動紀錄` 顯示台北時間、操作類型、操作者名稱與帳目短編號。
- 新增與刪除顯示收入／支出、金額及說明。
- 修改紀錄同時顯示修改前與修改後內容，方便追蹤差異。

### V2.20｜2026-08-12

- 每台車新增單一帳務快照 `cars/{carId}/accountingViews/current`。
- 一份快照包含總收入、總支出、結餘、有效帳目數、最近 20 筆帳目及最近 10 筆異動。
- 新增、修改與軟刪除會在同一個 Firestore Transaction 內同步更新正式帳目、稽核及快照。
- 舊車團第一次使用快照時會由既有正式帳目建立一次，之後不再為顯示總額反覆讀取全部帳目。

### V2.21｜2026-08-12

- 一般帳務快照 `cars/{carId}/accountingViews/current` 包含收入、支出、結餘、最近 20 筆登記資料，以及每位成員的已付、應分攤、應收／應付。
- 成員結算金額獨立累計，不受最近 20 筆顯示上限影響；更早的有效帳目仍會計入總額。
- 管理者異動快照拆分至 `cars/{carId}/accountingViews/admin`，一般成員快照不包含稽核紀錄或 LINE 內部使用者 ID。
- 正式帳目與完整異動紀錄仍保留在原本集合，快照只負責低讀取量的頁面顯示。

### V2.22｜2026-08-12

- 一般成員與主揪查看相同的帳務摘要；主揪仍可修改或刪除車團帳目。
- 完整帳目異動紀錄改為僅系統管理者可查詢，主揪、財務人員及一般成員均不載入管理快照。
- 帳務發生爭議時，由系統管理者調閱操作者、操作時間及修改前後內容。

### V2.23｜2026-08-12

- LINE 群組新增帳目成功後，回覆會顯示八碼帳目編號，供後續修改或刪除指令直接使用。

### V2.24｜2026-08-12

- 車團頁面改為產生六碼、10 分鐘有效且只能使用一次的 LINE 群組配對碼，不再暴露或要求手動輸入車團資料 ID。
- 配對碼貼入群組後先顯示劇本與日期，必須由建立主揪點擊確認才正式建立「LINE 群組 → JLY 車團」綁定。
- 配對確認限制在最初提出配對的群組及主揪；過期、已使用、取消或在其他群組確認均會被拒絕。

### V2.25｜2026-08-12

- 車團頁面複製的 LINE 配對指令會同時顯示劇本名稱及六碼配對碼，例如 `JLY 綁定《劇本名稱》 A7K9P2`。
- 劇本名稱方便主揪辨識，系統仍以一次性配對碼精準定位車團，避免同名劇本造成錯誤綁定。

### V2.26｜2026-08-13

- LINE 群組輸入 `JLY 小助手` 後改為傳送可保留於聊天紀錄的 Flex 車團首頁卡片，不再以點擊後消失的 Quick Reply 作為主要入口。
- 首頁卡片顯示綁定車團的劇本名稱與日期，提供帳務、車團資訊、成員座位、提醒、通知及使用說明六個入口。
- 點擊「車團帳務」會開啟第二層 Flex 帳務卡片，提供新增分帳、帳目總覽、我的應收／應付及我的帳目。

### V2.27｜2026-08-13

- LINE 群組綁定成功訊息改為顯示劇本名稱，並提示輸入 `JLY 小助手` 開啟該車專屬功能選單。
- 群組帳目遷移屬於系統內部處理，不論數量多少都不顯示給玩家；結果仍保留在後端供系統管理者追蹤。
- 玩家畫面只顯示綁定結果與下一步操作，不顯示內部 ID 或處理細節。

### V2.28｜2026-08-13

- LINE 車團帳務卡片的「帳目總覽」改為讀取 `cars/{carId}/accountingViews/current` 單一摘要文件。
- 顯示總收入、總支出及結餘時不再掃描正式帳目集合，讀取量不會隨帳目筆數增加。

### V2.29｜2026-08-13

- LINE 群組的使用說明簡化為玩家需要知道的內容：透過「車團帳務」新增此劇本帳目。
- 不再向玩家列出內部文字指令、今日／本月等系統操作細節。

### V2.30｜2026-08-13

- LINE 車團首頁卡片按鈕改為直接開啟同一個手機版車團小助手頁面，不再送出中間文字指令或產生第二張卡片。
- 操作頁以車團、帳務、成員及通知分頁切換；帳務總覽使用單一摘要文件。
- 入口網址包含簽章後的群組與車團對照，後端會再次確認有效綁定；解除綁定後舊公告連結會失效。

### V2.31｜2026-08-13

- 車團小助手操作頁新增安全分帳表單，可填寫收入／支出、金額、說明、付款人與平均分攤成員。
- 寫入前要求已連結的 LINE Member 工作階段，後端再驗證群組綁定與車團成員身分，避免共用連結被冒用記帳。
- 分帳儲存後直接寫入該車正式帳本並同步更新單一摘要與稽核紀錄。

### V2.32｜2026-08-13

- 新增帳目可選擇「先記總額，之後再分帳」或「現在立即分帳」。
- 暫不分帳的支出標記為 `pending`，仍會立即計入車團總支出，但不會先產生成員應收／應付。
- 帳務頁列出待分帳項目，使用者可稍後點擊「分帳」補選成員。

### V2.33｜2026-08-13

- 正式啟動跨 Activity 的 JLY Accounting Core；劇本車為第一個 Activity Accounting 實作，不另建劇本村專用帳本。
- 新增 Transaction、Split、Settlement 與 Pending Action 四個獨立領域模組，避免帳務邏輯繼續堆入 `cardetail.js` 或 LINE Event Router。
- Transaction 明確保留 `activityId`、`activityType`、`villageType`、`createdBy`、`paidBy`、`splitStatus` 與 `settlementStatus`。
- 完成平均分帳尾差、自訂金額驗證、付款申報／撤回、收款確認／退回及責任人待辦的純規則測試。
- 現階段不擴充 LINE 完整帳務管理；未來 LINE 快速記帳必須寫入同一份正式 Transaction。

### V2.34｜2026-08-13

- 新增 Activity Accounting Firestore Repository，劇本車沿用 `accountingEntries` 作為唯一 Transaction 正式來源。
- 新增 `accountingPendingActions` 子集合；待辦具責任人、交易與 Split 關聯，完成後保留狀態歷程而不刪除。
- Transaction 與 Pending Action 在同一個 Firestore Transaction 內同步，完成分帳時會完成 `pending_split` 並產生各欠款人的 `payment_due`。
- Transaction 文件保存目前有效的 `pendingActionIds` 與 `schemaVersion=1`，並暫時保留現行帳務快照所需的相容欄位。

### V2.35｜2026-08-13

- `pages/car-detail.html` 正式載入獨立的 `js/modules/accounting/` 前端模組與 `css/pages/accounting.css`，帳務邏輯沒有繼續堆入 Transitional `js/cardetail.js`。
- Car Detail 增加「車團帳務」正式區塊，第一版顯示待分帳、待付款、待確認收款數量，以及最近五筆 Transaction。
- 車團成員來源整合 `ownerId`、`players` 與 `staffSlots`，帳務身份只採正式 Person / Player / Member ID；顯示名稱不作唯一識別。
- 快速記帳建立唯一 Transaction，保留分離的 `createdBy` 與 `paidBy`，預設 `splitStatus=pending`，並在同一 Firestore transaction 建立 `pending_split`。
- Current 前端儲存位置維持 `cars/{carId}/accountingEntries/{transactionId}` 與 `cars/{carId}/accountingPendingActions/{pendingActionId}`；LINE Messaging Runtime 本階段未擴充。
- 已知限制：目前「查看全部帳務」、平均／自訂分帳與付款雙方確認尚未接上 Car Detail UI，屬 Accounting V1 下一階段。

### V2.36｜2026-08-13

- Car Detail 帳務載入正式 `JLYIdentity`，比對目前 Profile ID、裝置 Identity ID 與 `linkedPlayerIds`，避免同一位正式成員因歷史 Identity 不同而被拒絕記帳。
- 快速記帳會將目前登入者解析回車團保存的正式 Person／Member ID；付款人預設顯示目前玩家姓名，例如「詩婕」。
- 車團 `organizerName`／工作室名稱不再被帳務模組誤當成主揪個人姓名。

### V2.37｜2026-08-13

- Car Detail 將成員／座位名單排列在帳務區上方，維持非帳務車團的主要操作優先順序。
- 待分帳 Transaction 可從最近帳目直接開啟分帳表單，支援勾選正式 Activity Member 後平均分帳或輸入自訂金額。
- 平均分帳的整除尾差固定分配給最後一位所選成員；自訂金額合計不等於 Transaction 金額時禁止完成。
- 完成分帳會結束 `pending_split`，為非付款人成員建立具責任人的 `payment_due`；付款人自己的 Split 直接標記 settled，但不代表其他成員已結清。

### V2.38｜2026-08-13

- 待分帳表單開啟時預設勾選全部正式 Activity Member，減少一般全員平均分帳的操作步驟。
- 成員名單新增小型「全選／取消全選」按鈕，個別勾選變動時按鈕文字會同步更新；自訂金額模式沿用同一份選取狀態。

### V2.39｜2026-08-13

- Car Detail 帳目顯示每位 Split 的金額與獨立結清狀態；欠款本人可申報「我已付款」，並在收款人確認前撤回。
- Transaction 的實際付款人是唯一收款確認者，可按「確認收到」正式結清 Split，或按「尚未收到」退回付款申報。
- 每次付款狀態轉換會同步完成舊 Pending Action 並產生下一責任人的 `payment_due`、`payment_confirmation` 或 `settlement_rejected`。
- 只有所有 Split 都 settled 時，整筆 Transaction 才顯示「全部結清」；付款方不能自行完成結清。

### V2.40｜2026-08-13

- Car Detail 的「查看全部帳務」正式啟用，沿用已讀取的 Transaction 清單，不建立或複製第二份帳務資料。
- 完整列表支援「全部、待處理、待分帳、待付款、待確認、已結清」篩選；開啟時預設顯示待處理帳務。
- 待付款與待確認分類依目前登入 Person ID 判定，讓使用者優先看到下一步輪到自己的帳；首頁仍只顯示最近五筆以維持畫面精簡。

### V2.41｜2026-08-13

- 車團主揪可替欠款成員「代登已付款」，不必等待玩家本人操作；Split 會分開記錄欠款人 `paymentClaimedBy` 與代登者 `paymentRecordedBy`。
- 主揪代登不會冒充玩家本人，且若主揪不是實際收款人，仍需 Transaction 的 `paidBy` 確認後才 settled。
- 實際收款人可直接按「標記已收款」，同時保存付款代登與收款確認時間；非收款人即使是主揪也不能跳過真正收款人直接結清。

### V2.42｜2026-08-13

- 車團帳務權限調整為：欠款本人可申報「我已付款」；Transaction 的 `paidBy` 可確認自己的應收款；車團主揪可管理全部付款狀態。
- 主揪可代替收款人確認、退回或直接標記已收款，並以 `confirmationAuthority=manager`、`paymentRecordSource=manager_override` 明確保存管理者代操作，不偽裝成原收款人。
- 一般成員仍不能修改其他人的 Split；完整 Transaction 內容修改與軟刪除介面留待下一階段，並沿用既有稽核紀錄原則。

### V2.43｜2026-08-13

- 付款操作改用玩家可理解的簡潔文字：欠款人看到「已付款」，收款人或具管理權限者在尚未申報時看到「已收款」，申報後看到「確認收款」。
- 玩家畫面不再顯示「主揪代登」或「主揪標記」等內部權限詞；管理者代操作來源仍完整保存在 Split 欄位與歷史中。
- Transaction 的「全部結清」改以所有 Split 的即時狀態判定，不再只信任可能過期的 Transaction `settlementStatus`，避免仍有人未付款卻顯示全部結清。

### V2.44｜2026-08-13

- 車團帳務新增跨 Transaction 的淨額結算摘要；每筆 Transaction 與 Split 仍是正式來源，不合併、不複製也不刪除原始帳目。
- 系統只聚合已完成分帳且尚未 settled 的 Split，先計算每位成員的淨應收／淨應付，再產生最少必要的「誰付給誰多少」轉帳建議。
- 待分帳、軟刪除與已結清款項不計入目前淨額，避免尚未確認的分攤或已完成付款重複計算。
- 目前淨額摘要是顯示層；付款確認仍保留在原始 Split，後續需增加可追溯的淨額付款分配機制，才能用一次付款安全結清多筆 Split。

### V2.45｜2026-08-13

- Activity Accounting 新增 `cars/{carId}/accountingViews/activityCurrent` 物化摘要，保存最近五筆 Transaction、全車未結清淨額與全車待辦計數；它是正式 Transaction 的衍生快照，不是第二份帳目。
- 第一次遇到尚無摘要的舊車團時，會讀取既有 Transaction 與未完成 Pending Action 建立一次摘要；之後新增、完成分帳與付款狀態轉換都在同一 Firestore Transaction 內同步更新摘要。
- Car Detail 一般開啟改為讀取一份 Activity 摘要，以及只屬於目前使用者的 Pending Action；不再固定讀取最近 20 筆 Transaction 與全車所有待辦。
- 最近帳目直接使用摘要內五筆資料；只有點擊「查看詳細帳務」才按需讀取第一頁最多十筆正式 Transaction，避免一般瀏覽產生不必要讀取。
- 淨額結算改由摘要內全車 `balanceByPerson` 產生，因此不再受最近 20 筆帳目上限影響；原始 Transaction、Split 與付款歷史仍完整保留。

### V2.46｜2026-08-13

- 車團帳務一般介面改成目前登入成員的個人視角，只呈現「我還要付、別人還欠我、等待我確認」以及與本人相關的淨額轉帳與帳目。
- 車團主揪在一般模式與其他成員看到相同個人介面；額外權限集中於帳務區右上角 `⋯ → 管理帳務`，避免管理按鈕長期佔據玩家畫面。
- 管理模式可選擇成員並查看該成員的帳務視角；切換視角不會冒用該成員身分，也不改變實際操作者。
- 主揪只有在目標成員尚未具備 JLY／LINE 正式身分時才顯示代為處理付款的入口；已使用系統成員仍須本人申報付款、由實際收款人確認。

### V2.47｜2026-08-13

- 個人帳務的逐筆區只顯示尚未結清且與目前視角相關的 Split；已 settled 的 Split 不再顯示「已收款」或其他操作按鈕，也不再佔用待處理畫面。
- `accountingViews/activityCurrent` Schema 升級至 V2；舊摘要第一次載入時會依正式 Transaction 與 Pending Action 自動重建，清除過去增量摘要可能殘留的已結清應收應付。
- 淨額結算會先合併同一 Person ID 的餘額並禁止產生自己付給自己的轉帳，避免錯誤摘要顯示「詩婕付給詩婕」。

### V2.48｜2026-08-13

- 車團帳務右上角管理入口改成單一步驟：主揪點擊 `⋯` 直接進入管理模式，不再先展開只有一個選項的浮動選單。
- 進入管理模式後同一按鈕顯示「完成」，點擊即回到主揪本人的一般帳務視角，讓手機操作有立即且明確的畫面回饋。

### V2.49｜2026-08-13

- Car Detail 的「我還要付」與「別人還欠我」摘要改為可點擊卡片，使用原頁小視窗分別顯示付款／收款對象與淨額。
- 明細直接沿用 Accounting Controller 已載入的 `personalSettlement.transfers`，不新增 Firestore 查詢；原本重複顯示的下方「我的結算結果」區塊從一般畫面移除。

### V2.50｜2026-08-13

- 淨額結算小視窗接上雙方確認流程：付款方可申報「我已付款」或在確認前撤回，收款方可「確認收款」，確認後才從 Activity 帳務餘額扣除。
- 新增 `cars/{carId}/accountingSettlements/{settlementId}` 保存淨額付款、確認與撤回歷史；`accountingViews/activityCurrent.activeNetSettlements` 保存進行中的付款申報，避免開啟小視窗時新增讀取。
- 淨額付款申報會建立責任人為收款方的 `payment_confirmation` Pending Action；完成或撤回後保留 Settlement 歷史並完成待辦，不刪除原始 Transaction 或 Split。

### V2.51｜2026-08-13

- 個人帳務摘要拆成「我欠誰」、「誰欠我」與「互抵後總額」三個入口；前兩者顯示扣抵前的原始應付／應收關係，第三者才顯示最終淨額與付款確認操作。
- `accountingViews/activityCurrent` Schema 升級至 V3，新增 `obligationsByPair` 聚合所有未結清 Split 的付款人關係，不受最近帳目顯示筆數限制，也不需在點擊摘要時重新讀取 Transaction。

### V2.52｜2026-08-13

- 淨額收款確認套用既有離線成員代理規則：收款人尚未使用系統時，主揪可在管理視角執行「代為確認收款」；已使用系統的正式成員仍只能本人確認。
- 代理確認紀錄保存 `confirmedBy`、`confirmedFor` 與 `confirmationAuthority=manager_for_offline_member`，明確區分實際操作者與被代理成員。

### V2.53｜2026-08-13

- Activity Member 的報名／Member／Profile／LINE 識別資料不再自動代表已啟用個人帳務；只有 `accountingSelfServiceEnabled=true` 或目前已驗證登入的本人，才視為帳務自助使用者。
- 現階段手動建立或僅完成報名的玩家預設可由主揪代處理款項；未來個人帳務正式開放時，再於完成帳務啟用流程後寫入 `accountingSelfServiceEnabled=true`。

### V2.54｜2026-08-13

- 主揪同時是淨額付款人、並在管理模式查看未啟用帳務的收款人時，操作按鈕優先顯示「代為確認收款」，避免付款人的「撤回付款」遮蔽代理確認入口。
- 回到付款人自己的帳務視角時仍顯示「撤回付款」，代理確認與本人付款操作依目前視角清楚分離。

### V2.55｜2026-08-13

- 修正 Car Detail「詳細帳目」的逐筆付款按鈕：主揪查看未啟用帳務的收款人視角時，依收款人 `paidBy` 判斷代理權限並優先顯示「代為確認收款」。
- 原先只修正互抵總額小視窗，未涵蓋逐筆帳目中的「撤回」按鈕；本版已讓實際詳細帳目入口套用相同的離線收款人代理規則。

### V2.56｜2026-08-14

- 車團帳務的付款操作改為上方「我的結算結果」依對手人彙總處理，下方 Transaction / Split 明細僅供核對，不再逐筆顯示付款或收款按鈕。
- 付款人可輸入本次部分付款金額，或使用「全部付清」；同一對付款與收款人同時只允許一筆待確認申報。
- 付款申報不會立即扣減餘額；收款方確認，或主揪代未啟用帳務的離線成員確認後，才同步扣減互抵餘額與原始應收應付彙總。
- `cars/{carId}/accountingViews/activityCurrent` 升級為 `schemaVersion=4`，重建摘要時會讀取 `accountingSettlements` 並重播所有已確認的彙總付款，避免重新載入後餘額回復。

### V2.57｜2026-08-14

- 互抵結算改為「每兩位成員一對一」：只會將 A 應付 B 與 B 應付 A 互相扣抵，不再使用全車個人餘額重新配對債務。
- 付款申報上限、收款確認與主揪代離線成員確認，全部以 `obligationsByPair` 的同一對成員淨額驗證，避免跨成員抵銷導致帳款對象改變。

### V2.58｜2026-08-14

- 主揪進入帳務管理並切換至未啟用帳務系統的付款人視角時，可在一對一互抵總額上代為登記部分付款或全額付款。
- 代理付款申報會保留實際操作人、代理的付款人及 `manager_for_offline_member` 權限來源；已啟用系統的成員仍只能由本人申報。

### V2.59｜2026-08-14

- 一對一淨額付款經收款方確認後，除了扣除實際付款金額，也會將同一對成員剩餘的反向等額債務同時互抵，使該組正確回到「已互抵完成」。
- `accountingViews/activityCurrent` 升級為 `schemaVersion=5`，現有車團下次載入會重建彙總並重播已確認付款，自動修復先前保留的等額雙向餘額。

### V2.60｜2026-08-14

- 新增劇本費與外部店家核銷第一版：主揪可建立玩家每人應付劇本費與店家總費用，分別登記玩家收款／退款及店家訂金／尾款／退款。
- 劇本費頁面彙總玩家待收、店家待付與車團暫存餘額；玩家代收不視為主揪個人收入。
- 新增 `accountingFeePlans/scriptFee`、`accountingFeeCollections`、`accountingExternalPayments` 與 `accountingFeeAuditLogs`；外部店家保留 `externalPartyId`、`linkedOrganizationId`、`linkedStoreId`，未來店家加入 JLY 後可連結為店家收入，不重建帳目。
- 劇本費屬劇本車 Activity Extension，與玩家一對一共同支出互抵分離；LINE 快速記帳本階段不擴充。

### V2.61｜2026-08-14

- 基本劇本費只以車團 `players[]` 的玩家區成員計費，不納入 `staffSlots[]` 工作人員；玩家區人數變動時會以每人設定金額重新計算應收。
- 店家核銷改為「店家基本費用＋動態費用項目」；指定 DM 費與其他加費使用「＋新增費用項目」，不佔用固定欄位。
- 每個額外費用項目獨立保留名稱、類型、金額、備註與負擔方式，支援玩家均分、指定玩家、主揪支付與自訂分攤；費用同時納入店家應付總額與對應人員應付。
- 玩家預付訂金沿用玩家收款紀錄，店家訂金仍獨立計入外部店家已付，兩者不混合。

### V2.62｜2026-08-14

- 修正劇本基本費計費基準：店家應付與玩家基本應收以開車時保存的 `car.totalPeople` 固定劇本人數計算，不再使用當下 `players.length` 已入團人數減少店家費用。
- 建立核銷計畫時移除可人工輸入的「店家基本費用」欄位；系統以 `totalPeople × 每位玩家劇本費` 自動產生店家基本應付，並可從 `car.price` 預填每人費用。
- 尚未補進玩家區的固定名額以「待補玩家」顯示及計費；新玩家加入後只會將待補名額連結到實際 Person ID，不改變店家基本總額。
- 劇本缺人不會自動減價；未來整團取消將另以取消核銷、店家訂金退款或沒收流程處理。

### V2.63｜2026-08-14

- 劇本費核銷的店家／工作室名稱自動從車團正式資料帶入，欄位優先順序為 `car.studioName`、`car.organizerName`、`car.organizer`；上方已有店家時，核銷表單不再要求重複輸入。
- 舊車團若完全沒有上述店家資料，才顯示手動補填欄位；已建立的核銷計畫也會依車團目前的工作室名稱同步顯示。

### V2.64｜2026-08-14

- LINE 快速記帳新增待確認流程；付款人可唯一辨識時直接寫入正式 Transaction，無法唯一辨識時先進 `accountingDrafts`，確認前不影響正式帳務。
- 群組小助手新增店家、時間、人員資訊切片，全部即時讀取綁定 Car，不建立資訊副本。

### V2.65｜2026-08-14

- LINE 群組「車團總覽」改直接開啟綁定車團的 `pages/car-view.html?id={carId}`；快速記帳仍使用具簽章 Token 的群組助手頁。

### V2.66｜2026-08-14

- 玩家端車團頁加入 Member Session 權限裁切；正式車團成員可查看完整車團、玩家、工作人員與座位，非成員只取得公開基本資訊。

### V2.67｜2026-08-14

- LINE 時間資訊與小助手卡片優先讀取正式 `gameDate`／`gameTime`，舊資料才回退相容欄位。

### V2.68｜2026-08-14

- 群組小助手「使用說明」改為 LINE message action，不再開啟重複資訊頁；說明聚焦現行快捷指令與快速記帳範例。

### V2.69｜2026-08-14

- LINE 快速記帳正式入帳後回覆項目、金額、付款人與待分帳狀態；無法唯一辨識時不公開候選成員姓名。

### V2.70｜2026-08-14

- `pages/group-assistant.html?tab=accounting` 正式定位為綁定車團總帳入口；新增 Activity Accounting Summary，以唯一正式 Transaction／Settlement 聚合總帳與待結清摘要。
- `api/group-assistant-context.js` 使用 `accountingViews/activityCurrent` 快取摘要並在來源版本變更時重建。

### V2.71｜2026-08-16

- 啟用 Car Detail 行前提醒設定、預覽與 Firestore `cars/{carId}/reminders/preTrip`。
- LINE 群組「行前提醒」快捷入口改讀正式 Reminder，只回覆已綁定／已關閉狀態。
- 新增 Reminder Repository、LINE Reminder Service、LINE Push、Dispatch Service 與受 Secret 保護的 `/api/run-reminders`。
- 建立 `reminders.noticeStatus`、`reminders.scheduledAt` Collection Group Ascending 單欄位索引。
- 實測 LINE 主動 Push 與 Firestore Claim 防重複成功；第二次 Dispatcher 不會再次發送同一 Reminder。
- cron-job.org Scheduler Adapter 已正式建立並改為每 1 分鐘執行；Test Run 已驗證 `200 OK / success=true`。
- 首次開啟／關閉提醒會建立 pending 狀態通知，由同一 Dispatcher 在下一輪排程向已綁定 LINE 群組發送；一般修改設定不重複通知。

### V2.73｜2026-08-19

- 啟用 `js/modules/car/detail/core/permissions.js` 與 `audit.js`，補齊車團 Owner／System Admin 編輯權限及不可省略的修改 Audit。
- `js/common/system-admin-switcher.js` 納入 Current Runtime；Edit Car 監聽身分切換並立即重新判斷權限。
- Edit Car 新增 `visibility=private/public` 修改，舊資料缺欄位安全回退 private。
- Edit Calendar 支援既有 Event 更新、衝突檢查、自身 Event 排除，以及舊車第一次從編輯頁補建 Google Calendar Event。
- Calendar 取消勾選定位為停止後續同步，V1 不刪除 Google 既有 Event。
- `js/modules/car/detail/core/` 從 Reserved／未歸類提升為已確認 Runtime；`config/permissions.js` 保留 Config 身分，不與 Runtime Permission 混用。
- 補記 `carRelations.assistRecruiting` 與個人揪團頁 Host + Assist Car 合併關係。
- 工程交付改採保留完整專案路徑的小型 ZIP；Vercel 驗收固定先 Test、再精準 Git、Push、部署後實測。

### V2.75｜2026-08-19

- LINE `memberJoined` 正式接入群組歡迎流程。
- 歡迎卡固定 DM 在上、Player 在下；兩個入口各自導向 DM Join 與 Player Join。
- 未綁定 Car 的群組不發送活動歡迎卡。

### V2.76｜2026-08-19

- 完成 Player Join / DM Join → Pending Application → 報名審核 → Car Detail → 主揪核准／拒絕閉環。
- 新增首頁 Pending Actions 分類骨架與報名審核總數；報名審核第二層再區分玩家／DM。
- DM Approval 正式整合 Detail Page Render，核准後可綁既有 DM 或動態新增 Staff Slot。

### V2.77｜2026-08-19

- 玩家報名頁「查看車友」正式接回 `car.players[]`；公開模式可直接查看，`approved_only` 僅核准玩家可查看。
- 移除舊車友名單 placeholder，並補 `playerName` 顯示相容。
