# JLY Host System｜Project Map Continuation

> Canonical continuation of `docs/PROJECT_MAP.md`
>
> Range: V3.22 → V3.24
>
> Last Updated: 2026-09-02
>
> This is an append to the existing Project Map, not a second blueprint.

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
- Accounting production code baseline before this documentation-only append: `b7621f11534836f803f9f18b438701bea6ca0fae`
- Current Accounting asset versions in `pages/car-detail.html`: `accounting.css?v=35`, `pairwise-obligation.js?v=3`, `accounting-render.js?v=24`, `accounting-actions.js?v=14`, `accounting-controller.js?v=40`.
- Full regression baseline: `354 / 354 pass`.
- Deployment acceptance must verify the full chain `GitHub main → Vercel Production build → production alias → formal URL`; a green GitHub status alone is not sufficient evidence of final browser acceptance.
