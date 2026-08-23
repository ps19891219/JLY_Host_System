"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"../..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("店家帳務固定於玩家四分頁上方",()=>{
  const controller=read("js/modules/accounting/accounting-controller.js");
  assert.match(controller,/accounting-store-fixed/);
  assert.match(controller,/\[\["overview","總覽"\],\["transactions","逐筆帳目"\],\["people","人物明細"\],\["history","歷史紀錄"\]\]/);
  assert.doesNotMatch(controller,/\["studio","店家帳務"\]/);
});

test("店家操作使用正式人類語言且不顯示大型新增付款",()=>{
  const source=read("js/modules/accounting/activity-fee-controller.js");
  for(const label of ["新增額外費用","支付店家","登記玩家繳費","記錄店家退款"])assert.match(source,new RegExp(`>${label}<`));
  assert.doesNotMatch(source,/accounting-studio-add-payment/);
  assert.match(source,/actorName\(item\.actorPersonId\)/);
});

test("請人代付接受後仍為 accepted 並另建待付款",()=>{
  const repository=read("js/modules/accounting/accounting-repository.js");
  assert.match(repository,/actionType:"delegated_payment_due"/);
  assert.match(repository,/async function claimAcceptedDelegatedRequest/);
  assert.match(repository,/request\.status!=="accepted"/);
  const transitionBlock=repository.slice(repository.indexOf("async function transitionDelegatedRequest"),repository.indexOf("async function claimAcceptedDelegatedRequest"));
  assert.doesNotMatch(transitionBlock,/createClaim\(/);
  assert.doesNotMatch(transitionBlock,/status:"payment_claimed"/);
});

test("人物付款 Runtime 顯示付款 Sheet、部分金額與 accepted 後付款",()=>{
  const source=read("js/modules/accounting/accounting-render.js"),context={window:{}};
  vm.runInNewContext(source,context);
  const html=context.window.JLYAccountingRender.buildDashboardHtml({
    members:[{personId:"A",displayName:"小霙"},{personId:"B",displayName:"詩婕"}],membersById:new Map([["A",{personId:"A"}],["B",{personId:"B"}]]),memberNames:new Map([["A","小霙"],["B","詩婕"]]),
    transactions:[],currentPersonId:"A",viewPersonId:"A",isManager:false,managementMode:false,counts:{total:1,paymentConfirmation:0},
    personalSettlement:{payable:125,receivable:0,transfers:[{fromPersonId:"A",toPersonId:"B",amount:125}]},
    personalObligations:{payable:[{fromPersonId:"A",toPersonId:"B",amount:125}],receivable:[],payableTotal:125,receivableTotal:0},
    netSettlement:{transfers:[{fromPersonId:"A",toPersonId:"B",amount:125}]},activeNetSettlements:[],settlementHistory:[],detailMode:false,detailHasMore:false,getFilterState:()=>"payment_due",
    pendingActions:[{actionType:"delegated_payment_due",responsiblePersonId:"A",requestId:"req-1",receiverPersonId:"B",amount:80}],pendingDrafts:[]
  });
  assert.match(html,/data-payment-sheet-toggle>付款/);
  assert.match(html,/本次支付/);
  assert.match(html,/value="125"/);
  assert.match(html,/已接受代付/);
  assert.match(html,/data-action="pay_accepted_delegate"/);
  assert.doesNotMatch(html,/接受並申報已付款/);
});

test("LINE 帳務同步 accepted 與待付款語意",()=>{
  const client=read("js/group-assistant.js");
  assert.match(client,/delegated_payment_acceptance"\?"回覆代付請求"/);
  assert.match(client,/delegated_payment_due"\?"已接受，待實際付款"/);
  assert.doesNotMatch(client,/小助手 還款/);
});
