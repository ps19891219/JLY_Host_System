"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"../..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Activity Accounting 使用五個不重載頁面的正式分頁",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js");
  for(const id of ["overview","transactions","people","studio","history"])assert.match(controller,new RegExp(`\\["${id}"`));
  assert.match(controller,/accounting-experience-tabs/);
  assert.match(controller,/panel\.hidden=key!==id/);
  assert.doesNotMatch(controller,/location\.reload/);
});

test("待處理是精準 Action Index 且保留正式 source id",()=>{
  const render=read("js/modules/accounting/accounting-render.js");
  assert.match(render,/data-accounting-target-tab/);
  assert.match(render,/item\.transactionId/);
  assert.match(render,/去處理/);
  assert.match(render,/去確認/);
  assert.match(render,/去分帳/);
});

test("LINE 查看帳務讀 canonical Core 並只輸出目前 Person 範圍",()=>{
  const api=read("api/group-assistant-context.js"),action=read("api/group-assistant-accounting-action.js"),client=read("js/group-assistant.js");
  assert.match(api,/accountingEntries/);assert.match(api,/accountingSettlements/);assert.match(api,/accountingPendingActions/);
  assert.match(api,/relatedEntries/);assert.match(api,/relatedTransfers/);assert.match(api,/relatedHistory/);assert.match(api,/relatedPending/);
  assert.match(client,/lineAccountingExperience/);assert.match(client,/逐筆明細/);assert.match(client,/人物帳務/);assert.match(client,/來源保留於正式逐筆帳目/);
  assert.match(action,/actorPersonId!==from/);assert.match(action,/toPersonId\|\|before\.receiverPersonId/);assert.match(action,/accountingSettlements/);assert.match(action,/accountingPendingActions/);
  assert.match(client,/group-assistant-accounting-action/);
});

test("Studio V1 支付、修正、取消與退款維持獨立歷史",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js"),repository=read("js/modules/accounting/activity-fee-repository.js"),data=read("js/modules/accounting/activity-fee-data.js");
  assert.match(controller,/settlementStatus:"settled"/);assert.match(controller,/manager_confirmed_payment_v1/);
  assert.match(repository,/vendor_payment_corrected/);assert.match(repository,/before,after/);assert.match(repository,/vendor_payment_cancelled/);
  assert.match(data,/status!=="cancelled"/);assert.match(controller,/kind==="refund"/);
});

test("本輪 UI 不建立 LINE 或 Person Ledger 副本",()=>{
  const changed=["api/group-assistant-context.js","js/group-assistant.js","js/modules/accounting/accounting-controller.js"].map(read).join("\n");
  assert.doesNotMatch(changed,/lineLedger|personLedger|accountingLedgerCopy/);
});
