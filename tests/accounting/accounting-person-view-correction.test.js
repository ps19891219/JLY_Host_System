"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"../.."),read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("總覽只保留一套我的帳務且移除四格進度 Dashboard",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js"),render=read("js/modules/accounting/accounting-render.js");
  assert.match(controller,/accounting-my-summary/);
  assert.doesNotMatch(controller,/accounting-progress-summary/);
  assert.doesNotMatch(controller,/人物付款<b>|分帳<b>|待確認<b>/);
  assert.match(render,/hasAccountingData\?dialog:/);
  assert.doesNotMatch(render,/hasAccountingData\?summary\+dialog/);
});

test("人物第一層固定為費用責任四格，付款關係位於第二層",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js");
  for(const label of ["總支出","已付","待付","待收","帳目","處理中"])assert.match(controller,new RegExp(label));
  assert.match(controller,/personView\.receivableAmount/);
  assert.match(controller,/relationshipRows/);
  assert.match(controller,/dataPaymentState|dataset\.paymentState/);
  assert.doesNotMatch(controller,/personHeading\.innerHTML=`[^`]*(我欠誰|誰欠我|互抵後)/);
});

test("待付待收處理中按正式 Settlement 狀態互斥分流",()=>{
  const render=read("js/modules/accounting/accounting-render.js");
  assert.match(render,/paymentState=claim\?"processing":payable\?"payable":receivable\?"receivable":"processing"/);
});

test("LINE 人物 View 共用 Projection 並同步四格摘要",()=>{
  const client=read("js/group-assistant.js"),api=read("api/group-assistant-context.js");
  assert.match(api,/buildActivityAccountingViewModel/);
  assert.match(client,/personView\.totalExpense/);
  assert.match(client,/personView\.paidAmount/);
  assert.match(client,/personView\.pendingAmount/);
  assert.match(client,/personView\.receivableAmount/);
});
