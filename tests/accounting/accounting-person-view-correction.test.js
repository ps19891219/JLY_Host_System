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
  for(const label of ["accounting-person-list","accounting-person-card","accounting-person-toggle","總支出","淨支付","playerPosition","playerNetAmount","playerNetPaidAmount","playerReceivedAmount"])assert.match(controller,new RegExp(label));
  assert.match(controller,/model\.viewModel\.people/);
  assert.match(controller,/member\.identityIds/);
  assert.match(controller,/person\.playerSources/);
  assert.match(controller,/onPersonPayment/);
  assert.match(controller,/hasAction=netAmount>0&&\(person\.playerPosition==="payable"\|\|person\.playerPosition==="receivable"\)/);
  assert.match(controller,/actionLabel=isReceipt\?"確認收款":"付款"/);
  assert.match(controller,/value="\$\{netAmount\}"/);
  assert.match(controller,/transfers:form\.dataset\.direction==="receivable"\?person\.receivable:person\.payable/);
  assert.doesNotMatch(controller,/person\.storeSources/);
  assert.doesNotMatch(controller,/data-accounting-person-selector/);
  assert.doesNotMatch(controller,/relationshipRows/);
  assert.doesNotMatch(controller,/accounting-person-source[^`]*(input|contenteditable)/);
});

test("人物明細淨支付可原地展開實際支付與已收回",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js"),repository=read("js/modules/accounting/accounting-repository.js");
  assert.match(controller,/accounting-person-net-paid-toggle/);
  assert.match(controller,/accounting-person-net-paid-detail/);
  assert.match(controller,/實際支付/);
  assert.match(controller,/已收回/);
  assert.match(controller,/settledReceivedByPerson:dashboard\.settledReceivedByPerson/);
  assert.match(repository,/settledReceivedByPerson/);
  assert.match(repository,/receiverPersonId \|\| item\.toPersonId/);
});

test("人物付款與確認收款只依正式 Person Net Result 顯示並支援部分金額",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js"),repository=read("js/modules/accounting/accounting-repository.js");
  assert.doesNotMatch(controller,/person\.payable\.length===1/);
  assert.match(controller,/max="\$\{netAmount\}"/);
  assert.match(controller,/確認收到/);
  assert.match(controller,/for\(const transfer of input\.transfers\|\|\[\]\)/);
  assert.match(repository,/receiverSettle = input\.action === "receiver_settle"/);
  assert.match(repository,/status: receiverSettle \? "settled" : "payment_claimed"/);
});

test("確認收款分離表單預期淨額與本次部分收款金額",()=>{
  const repositorySource=read("js/modules/accounting/accounting-repository.js"),controller=read("js/modules/accounting/accounting-controller.js"),context={window:{JLYAccountingData:{collectActivityMembers:()=>[]}}};
  require("node:vm").runInNewContext(repositorySource,context);
  const validate=context.window.JLYAccountingRepository.assertCurrentNetSettlementAmount;
  assert.doesNotThrow(()=>validate(480,480,480));
  assert.doesNotThrow(()=>validate(480,480,200));
  assert.throws(()=>validate(400,480,200),/net_settlement_amount_changed/);
  assert.throws(()=>validate(150,480,200),/net_settlement_amount_changed/);
  assert.match(controller,/expectedAmount:Number\(transfer\.amount\|\|0\)/);
  assert.match(controller,/originalFromPersonId\|\|canonicalFromPersonId/);
  assert.match(controller,/originalToPersonId\|\|canonicalToPersonId/);
});

test("確認收款允許 canonical actor 操作同一正式人物的 legacy receiver",()=>{
  const repositorySource=read("js/modules/accounting/accounting-repository.js"),context={window:{JLYAccountingData:{collectActivityMembers:()=>[{personId:"canonical",identityIds:["canonical","legacy"]}]}}};
  require("node:vm").runInNewContext(repositorySource,context);
  assert.equal(context.window.JLYAccountingRepository.sameActivityPerson({},"canonical","legacy"),true);
  assert.equal(context.window.JLYAccountingRepository.sameActivityPerson({},"outsider","legacy"),false);
});

test("確認收款權限沿 Activity linked identity component 正規化，不以姓名判斷",()=>{
  const repositorySource=read("js/modules/accounting/accounting-repository.js"),data=require("../../js/modules/accounting/accounting-data"),car={ownerId:"owner-person",ownerMemberId:"profile-person",players:[{playerId:"legacy-player",profileId:"profile-person",playerName:"詩婕"}]},context={window:{JLYAccountingData:data}};
  require("node:vm").runInNewContext(repositorySource,context);
  assert.equal(context.window.JLYAccountingRepository.sameActivityPerson(car,"owner-person","legacy-player"),true);
  assert.equal(context.window.JLYAccountingRepository.sameActivityPerson(car,"outsider","legacy-player"),false);
});

test("人物付款按鈕直接綁定原地 inline form，不依 legacy identity 另行 guard",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js");
  assert.match(controller,/accounting-person-pay-toggle"\)\.forEach\(button=>button\.addEventListener\("click"/);
  assert.match(controller,/button\.hidden=true;button\.nextElementSibling\.hidden=false/);
  assert.match(controller,/canonicalActivityPersonId\(members,currentMember\.personId\)/);
});

test("人物收款錯誤依正式 code 顯示不同提示",()=>{
  const source=read("js/modules/accounting/accounting-controller.js"),context={window:{},document:{addEventListener:()=>{},getElementById:()=>null},MutationObserver:function(){},console:{error:()=>{}}};
  require("node:vm").runInNewContext(source,context);
  const message=context.window.JLYAccountingController.personActionErrorMessage;
  assert.equal(message(new Error("net_settlement_not_allowed")),"目前狀態不允許確認收款。");
  assert.equal(message(new Error("net_settlement_already_claimed")),"這筆款項已經被處理。");
  assert.equal(message(Object.assign(new Error("Missing or insufficient permissions."),{code:"permission-denied"})),"目前沒有資料存取權限。");
  assert.equal(message(new Error("identity_required")),"目前無法確認登入身分。");
  assert.equal(message(new Error("unexpected_failure")),"目前無法處理，請稍後再試。");
});

test("確認收款 console trace 保留 exception 與 runtime identity values",()=>{
  const calls=[],source=read("js/modules/accounting/accounting-controller.js"),context={window:{},document:{addEventListener:()=>{},getElementById:()=>null},MutationObserver:function(){},console:{error:(...args)=>calls.push(args)}};
  require("node:vm").runInNewContext(source,context);
  const runtime={actorPersonId:"actor",toPersonId:"legacy-recipient",canonicalToPersonId:"canonical-recipient",transferId:"pair-480",transferStatus:"payment_due",originalToPersonId:"legacy-recipient",currentPersonId:"actor",activityId:"car-1"},error=Object.assign(new Error("net_settlement_not_allowed"),{code:"net_settlement_not_allowed"}),detail=context.window.JLYAccountingController.logPersonActionError(error,runtime);
  assert.equal(calls.length,1);assert.equal(calls[0][0],"Person accounting action failed.");
  assert.deepEqual(JSON.parse(JSON.stringify(detail)),{errorCode:"net_settlement_not_allowed",errorMessage:"net_settlement_not_allowed",errorStack:error.stack,actorPersonId:"actor",toPersonId:"legacy-recipient",canonicalToPersonId:"canonical-recipient",transfer:{id:"pair-480",status:"payment_due",originalToPersonId:"legacy-recipient"},transferId:"pair-480",transferStatus:"payment_due",originalToPersonId:"legacy-recipient",currentPersonId:"actor",activityId:"car-1"});
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
