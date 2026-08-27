const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const render = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-render.js"), "utf8");
const actions = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-actions.js"), "utf8");
const repository = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-repository.js"), "utf8");
const pairwiseSource = fs.readFileSync(path.join(root, "shared/accounting/pairwise-obligation.js"), "utf8");
const pairwise = require(path.join(root, "shared/accounting/pairwise-obligation.js"));

test("Inline Split 點擊會定位到真正帳目卡片而不是金額按鈕自己", () => {
  assert.match(actions, /button\.closest\("\.accounting-entry"\)/);
  assert.doesNotMatch(actions, /button\.closest\("\[data-transaction-id\]"\)/);
  assert.match(render, /class="accounting-split-edit-toggle" data-split-id=/);
  assert.doesNotMatch(render, /class="accounting-split-edit-toggle" data-transaction-id=/);
});

test("未進付款流程前可在同一筆帳修改總額並加入共用外送費服務費", () => {
  assert.match(render, /data-inline-total/);
  assert.match(render, /data-shared-fee="delivery"/);
  assert.match(render, /data-shared-fee="service"/);
  assert.match(render, /data-inline-allocate-fees/);
  assert.match(render, /不會另外建立一筆帳/);
  assert.match(actions, /feeTotal\/editable\.length/);
  assert.match(actions, /__transactionTotal=currentTotal\(\)/);
  assert.match(repository, /requestedTotal/);
  assert.match(repository, /transaction_amount_locked/);
  assert.match(repository, /externalLocked/);
  assert.match(repository, /amount:requestedTotal/);
});

test("總額修改仍由 canonical Transaction 與 lifecycle 狀態決定", () => {
  assert.match(repository, /transaction\.get\(entryRef\)/);
  assert.match(repository, /split\.personId!==entry\.paidBy&&split\.settlementStatus!=="payment_due"/);
  assert.match(repository, /Array\.isArray\(entry\.payments\)&&entry\.payments\.length/);
  assert.match(repository, /preservedActionIds/);
  assert.match(repository, /item\.data\.actionType!=="payment_due"/);
  assert.match(repository, /split_total_mismatch/);
});

test("已結清 split 不再投影成我的未付 obligation，付款人自己的初始 settled 不受影響", () => {
  const transaction = {
    transactionId: "meal-1",
    type: "expense",
    status: "active",
    splitStatus: "completed",
    paidBy: "payer",
    amount: 300,
    splits: [
      { splitId: "payer", personId: "payer", amount: 100, settlementStatus: "settled" },
      { splitId: "paid", personId: "paid", amount: 100, settlementStatus: "settled" },
      { splitId: "due", personId: "due", amount: 100, settlementStatus: "payment_due" }
    ],
    obligations: [
      { obligationId: "o1", sourceTransactionId: "meal-1", fromPersonId: "paid", toPersonId: "payer", amount: 100 },
      { obligationId: "o2", sourceTransactionId: "meal-1", fromPersonId: "due", toPersonId: "payer", amount: 100 }
    ]
  };

  const obligations = pairwise.buildTransactionObligations(transaction);
  assert.deepEqual(
    obligations.map(item => [item.fromPersonId, item.toPersonId, item.amount]),
    [["due", "payer", 100]]
  );
  assert.match(pairwiseSource, /personId !== payer/);
  assert.match(pairwiseSource, /settlementStatus\) === "settled"/);
});

test("新的 Projection 版本會讓舊 activityCurrent 摘要強制重建", () => {
  assert.match(repository, /SOURCE_PROJECTION_VERSION = "settled_split_v2"/);
  assert.match(repository, /\$\{SOURCE_PROJECTION_VERSION\}/);
  assert.match(repository, /SUMMARY_VERSION = 3/);
  assert.match(repository, /VIEW_SCHEMA_VERSION = 10/);
});
