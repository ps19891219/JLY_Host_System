const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const render = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-render.js"), "utf8");
const actions = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-actions.js"), "utf8");
const repository = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-repository.js"), "utf8");
const controller = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-controller.js"), "utf8");
const feeRepository = fs.readFileSync(path.join(root, "js/modules/accounting/activity-fee-repository.js"), "utf8");
const feeController = fs.readFileSync(path.join(root, "js/modules/accounting/activity-fee-controller.js"), "utf8");

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
  assert.match(repository, /schemaVersion:5/);
});

test("淨額付款由付款方申報並由收款方確認", () => {
  assert.match(render, />送出部分付款<\/button>/);
  assert.match(render, />全部付清<\/button>/);
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

test("詳細帳目不再提供逐筆付款與代理確認", () => {
  assert.match(render, /已列入彙總/);
  assert.doesNotMatch(render, /canConfirmForReceiver/);
  assert.doesNotMatch(actions, /accounting-settlement-row button/);
});

test("結算小視窗沿用已載入的個人淨額，不另外查詢資料", () => {
  assert.match(render, /model\.personalSettlement&&model\.personalSettlement\.transfers/);
  assert.doesNotMatch(actions, /getDocs|fetch\(|\.get\(/);
});

test("下方分帳明細唯讀，上方互抵總額支援部分付款與全額付清", () => {
  assert.match(render, /accounting-net-amount/);
  assert.match(render, />送出部分付款</);
  assert.match(render, />全部付清</);
  assert.match(render, /已列入彙總/);
  assert.doesNotMatch(render, /accounting-settlement-row[^`]*data-action/);
  assert.match(actions, /input&&input\.value/);
  assert.match(repository, /applyConfirmedSettlements/);
  assert.match(repository, /settleObligation/);
  assert.match(repository, /net_settlement_invalid_amount/);
});

test("互抵與付款上限都使用一對一應收應付關係", () => {
  assert.match(controller, /netSettlementFromObligations\(dashboard\.obligationsByPair\)/);
  assert.doesNotMatch(controller, /netSettlementFromBalances\(dashboard\.balanceByPerson\)/);
  assert.match(repository, /netTransferAmount\(view\.obligationsByPair,from,to\)/);
  assert.match(repository, /netTransferAmount\(obligationsByPair,record\.fromPersonId,record\.toPersonId\)/);
});

test("主揪可在管理視角代未啟用系統的付款人登記彙總付款", () => {
  assert.match(render, /data-action="manager_claim"/);
  assert.match(render, /代為登記部分付款/);
  assert.match(controller, /input\.action==="claim"\|\|input\.action==="manager_claim"/);
  assert.match(repository, /managerClaim&&input\.actorPersonId===input\.managerPersonId&&!input\.targetUsesSystem/);
  assert.match(repository, /claimAuthority:managerClaim\?"manager_for_offline_member":"self"/);
});

test("淨額付清後同一對成員的反向等額債務一併互抵完成", () => {
  assert.match(repository, /const offset=Math\.min\(Number\(direct\.amount\)\|\|0,Number\(reverse\.amount\)\|\|0\)/);
  assert.match(repository, /obligations=settleObligation\(obligations,from,to,amount\)/);
  assert.match(repository, /schemaVersion:5/);
});

test("劇本費代收與外部店家付款使用獨立正式紀錄", () => {
  assert.match(feeRepository, /accountingFeePlans/);
  assert.match(feeRepository, /accountingFeeCollections/);
  assert.match(feeRepository, /accountingExternalPayments/);
  assert.match(feeRepository, /accountingFeeAuditLogs/);
  assert.match(feeController, /玩家待收/);
  assert.match(feeController, /店家待付/);
  assert.match(feeController, /訂金/);
  assert.match(feeController, /尾款/);
});
