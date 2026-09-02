# JLY Host System｜Project Map Continuation

> Canonical continuation of `docs/PROJECT_MAP.md`
>
> Range: V3.22 → V3.26
>
> Last Updated: 2026-09-02
>
> This is an append to the existing Project Map, not a second blueprint.

## V3.26 Accounting Identity-before-Settlement Compatibility（2026-09-02）

- Production 驗收再次確認 `activityCurrent` 已重建但舊 `$212 / $125` 仍存在，因此根因不再是部署或 stale View，而是 Settlement 核銷順序：舊 Transaction obligation 可能保存 legacy Person ID，已收款 Settlement 則保存 current canonical Person ID；若先以 raw ID 套用 Settlement、之後才在 UI canonicalize，兩者不會命中同一 Pair。
- `accounting-view-refresh.js` Runtime revision 升為 `2`。Car Detail 在 Dashboard rebuild 前先讀正式 Activity Member identity component，建立 canonical Person resolver，並將 obligation / settlement 的 `fromPersonId / toPersonId`、original pair、debtor/receiver pair 與 canonical pair 同步正規化後，再交給既有 Pairwise `applySettlements()`。同一 Settlement 金額仍只由既有 Pairwise bucket 消耗一次。
- Obligation canonicalization 只影響可重建的 Prepared View 計算；原 Transaction、Split、Settlement 文件不 Migration、不 Backfill、不依姓名合併。原始 obligation direction 以 compatibility metadata 保留供 Audit／相容用途。
- `projectionRuntimeRevision=2` 會讓先前 revision 1 的 `activityCurrent` 在下一次 Car Detail 讀取時再重建一次，確保既有 production car 也走新的 identity-before-settlement 計算順序。
- Runtime asset：`accounting-view-refresh.js?v=2`。Regression coverage 加入 legacy obligation + canonical settled record 的 Runtime case，預期 settled `$212` 不再回到目前應收。

## V3.25 Accounting Prepared View Invalidation（2026-09-02）

- Production 驗收確認新版 Pairwise Settlement 計算雖已部署，但既有 `accountingViews/activityCurrent` 可能因來源資料時間戳未變而被沿用，造成舊的「誰欠我／互抵後」摘要持續顯示。
- 新增 `js/modules/accounting/accounting-view-refresh.js` 作為 Accounting Prepared View compatibility refresh：Car Detail 載入 Dashboard 前檢查 `projectionRuntimeRevision`；舊 View 缺少 revision 時先刪除僅屬 Read Model 的 `activityCurrent`，再沿既有 `rebuildActivityView()` 從 canonical Transaction／Settlement／Pending 重建，成功後寫入 revision marker。只動可重建 Prepared View，不修改 Transaction、Split、Settlement Core，不 Migration／Backfill。
- `pages/car-detail.html` 在 `accounting-repository.js` 後、Controller 前載入 `accounting-view-refresh.js?v=1`，確保既有 production car 在首次進入新版 Car Detail 時完成一次 View refresh；後續同 revision 不重複刪除或重建。
- Car Detail 與 LINE 仍共用同一 `activityCurrent` Prepared View。Car Detail 完成 refresh 後，LINE 讀取的是同一份已更新 View，不建立 LINE Ledger 或第二套 Projection。
- Regression coverage 延伸 `tests/accounting/accounting-live-regressions.test.js`，加入 stale View → delete → canonical dashboard rebuild → revision marker 的 Runtime mock 驗證。

## V3.24 Accounting Production Acceptance Regression Closure（2026-09-01）

- 修正已結清 Pairwise 在 legacy／canonical identity 混用時仍殘留「誰欠我／互抵後應收」的 Production regression。`applySettlements()` 會在同一 Settlement amount bucket 內相容 `fromPersonId/toPersonId`、`originalFromPersonId/originalToPersonId` 與 `debtorPersonId/receiverPersonId` 的正式方向；同一筆 Settlement 金額只消耗一次，不重複核銷。
- Pending Action 若舊文件缺少 counterparty／amount，Render 會從同一份 `netSettlement.transfers` 補足目前可驗證的對象與金額；「去處理」不再依賴 `sourceId` 才能進入 Person 卡，舊 Pending 仍可導向待付／處理中的正式人物帳務。
- `逐筆帳目` 的 Split 金額正式採 B 方案：點擊單一金額只在原列開啟 Inline Amount Editor；總額不平時顯示差額並禁止正式保存，不偷改其他 Person 或 Transaction total。完整總額／服務費／全部 Split 修改保留為獨立「調整整筆分帳」入口。
- Car Detail 與 LINE Accounting 繼續共用同一 Activity Accounting Projection／View；本輪不建立第二套 Ledger、不 Migration／Backfill Production Firestore。
- Runtime cache entry：`accounting.css?v=35`、`pairwise-obligation.js?v=3`、`accounting-render.js?v=24`、`accounting-actions.js?v=14`、`accounting-controller.js?v=40`。正式修正 commit：`b7621f11534836f803f9f18b438701bea6ca0fae`。
- Regression coverage 新增 `tests/accounting/accounting-live-regressions.test.js`；完整 Repository 測試：`354 tests / 354 pass / 0 fail`。

## V3.23 Accounting Delegated Payment UI Closure（2026-09-01）

- 新版人物明細移除舊 Net Settlement Dialog 後，Delegated Payment Domain 雖仍存在但「請人代付／幫他代付」失去啟動入口；本輪將兩個入口正式接回目前 Person Accounting 卡片，不回復舊 Dialog。
- 「請人代付」由原債務人指定正式 Activity Member，沿用 `createDelegatedRequest()` 建立 `pending_acceptance`；接受只表示接受責任，不視為付款。
- 「幫他代付」沿用 `claimNetSettlement(... action=delegated_claim ...)`，保留原債務人、實際付款人與收款人三者語意，付款仍需收款方確認後才 settled。
- Current Person 判斷改採 canonical `person.personId === model.currentPersonId`，不依 legacy transfer `fromPersonId` 判定本人；手機版控制維持 Person 卡內原地操作。
- 正式 commit：`80fee7e13724ae9230c2f3795f3ca9a7ec1cd3b1`；完整 Repository 測試：`350 tests / 350 pass / 0 fail`。

## V3.22 Accounting Inline Split Editing／Settled Total Preservation（2026-08-27）

- `逐筆帳目` 的 Split 修改方向正式定案為 B 方案：以單一 Person Split 金額作為原地編輯入口，不要求使用者先進入大型整筆 Editor。
- Split amount 變更仍必須保持 Transaction/Split invariant：正式保存前全部 Split 合計必須等於該筆 Transaction 可分配總額；修改不以重新計算或重建 Settlement 的方式破壞既有已結清結果。
- Accounting UI 同步收斂，保留 settled totals 與既有正式 Transaction／Split／Pairwise／Settlement 單一資料來源；不另建第二套 Accounting。
- 相關正式 commits：`7869003`（Simplify accounting UI and preserve settled totals）、`35e4917`（Add inline split amount editing）、`26d4f4c`（Bump accounting asset cache versions）。當時完整測試：`335 tests / 335 pass / 0 fail`。

## Current Formal Accounting Baseline

- Repository: `ps19891219/JLY_Host_System`
- Branch: `main`
- Accounting production code baseline before V3.26: `7940e12d810b0fbdb451f88ae7f1a4dc08e15a46`
- V3.26 runtime asset candidate: `accounting-view-refresh.js?v=2`.
- Last fully verified repository regression baseline before V3.26: `354 / 354 pass`.
- Deployment acceptance must verify the full chain `GitHub main → Vercel Production build → production alias → formal URL`; a green GitHub status alone is not sufficient evidence of final browser acceptance.
