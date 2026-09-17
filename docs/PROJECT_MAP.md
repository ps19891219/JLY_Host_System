# JLY Host System｜Project Map

> Status: Working Map
>
> Version: V3.26
>
> Last Updated: 2026-09-17
>

## V3.26 Car Role / Ownership Source Boundary（2026-09-17）

- Car participant role and management ownership are separate concepts. `myRole / isHost / isPlayer` plus formal player Membership describe the viewer's role in an Activity; `ownerId` describes creator/ownership management authority and must not be used as a general host-role shortcut.
- Create Car persists `ownerId` independently from the selected `myRole`. A creator who selects `player` remains a player in MyCar / Recruit / Matching role projections while retaining edit authority through ownership.
- MyCar Prepared View consumes explicit role first, then formal player Membership. `ownerId -> host` is legacy compatibility only when the historical car has no explicit role signal, preventing old cars from disappearing without allowing ownership to overwrite a current player role.
- Edit permission resolves the current confirmed Identity component (`currentPlayerId`, Player Profile ID, confirmed linked player IDs) against `ownerId`. Names are never used for ownership. Participant role alone does not silently grant ownership.
- Recruit `assistRecruiting` is an additional recruiting capability, not a participant-role source. It must not demote a formal host to assist/non-host. Recruit and Matching should consume the shared role/identity meaning instead of inventing independent host/player inference.
- Matching conflict reads are bounded to candidate dates and must not scan the complete `cars` collection on each refresh. MyCar normal runtime remains Prepared-View-first and must not reintroduce full-car scans or legacy identity repair during ordinary page load.
- Future permission expansion for non-owner hosts must be implemented as an explicit permission relation/capability. Do not overload `ownerId`, `isHost`, `assistRecruiting`, display name, or Prepared View role flags to mean multiple concepts.

## V3.21 Settlement Pending Identity Routing（2026-08-26）

- `payment_claimed` 的 Pending Action 現在以 Activity canonical receiver 作為 `responsiblePersonId`，避免 Settlement 保存 legacy recipient 時收款本人收不到待確認通知。
- `loadDashboard()` 讀取待處理通知時會沿目前人物的 Activity identity component 查詢 canonical / linked legacy identity，既有舊 Pending Action 不需 Migration／Backfill 也可被本人讀到。
- Settlement record 新增相容性的 `canonicalFromPersonId / canonicalToPersonId` metadata；正式 Pairwise `fromPersonId / toPersonId` 保留原來源 ID，不改 Core obligation。
- `transitionNetSettlement(..., confirm)` 優先使用 canonical receiver 驗證，同時保留 legacy receiver identity component 相容。
- 不修改 Production Firestore、Schema Migration 或 Pairwise 計算公式。

## V3.20 Person Settlement Lifecycle Completion（2026-08-26）

- 人物明細正式把 `payment_claimed` 從可付款 Pairwise remaining 分離為 `processingOutgoing / processingIncoming`：付款方顯示「已申報付款／等待對方確認」，收款方顯示「待確認收款」，已 claim 金額不再重複提供付款；部分 claim 只保留尚未處理的 remaining。
- 收款方的「確認收到」不再建立第二筆 `receiver_settle`，而是對既有 `accountingSettlements` 執行 `transitionNetSettlement(..., "confirm")`，完成 `payment_claimed → settled`。
- `transitionNetSettlement()` 的 receiver authority 以 Activity linked identity component 驗證 canonical viewer 與 legacy recipient，避免既有 Settlement 的 `toPersonId` 為 legacy identity 時，人物 View 認得同一人但 confirm action 被 `net_settlement_not_allowed` 阻擋。
- Runtime cache entry：`accounting-repository.js?v=23`、`activity-accounting-view-model.js?v=7`、`accounting-controller.js?v=34`。無 Firestore Schema、Migration、Backfill 或 Production Data 修改。

## V3.19 Confirm Receipt Error Observability（2026-08-26）

- 人物明細付款／確認收款保留既有 Identity、Repository guard 與 Settlement Core；Controller 不再把所有 exception 統一顯示為登入身分錯誤，改依 `net_settlement_not_allowed`、`net_settlement_already_claimed`、Firestore permission、identity／actor mismatch 顯示對應的人類提示，未知錯誤使用一般稍後再試提示。
- Browser console 會輸出 structured diagnostic：`error.code`、`error.message`、`error.stack`，以及 `actorPersonId`、`toPersonId`、`canonicalToPersonId`、`transferId`、`transferStatus`、`originalToPersonId`、`currentPersonId`、`activityId`；不會自動重送收款，也不改寫正式帳務資料。
- Runtime cache entry：`accounting-controller.js?v=33`。本輪無 Identity normalization、Repository、Settlement Core、Firestore Schema 或 Production Data 修改。

## V3.18 Person Payment／Receipt Identity Routing Correction（2026-08-26）

- Activity identity normalization 現在會沿 owner／player／profile／legacy player 的既有 `identityIds` 關係做傳遞式 component 解析；登入者與 Pairwise recipient 即使分散在兩筆 Member record，只要由正式 linked identity 串連，仍正規化成同一 canonical Person。不使用 displayName，也沒有新增身份欄位。
- 人物卡的付款／確認收款入口繼續共用既有原地 inline form；Controller 以 canonical current Person 選擇 `claim`／`receiver_settle`，Repository 的 receiver authority 使用同一 Activity identity component 驗證，避免誤走 manager 路徑或回報「請確認登入身分」。非同一 identity component 的使用者仍被拒絕。
- 全額與部分收款仍寫入既有 `accountingSettlements`，不修改 Split、Pairwise、Payment／Settlement Core、店家帳務或 Production Data。Runtime cache entry：`accounting-data.js?v=11`、`accounting-repository.js?v=22`、`accounting-controller.js?v=32`。

## V3.17 Person Receipt Stale Guard Correction（2026-08-26）

- 人物明細「確認收款」保留 canonical Person 顯示與正式 Pair 原始 identity：送出時以原始 `from/to` 查詢同一份 Pairwise View，並以 Activity Member `identityIds` 驗證 canonical receiver 與 legacy receiver 是同一正式人物，不使用姓名合併。
- stale guard 改為分開驗證「表單開啟時該 Pair 應收額 `expectedAmount`」與「送出交易內 current Pair amount」；本次收款 `amount` 只需小於等於 current amount。因此 `$480` 全額與 `$200` 部分收款均可成立，只有 current amount 真正改變才回報 `net_settlement_amount_changed`。
- 收款仍沿用 `receiver_settle` 寫入既有 `accountingSettlements`，不修改 Transaction、Split、Pairwise、Payment／Settlement Core 或 Production Data。Runtime cache entry：`accounting-repository.js?v=21`、`activity-accounting-view-model.js?v=6`、`accounting-controller.js?v=31`。

## V3.16 Person Net Payment Display Correction（2026-08-26）

- Car Detail 人物明細第三格改為同一玩家帳務語意層級的「淨支付」：`Transaction actual payment + settled outgoing - settled incoming`。點擊金額會在原人物卡原地展開「實際支付／已收回／淨支付」，不移動頁面，也不修改正式 Payment／Settlement。
- `activityCurrent` Derived View 新增 `settledReceivedByPerson`，由 settled Settlement 的正式 `receiverPersonId / toPersonId` 投影；Schema Version 升至 10，舊 Prepared View 由既有 lazy rebuild 更新，無 Migration、Backfill 或正式 Accounting Core Schema 變更。
- Person 的「應付／應收」仍只採既有 Pairwise `playerPosition + playerNetAmount`，付款與確認收款操作不變。Production「測試3」小霙的顯示語意為：總支出 `$378`、實際支付 `$350`、已收回 `$87`、淨支付 `$263`、正式應付 `$115`。
- Runtime cache entry：`accounting.css?v=31`、`accounting-repository.js?v=20`、`activity-accounting-view-model.js?v=5`、`accounting-controller.js?v=30`。

## V3.15 Person Net Action Render Correction（2026-08-25）

- 人物明細的操作入口只依 Shared Person Projection 的正式 `playerPosition + playerNetAmount`：淨應付大於零顯示「付款」、淨應收大於零顯示「確認收款」、淨額為零不顯示操作；不再以 Pair 數量、Transaction 類型、既有付款或特定 Person ID 決定是否 Render。
- 付款／收款皆使用人物卡內原地小框，預設帶入目前淨額並允許部分金額。Aggregate 金額仍按既有 Pairwise transfer 逐筆落入同一正式 Settlement Collection；付款維持 `payment_claimed → receiver confirm → settled`，收款方直接登記已收到則以 `receiver_settle` 建立 settled Settlement 並保留 receiver／manager authority Audit，不建立第二份 Payment。
- Runtime cache entry：`accounting-controller.js?v=29`。Person Expense／Paid／Pairwise Projection、Transaction、Split、Store Accounting、LINE Accounting 均未修改；無 Firestore Schema、Migration、Backfill 或 Production Data 修改。

## V3.14 Person Detail Payment Entry Correction（2026-08-25）

- 人物明細維持 Player-only Projection 與三格 `總支出／應付或應收／已支付`；`已支付` 僅累計玩家 Transaction actual payment 與 settled outgoing Settlement，Store Payment／Fee／Split status 均不納入。Production「測試3」的小霙 `$350` 來自飲料 Transaction 的正式 `paidBy`，屬玩家帳務實際墊款，因此保留。
- 應付人物的原地付款入口補齊既有權限邊界：本人使用 `claim`；主揪只可替未使用系統的 Activity Member 使用既有 `manager_claim`，正式系統使用者仍不得被代為申報。預設金額採目前人物淨應付、仍以正式 Pairwise transfer 為付款上限，寫入既有 Settlement `payment_claimed` 並等待收款方確認。
- Runtime cache entry：`accounting-controller.js?v=28`。沒有 Accounting Core、Firestore Schema、Migration、Backfill 或 Production Data 修改。

## V3.13 Person Detail Player-only Projection（2026-08-25）

- `人物明細` 第二階段只讀玩家額外 Transaction 的正式 Split（`playerSources`），不再重複 Render 劇本基本費、指定費、訂金或其他 Store responsibility。`sources／totalExpense／paidAmount` 舊欄位仍保留供既有 Shared／LINE 相容入口使用，沒有建立第二份 Ledger。
- 人物外層仍是一個 canonical Person 一列並原地 Accordion 展開；展開後只顯示 `總支出／應付或應收／已支付`。人物頁不提供 Split 編輯，也不 Render 誰欠誰、互抵、代付或 Settlement 操作；這些既有 Core 與其他 View 均未變更。
- Runtime cache entry：`accounting.css?v=30`、`activity-accounting-view-model.js?v=4`、`accounting-controller.js?v=27`。無 Accounting Core、Firestore Schema、Migration、Backfill 或 Production Data 修改。

## V3.12 Person Detail Single-page List（2026-08-25）

- Car Detail `人物明細` 移除「查看人物帳務」下拉選單，改為直接消費 Shared Person Projection 的 `people[]`：以 Activity Member `personId + identityIds` 解析顯示名稱，一個 canonical Person 一列，不建立姓名 key 或第二份人物資料。
- 每列第一層只顯示人物與總負擔；點擊後在原列下方展開該人物的店家費用與 Transaction Split 摘要，以及 `總負擔／已付／待付／待收`。人物頁不提供 Split 編輯，也不 Render 誰欠誰、互抵、代付或 Settlement 操作；這些既有 Core 與其他 View 均未變更。
- Runtime cache entry：`accounting.css?v=29`、`accounting-controller.js?v=26`。沒有 Accounting Core、Firestore Schema、Migration、Backfill 或 Production Data 修改。

## V3.11 Person Accounting Responsibility／Payment Separation（2026-08-25）

- `人物明細` 的第一層正式定義為 Person Expense Responsibility：同一 canonical Person 的店家人物負擔與 Transaction Split 先按來源彙整；同一 `transactionId` 即使存在 legacy/current identity 的多筆 Split，也只形成一筆人物帳目摘要。相同標題但不同 Transaction 仍保留為不同來源，不以姓名或標題合併。
- `已付` 不再把 Split 的 `settlementStatus=settled` 當作實際付款。正式來源限於 Store member payment、Transaction `payments[]`（舊資料相容 `paidBy + amount`）以及已 settled 的實際付款／Settlement；`待付／待收` 繼續直接讀 Pairwise 正式方向。人物明細不提供 Split 修改，Split 編輯只存在於 `逐筆帳目`。
- `activityCurrent.transactionExpenseProjection` 增加 `actualPaymentsByPerson` 並升級為 `schemaVersion=9`；既有 View 在下一次讀取時依原有 lazy rebuild 重建，不需 Migration、Backfill 或 Production 寫入。Shared View Model 升級 `schemaVersion=2`，並沿用 Activity Member `personId + identityIds` 正規化 legacy/current identity。
