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

test("人物明細直接列出 canonical Person 並在原列展開玩家帳務",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js");
  for(const label of ["accounting-person-list","accounting-person-card","accounting-person-toggle","總支出","已支付","playerPosition","playerNetAmount"])assert.match(controller,new RegExp(label));
  assert.match(controller,/model\.viewModel\.people/);
  assert.match(controller,/member\.identityIds/);
  assert.match(controller,/person\.playerSources/);
  assert.match(controller,/onPersonPayment/);
  assert.match(controller,/canActForPerson=person\.personId===model\.currentPersonId\|\|model\.isManager&&member&&!member\.usesSystem/);
  assert.match(controller,/data-action="\$\{person\.personId===model\.currentPersonId\?"claim":"manager_claim"\}"/);
  assert.match(controller,/value="\$\{paymentAmount\}"/);
  assert.doesNotMatch(controller,/person\.storeSources/);
  assert.doesNotMatch(controller,/data-accounting-person-selector/);
  assert.doesNotMatch(controller,/relationshipRows/);
  assert.doesNotMatch(controller,/accounting-person-source[^`]*(input|contenteditable)/);
});

test("我的帳務摘要與明細共用逐 Person 互抵 Projection",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js"),data=require("../../js/modules/accounting/accounting-data");
  assert.match(controller,/personalAccountingProjection/);assert.match(controller,/accounting-my-net-list/);assert.match(controller,/同一對人物互抵後/);
  const result=data.personalAccountingProjection([{fromPersonId:"me",toPersonId:"a",amount:50},{fromPersonId:"a",toPersonId:"me",amount:100},{fromPersonId:"me",toPersonId:"b",amount:300},{fromPersonId:"b",toPersonId:"me",amount:100}],"me");
  assert.deepEqual(result.people.map(item=>[item.personId,item.direction,item.amount]),[["a","receivable",50],["b","payable",200]]);assert.equal(result.net, -150);
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
