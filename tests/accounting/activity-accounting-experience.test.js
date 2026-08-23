"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"../..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const navigation=require(path.join(root,"js/modules/accounting/accounting-navigation.js"));

test("Activity Accounting 使用五個不重載頁面的正式分頁",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js");
  for(const id of ["overview","transactions","people","studio","history"])assert.match(controller,new RegExp(`\\["${id}"`));
  assert.match(controller,/accounting-experience-tabs/);
  assert.match(controller,/panel\.hidden=key!==id/);
  assert.match(read("css/pages/accounting.css"),/accounting-experience-tabs button\{[^}]*width:auto!important/);
  assert.doesNotMatch(controller,/location\.reload/);
});

test("五個分頁 Navigation State 保留所有入口而非只保留 active 名稱",()=>{
  const state=navigation.selectView(navigation.initial("me"),"history","me");
  assert.equal(state.view,"history");
  assert.deepEqual(["overview","transactions","people","studio","history"].map(view=>navigation.selectView(state,view,"me").view),["overview","transactions","people","studio","history"]);
});

test("總覽保留精簡 My Accounting 並導航目前 Person",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js");
  for(const label of ["我的帳務","待付","待收","查看我的明細"])assert.match(controller,new RegExp(label));
  assert.doesNotMatch(controller,/我要支付|我要收回|處理後還要支付|處理後還待收回/);
  assert.match(controller,/selectPerson\(accountingNavigationState,model\.currentPersonId,"ledger"/);
});

test("待處理是精準 Action Index 且保留正式 source id",()=>{
  const render=read("js/modules/accounting/accounting-render.js");
  assert.match(render,/data-accounting-pending-action/);
  assert.match(render,/data-source-id/);
  assert.match(render,/去處理/);
  assert.match(render,/去確認/);
  assert.match(render,/去分帳/);
});

test("待分帳定位逐筆明細與指定 Transaction",()=>{
  const state=navigation.targetForPending({actionType:"pending_split",transactionId:"tx-1"},"me");
  assert.deepEqual([state.view,state.transactionId,state.sourceType,state.sourceId],["transactions","tx-1","transaction","tx-1"]);
});

test("待付款定位正確人物與待付子分頁",()=>{
  const state=navigation.targetForPending({actionType:"payment_due",responsiblePersonId:"debtor",obligationId:"ob-1"},"me");
  assert.deepEqual([state.view,state.personId,state.subview,state.sourceType,state.sourceId],["people","debtor","payable","obligation","ob-1"]);
});

test("待確認定位收款人物與指定 Settlement",()=>{
  const state=navigation.targetForPending({actionType:"payment_confirmation",receiverPersonId:"receiver",settlementId:"st-1"},"me");
  assert.deepEqual([state.view,state.personId,state.subview,state.settlementId,state.sourceId],["people","receiver","processing","st-1","st-1"]);
});

test("Studio 待付款定位工作室付款 View",()=>{
  const state=navigation.targetForPending({actionType:"studio_payment_due",sourceId:"studio-1"},"me");
  assert.deepEqual([state.view,state.subview,state.sourceType,state.sourceId],["studio","payment","studio_payment","studio-1"]);
});

test("Delegated Pending 定位指定人物、處理中與 request",()=>{
  const state=navigation.targetForPending({actionType:"delegated_payment_acceptance",responsiblePersonId:"delegate",requestId:"req-1"},"me");
  assert.deepEqual([state.view,state.personId,state.subview,state.requestId,state.sourceId],["people","delegate","processing","req-1","req-1"]);
});

test("返回總覽會清除舊 target 且保持 current Person",()=>{
  const targeted=navigation.targetForPending({actionType:"payment_due",responsiblePersonId:"debtor",obligationId:"ob-1"},"me");
  const overview=navigation.selectView(targeted,"overview","me");
  assert.equal(overview.view,"overview");assert.equal(overview.personId,"debtor");assert.equal(overview.sourceId,"");assert.equal(overview.sourceType,"");
});

test("LINE 查看帳務讀 canonical Core 並只輸出目前 Person 範圍",()=>{
  const api=read("api/group-assistant-context.js"),action=read("api/group-assistant-accounting-action.js"),client=read("js/group-assistant.js");
  assert.match(api,/accountingEntries/);assert.match(api,/accountingSettlements/);assert.match(api,/accountingPendingActions/);
  assert.match(api,/relatedEntries/);assert.match(api,/relatedTransfers/);assert.match(api,/relatedHistory/);assert.match(api,/relatedPending/);
  assert.match(client,/lineAccountingExperience/);assert.match(client,/逐筆帳目/);assert.match(client,/人物明細/);assert.match(client,/來源保留於正式逐筆帳目/);assert.match(api,/buildActivityAccountingViewModel/);
  assert.match(action,/actorPersonId!==from/);assert.match(action,/toPersonId\|\|before\.receiverPersonId/);assert.match(action,/accountingSettlements/);assert.match(action,/accountingPendingActions/);
  assert.match(client,/group-assistant-accounting-action/);
});

test("Studio V1 支付、修正、取消與退款維持獨立歷史",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js"),repository=read("js/modules/accounting/activity-fee-repository.js"),data=read("js/modules/accounting/activity-fee-data.js");
  assert.match(controller,/accounting-studio-minimal/);assert.match(controller,/店家總應收/);assert.match(controller,/已支付/);assert.match(controller,/還要付/);assert.match(controller,/＋ 新增付款/);assert.match(controller,/付款紀錄/);
  assert.match(controller,/settlementStatus:"settled"/);assert.match(controller,/manager_confirmed_payment_v1/);
  assert.match(repository,/vendor_payment_corrected/);assert.match(repository,/before,after/);assert.match(repository,/vendor_payment_cancelled/);
  assert.match(data,/status!=="cancelled"/);assert.match(controller,/kind==="refund"/);
});

test("本輪 UI 不建立 LINE 或 Person Ledger 副本",()=>{
  const changed=["api/group-assistant-context.js","js/group-assistant.js","js/modules/accounting/accounting-controller.js"].map(read).join("\n");
  assert.doesNotMatch(changed,/lineLedger|personLedger|accountingLedgerCopy/);
});
