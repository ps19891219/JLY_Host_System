const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const render = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-render.js"), "utf8");
const actions = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-actions.js"), "utf8");
const repository = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-repository.js"), "utf8");

test("個人應付與應收摘要可開啟各自的明細小視窗", () => {
  assert.match(render, /data-settlement-dialog="payable"/);
  assert.match(render, /data-settlement-dialog="receivable"/);
  assert.match(render, /data-settlement-dialog="net"/);
  assert.match(render, /id="accountingSettlementDialog"/);
  assert.match(actions, /showModal/);
  assert.match(actions, /我欠誰/);
  assert.match(actions, /誰欠我/);
});

test("原始應收應付與互抵後總額分開顯示", () => {
  assert.match(render, />我欠誰</);
  assert.match(render, />誰欠我</);
  assert.match(render, />互抵後總額</);
  assert.match(repository, /obligationsByPair/);
  assert.match(repository, /schemaVersion:3/);
});

test("淨額付款由付款方申報並由收款方確認", () => {
  assert.match(render, />我已付款<\/button>/);
  assert.match(render, />確認收款<\/button>/);
  assert.match(actions, /onNetSettlement/);
  assert.match(repository, /status:"payment_claimed"/);
  assert.match(repository, /status:"settled"/);
  assert.match(repository, /accountingSettlements/);
});

test("主揪只能代未使用系統的收款人確認淨額付款", () => {
  assert.match(render, /managerCanConfirm/);
  assert.match(render, />代為確認收款<\/button>/);
  assert.match(repository, /manager_for_offline_member/);
  assert.match(repository, /authority\.targetUsesSystem/);
  assert.ok(render.indexOf("if(managerCanConfirm)") < render.indexOf("model.currentPersonId===claim.fromPersonId"), "管理離線收款人時，代為確認必須優先於付款人撤回");
});

test("詳細帳目優先顯示離線收款人的代理確認，不被付款人撤回遮蔽", () => {
  assert.match(render, /canConfirmForReceiver/);
  assert.match(render, /data-target-person-id=.*代為確認收款/);
  assert.ok(render.indexOf("if(canConfirmForReceiver)") < render.indexOf("if(mine)buttons"));
  assert.match(actions, /targetPersonId:button\.dataset\.targetPersonId/);
});

test("結算小視窗沿用已載入的個人淨額，不另外查詢資料", () => {
  assert.match(render, /model\.personalSettlement&&model\.personalSettlement\.transfers/);
  assert.doesNotMatch(actions, /getDocs|fetch\(|\.get\(/);
});
