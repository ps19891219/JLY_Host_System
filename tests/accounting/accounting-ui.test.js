const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const render = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-render.js"), "utf8");
const actions = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-actions.js"), "utf8");
const repository = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-repository.js"), "utf8");
const controller = fs.readFileSync(path.join(root, "js/modules/accounting/accounting-controller.js"), "utf8");
const feeRepository = fs.readFileSync(path.join(root, "js/modules/accounting/activity-fee-repository.js"), "utf8");
const feeController = fs.readFileSync(path.join(root, "js/modules/accounting/activity-fee-controller.js"), "utf8");
const summaryRender = fs.readFileSync(path.join(root, "js/modules/car/detail/render/summary-render.js"), "utf8");
const seatRender = fs.readFileSync(path.join(root, "js/modules/car/detail/render/seat-section-render.js"), "utf8");

function renderAccounting(transactions) {
  const context = { window: {} };
  vm.runInNewContext(render, context);
  return context.window.JLYAccountingRender.buildDashboardHtml({
    members: [], membersById: new Map(), memberNames: new Map(), transactions,
    currentPersonId: "p1", viewPersonId: "p1", isManager: false, managementMode: false,
    counts: { total: 0, paymentConfirmation: 0 }, personalSettlement: { payable: 0, receivable: 0, transfers: [] },
    personalObligations: { payable: [], receivable: [], payableTotal: 0, receivableTotal: 0 },
    activeNetSettlements: [], detailMode: false, detailHasMore: false, getFilterState: () => "pending_split"
  });
}

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
  assert.match(feeController, /＋ 新增費用/);
  assert.match(feeController, /id="feeItemForm" class="accounting-quick-form" hidden/);
  assert.match(feeController, /id="memberFeeForm" class="accounting-quick-form" hidden/);
  assert.match(feeController, /id="vendorFeeForm" class="accounting-quick-form" hidden/);
  assert.match(feeController, /setFeeFormOpen/);
  assert.match(feeController, /feeDetailsToggle\.id="feeDetailsToggle"/);
  assert.match(feeController, /feeDetails\.hidden=true/);
  assert.match(feeController, /展開核銷明細/);
  assert.match(feeController, /收起核銷明細/);
  assert.match(feeController, /data-fee-cancel/);
  assert.match(feeController, /person\.outstanding/);
  assert.match(feeController, /summary\.vendorOutstanding/);
  assert.match(feeController, /card\.dataset\.feeSummaryTarget=target/);
  assert.match(feeController, /targets=\["memberFeeForm","vendorFeeForm"\]/);
  assert.match(feeController, /button\.dataset\.feeToggle!=="feeItemForm"/);
  assert.match(feeController, /event\.key==="Enter"\|\|event\.key===" "/);
  assert.match(feeController, /玩家均分/);
  assert.match(feeController, /指定玩家支付/);
  assert.match(feeController, /主揪支付/);
  assert.match(feeController, /自訂分攤/);
  assert.match(feeController, /requiredPlayerCount/);
  assert.match(feeController, /系統會自動建立並計算劇本費/);
  assert.doesNotMatch(feeController, /name="vendorBaseAmount"/);
  assert.match(controller, /car\.studioName\|\|car\.organizerName\|\|car\.organizer/);
  assert.match(feeController, /!loaded\.plan&&isManager&&fixedCount&&defaultPlayerFee&&vendorName/);
  assert.doesNotMatch(feeController, /id="feePlanForm"/);
  assert.doesNotMatch(feeController, /建立劇本費<\/button>/);
});

test("車團摘要左側可快速定位，右側保留欄位編輯", () => {
  assert.match(summaryRender, /navigationTarget/);
  assert.match(summaryRender, /seatSection/);
  assert.match(summaryRender, /activityFeeSection/);
  assert.doesNotMatch(summaryRender, /field:\s*"studioName",\s*editable:\s*true,\s*navigationTarget:/);
  assert.match(render, /id="activityFeeMount"/);
  assert.match(render, /accounting-drafts/);
  assert.match(render, /data-draft-dismiss/);
  assert.match(controller, /loadPendingDrafts/);
  assert.match(controller, /transitionDraft/);
  assert.match(feeController, /mountPoint=section\.querySelector\("#activityFeeMount"\)\|\|section/);
  assert.match(render, /hasAccountingData/);
  assert.match(render, /id="accountingDetailsToggle"/);
  assert.match(render, /id="accountingDetails"/);
  assert.match(render, /hasAccountingData\?summary\+dialog:""/);
  assert.match(actions, /details\.hidden=!details\.hidden/);
  assert.match(summaryRender, /openSingleFieldEditor/);
  assert.match(summaryRender, /openSeatSettings\(\)/);
  assert.match(seatRender, /id="seatSection"/);
});

test("沒有快速記帳時隱藏個人帳務摘要與明細入口", () => {
  const html = renderAccounting([]);
  assert.doesNotMatch(html, /data-settlement-dialog=/);
  assert.match(html, /id="accountingDetailsToggle"[^>]* hidden/);
  assert.match(html, /id="accountingDetails" hidden/);
});

test("有快速記帳後顯示摘要，明細仍預設收合", () => {
  const html = renderAccounting([{ transactionId: "t1", title: "晚餐", amount: 300, paidBy: "p1", splitStatus: "pending", splits: [] }]);
  assert.match(html, /data-settlement-dialog="payable"/);
  assert.doesNotMatch(html, /id="accountingDetailsToggle"[^>]* hidden/);
  assert.match(html, /id="accountingDetails" hidden/);
});
