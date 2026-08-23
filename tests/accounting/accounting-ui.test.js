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
const accountingCss = fs.readFileSync(path.join(root, "css/pages/accounting.css"), "utf8");
const globalCss = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
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
  assert.match(repository, /VIEW_SCHEMA_VERSION = 7/);
  assert.match(render, /原始尚未結清應付/);
  assert.match(render, /原始尚未結清應收/);
  assert.match(render, /const payable=item\.fromPersonId===personId/);
  assert.match(render, /direction=payable\?"付款":item\.toPersonId===personId\?"收款":"協助"/);
  assert.doesNotMatch(render, /<small>全車互抵後<\/small>/);
});

test("互抵後明細依正式方向顯示付款或收款", () => {
  const context = { window: {} };
  vm.runInNewContext(render, context);
  const html = context.window.JLYAccountingRender.buildDashboardHtml({
    members: [], membersById: new Map(), memberNames: new Map([["p2", "燕餃"]]),
    transactions: [{ transactionId: "t1", title: "晚餐", amount: 100, paidBy: "p1", splitStatus: "completed", splits: [] }],
    currentPersonId: "p1", viewPersonId: "p1", isManager: false, managementMode: false,
    counts: { total: 0, paymentConfirmation: 0 },
    personalSettlement: { payable: 60, receivable: 0, transfers: [{ fromPersonId: "p1", toPersonId: "p2", amount: 60 }] },
    personalObligations: { payable: [{ fromPersonId: "p1", toPersonId: "p2", amount: 100 }], receivable: [], payableTotal: 100, receivableTotal: 0 },
    activeNetSettlements: [], settlementHistory: [], detailMode: false, detailHasMore: false,
    getFilterState: () => "payment_due"
  });

  assert.match(html, /<strong>付款<\/strong>｜付給 <strong>燕餃<\/strong>/);
  assert.match(html, /同一對 Person 互抵後/);
  assert.match(html, /原始尚未結清應付/);
});

test("淨額付款由付款方申報並由收款方確認", () => {
  assert.match(render, />送出部分付款<\/button>/);
  assert.match(render, />全部付清<\/button>/);
  assert.match(render, />確認收款<\/button>/);
  assert.match(actions, /onNetSettlement/);
  assert.match(repository, /status:\s*"payment_claimed"/);
  assert.match(repository, /status:\s*"settled"/);
  assert.match(repository, /accountingSettlements/);
});

test("主揪只能代未使用系統的收款人確認淨額付款", () => {
  assert.match(render, /managerCanConfirm/);
  assert.match(render, />代為確認收款<\/button>/);
  assert.match(repository, /manager_for_offline_member/);
  assert.match(repository, /authority\.targetUsesSystem/);
  assert.ok(
    render.indexOf("if(managerCanConfirm)") <
      render.indexOf("model.currentPersonId===claim.fromPersonId"),
    "管理離線收款人時，代為確認必須優先於付款人撤回"
  );
});

test("詳細帳目不再提供逐筆付款與代理確認", () => {
  assert.match(render, /已列入彙總/);
  assert.match(render, /已付款，待確認/);
  assert.match(render, /付款申報已退回/);
  assert.match(render, /split\.confirmedAt/);
  assert.doesNotMatch(render, /canConfirmForReceiver/);
  assert.doesNotMatch(actions, /accounting-settlement-row button/);
});

test("展開帳務明細按需讀取正式 Transaction 與 Settlement 歷史", () => {
  assert.match(repository, /function loadSettlementHistory/);
  assert.match(repository, /collection\("accountingSettlements"\)/);
  assert.match(controller, /repository\.loadSettlementHistory\(carId,20\)/);
  assert.match(render, /付款／收款與核銷紀錄/);
  assert.match(render, /model\.settlementHistory/);
  assert.match(render, /data-details-loaded=/);
  assert.match(actions, /detailsToggle\.dataset\.detailsLoaded!=="true"/);
});

test("Studio menu scoped CSS 覆蓋全域白色按鈕文字", () => {
  assert.match(globalCss, /button\s*\{[^}]*color:\s*#fff/i);
  const scopedRule = accountingCss.match(/\.accounting-fee-menu button\s*\{([^}]*)\}/);
  assert.ok(scopedRule, "Studio menu 必須有 scoped button 規則");
  assert.match(scopedRule[1], /color:\s*#2d322f/i);
  assert.doesNotMatch(scopedRule[1], /color:\s*(?:#fff|white|transparent)/i);
  assert.match(accountingCss, /\.accounting-fee-menu button:disabled\s*\{[^}]*color:\s*#aaa/i);
});

test("Settlement history 正確區分本人付款、代付與舊資料", () => {
  const context = { window: {} };
  vm.runInNewContext(render, context);
  const html = context.window.JLYAccountingRender.buildDashboardHtml({
    members: [], membersById: new Map(),
    memberNames: new Map([["A","小安"],["B","小白"],["C","小陳"]]),
    transactions: [{ transactionId:"t1", title:"晚餐", amount:300, paidBy:"A", splitStatus:"completed", splits:[] }],
    currentPersonId:"A", viewPersonId:"A", isManager:false, managementMode:false,
    counts:{ total:0, paymentConfirmation:0 },
    personalSettlement:{ payable:0, receivable:0, transfers:[] },
    personalObligations:{ payable:[], receivable:[], payableTotal:0, receivableTotal:0 },
    activeNetSettlements:[], detailMode:true, detailHasMore:false,
    settlementHistory:[
      { fromPersonId:"A", toPersonId:"B", paidBy:"A", amount:100, status:"settled" },
      { fromPersonId:"A", debtorPersonId:"A", toPersonId:"B", paidBy:"C", amount:80, status:"settled" },
      { fromPersonId:"B", toPersonId:"A", amount:40, status:"settled" }
    ],
    getFilterState:()=>"settled"
  });
  assert.match(html, /<strong>小安<\/strong> 付款給 <strong>小白<\/strong>/);
  assert.match(html, /<strong>小陳<\/strong> 代 <strong>小安<\/strong> 支付給 <strong>小白<\/strong>/);
  assert.doesNotMatch(html, /<strong>小安<\/strong> 代 <strong>小陳<\/strong>/);
  assert.match(html, /<strong>小白<\/strong> 付款給 <strong>小安<\/strong>/);
});

test("結算小視窗沿用已載入的個人淨額，不另外查詢資料", () => {
  assert.match(render, /model\.personalSettlement&&model\.personalSettlement\.transfers/);
  assert.doesNotMatch(actions, /getDocs|fetch\(|collection\([^\n]+\.get\(/);
});

test("下方分帳明細唯讀，上方互抵總額支援部分付款與全額付清", () => {
  assert.match(render, /accounting-net-amount/);
  assert.match(render, />送出部分付款</);
  assert.match(render, />全部付清</);
  assert.match(render, /已列入彙總/);
  assert.doesNotMatch(render, /accounting-settlement-row[^`]*data-action/);
  assert.match(actions, /input&&input\.value/);
  assert.match(repository, /applyConfirmedSettlements/);
  assert.match(repository, /net_settlement_invalid_amount/);
});

test("互抵與付款上限只使用正式 Pairwise View", () => {
  assert.match(controller, /dashboard\.settlementTransfers/);
  assert.doesNotMatch(controller, /netSettlementFromBalances\(dashboard\.balanceByPerson/);
  assert.match(controller, /accounting_pairwise_view_unavailable/);
  assert.match(repository, /accounting_pairwise_engine_unavailable/);
  assert.doesNotMatch(repository, /:\s*buildSettlementPlan\(currentBalance\)/);
  assert.match(repository, /settlementTransfers/);
});

test("主揪可在管理視角代未啟用系統的付款人登記彙總付款", () => {
  assert.match(render, /data-action="manager_claim"/);
  assert.match(render, /代為登記部分付款/);
  assert.match(controller, /input\.action==="claim"\|\|input\.action==="manager_claim"/);
  assert.match(repository, /manager_for_offline_member/);
  assert.match(repository, /targetUsesSystem/);
});

test("淨額付清後仍由 Pairwise obligation 產生剩餘結算方案", () => {
  assert.match(repository, /pairwise\.applySettlements/);
  assert.match(repository, /pairwise\.aggregatePairwiseObligations/);
  assert.doesNotMatch(repository, /:\s*buildSettlementPlan\(currentBalance\)/);
  assert.match(repository, /VIEW_SCHEMA_VERSION = 7/);
  assert.match(repository, /SUMMARY_VERSION = 2/);
  assert.doesNotMatch(
    repository,
    /const offset=Math\.min\(Number\(direct\.amount\)/
  );
});

test("劇本費代收與外部店家付款使用獨立正式紀錄", () => {
  assert.match(feeRepository, /accountingFeePlans/);
  assert.match(feeRepository, /accountingFeeCollections/);
  assert.match(feeRepository, /accountingExternalPayments/);
  assert.match(feeRepository, /accountingFeeAuditLogs/);
  assert.match(feeController, /<span>玩家繳費<\/span><small>待收/);
  assert.match(feeController, /data-summary-key/);
  assert.match(feeController, /付款項目，例如：預付訂金/);
  assert.match(feeController, /＋ 新增額外費用/);
  assert.match(feeController, /id="feeItemForm" class="accounting-quick-form" hidden/);
  assert.match(feeController, /id="memberFeeForm" class="accounting-quick-form" hidden/);
  assert.match(feeController, /id="vendorPaymentForm" class="accounting-quick-form" hidden/);
  assert.match(feeController, /id="vendorReceiptForm" class="accounting-quick-form" hidden/);
  assert.match(feeController, /setFeeFormOpen/);
  assert.match(feeController, /data-details-toggle="feeDetails"/);
  assert.match(feeController, /id="studioPaymentDetails" class="accounting-fee-details" hidden/);
  assert.match(feeController, /id="studioAuditDetails" class="accounting-fee-details" hidden/);
  assert.equal((feeController.match(/accounting-accordion-toggle/g)||[]).length,4);
  assert.match(feeController, /details\.hidden=!details\.hidden/);
  assert.match(feeController, /data-fee-cancel/);
  assert.match(feeController, /person\.outstanding/);
  assert.match(feeController, /summary\.vendorOutstanding/);
  assert.match(feeController, /studioFeeMenuButton/);
  assert.match(feeController, /vendorPaymentForm/);
  assert.match(feeController, /vendorReceiptForm/);
  assert.doesNotMatch(feeController, /name="category"/);
  assert.match(feeController, /studioSummaryItems/);
  assert.match(feeController, /工作室收付款/);
  assert.match(feeController, /等待人工核銷/);
  assert.match(feeController, /data-vendor-settle/);
  assert.match(feeController, /settleVendorPayment/);
  assert.match(feeRepository, /vendor_payment_manually_settled/);
  assert.match(feeRepository, /pendingActionIds:\[\]/);
  assert.match(feeRepository, /createdBy:actorPersonId/);
  assert.match(feeRepository, /paidBy:kind!=="refund"/);
  assert.doesNotMatch(feeController, /id="vendorPaymentForm"[^]*?<select name="personId"/);
  assert.match(feeController, /玩家均分/);
  assert.match(feeController, /指定玩家支付/);
  assert.match(feeController, /主揪支付/);
  assert.match(feeController, /自訂分攤/);
  assert.match(feeController, /requiredPlayerCount/);
  assert.match(feeController, /系統會自動建立並計算劇本費/);
  assert.doesNotMatch(feeController, /name="vendorBaseAmount"/);
  assert.match(controller, /car\.studioName\|\|car\.organizerName\|\|car\.organizer/);
  assert.match(
    feeController,
    /!loaded\.plan&&isManager&&fixedCount&&defaultPlayerFee&&vendorName/
  );
  assert.doesNotMatch(feeController, /id="feePlanForm"/);
  assert.doesNotMatch(feeController, /建立劇本費<\/button>/);
});

test("車團摘要左側可快速定位，右側保留欄位編輯", () => {
  assert.match(summaryRender, /navigationTarget/);
  assert.match(summaryRender, /seatSection/);
  assert.match(summaryRender, /activityFeeSection/);
  assert.doesNotMatch(
    summaryRender,
    /field:\s*"studioName",\s*editable:\s*true,\s*navigationTarget:/
  );
  assert.match(render, /id="activityFeeMount"/);
  assert.match(render, /accounting-drafts/);
  assert.match(render, /id="accountingPendingBody" hidden/);
  assert.match(render, /accounting-pending-entry/);
  assert.match(actions, /pendingBody\.hidden/);
  assert.match(render, /data-draft-dismiss/);
  assert.match(controller, /loadPendingDrafts/);
  assert.match(controller, /transitionDraft/);
  assert.match(
    feeController,
    /mountPoint=section\.querySelector\("#activityFeeMount"\)\|\|section/
  );
  assert.match(render, /hasAccountingData/);
  assert.match(render, /id="accountingDetailsToggle"/);
  assert.match(render, /id="accountingDetails"/);
  assert.match(render, /id="accountingAttention"/);
  assert.match(actions, /attention\.addEventListener/);
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
  const html = renderAccounting([
    {
      transactionId: "t1",
      title: "晚餐",
      amount: 300,
      paidBy: "p1",
      splitStatus: "pending",
      splits: []
    }
  ]);

  assert.match(html, /data-settlement-dialog="payable"/);
  assert.doesNotMatch(html, /id="accountingDetailsToggle"[^>]* hidden/);
  assert.match(html, /id="accountingDetails" hidden/);
  assert.match(html, /⚠️ 待處理 1 筆/);
});
