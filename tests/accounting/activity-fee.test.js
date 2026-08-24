const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/activity-fee-data.js"),"utf8");
const context={window:{},Date};vm.runInNewContext(source,context);const fee=context.window.JLYActivityFeeData;

test("script fee plan keeps player receivables separate from external vendor payable",()=>{
  const plan=fee.buildPlan({carId:"car-1",vendorName:"劇本工作室",requiredPlayerCount:6,playerFee:800,memberIds:["a","b","c","d","e","f"]},"host","2026-08-14T01:00:00.000Z");
  assert.equal(plan.memberCharges.length,6);assert.equal(plan.vendorTotal,4800);assert.equal(plan.vendor.linkedStoreId,"");assert.equal(plan.feeType,"script_fee");
});

test("script fee summary tracks collections deposits balance payments refunds and custody",()=>{
  const plan=fee.buildPlan({carId:"car-1",vendorName:"劇本工作室",requiredPlayerCount:2,playerFee:2250,memberIds:["a","b"]},"host","2026-08-14T01:00:00.000Z");
  const result=fee.summarize(plan,[{personId:"a",kind:"payment",amount:800},{personId:"b",kind:"payment",amount:800},{personId:"b",kind:"refund",amount:100}],[{kind:"deposit",amount:1500},{kind:"balance",amount:2000},{kind:"refund",amount:200}]);
  assert.equal(result.memberCollected,1500);assert.equal(result.memberOutstanding,3000);assert.equal(result.vendorPaid,3300);assert.equal(result.vendorOutstanding,1200);assert.equal(result.custodyBalance,-1800);
});

test("store focus projection exposes exactly the four safe store figures",()=>{
  let plan=fee.buildPlan({carId:"car-focus",vendorName:"店家",requiredPlayerCount:6,playerFee:1000,playerIds:["a","b","c","d","e","f"]},"host","2026-08-24T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"指定費",amount:200,allocationType:"specific",personId:"a"},"host","2026-08-24T02:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"包廂費",amount:350,allocationType:"equal"},"host","2026-08-24T03:00:00.000Z");
  const projection=fee.storeFocusProjection(plan,[{personId:"a",kind:"payment",amount:1000}],[{paymentId:"deposit",kind:"payment",amount:2000,note:"訂金",paidBy:"a"}]);
  assert.deepEqual({amount:projection.scriptFee.amount,unit:projection.scriptFee.unitAmount,count:projection.scriptFee.headcount},{amount:6000,unit:1000,count:6});
  assert.equal(projection.extraFees.amount,550);assert.deepEqual(Array.from(projection.extraFees.items,item=>item.title),["指定費","包廂費"]);
  assert.equal(projection.playerPayments.amount,4550);assert.equal(projection.playerPayments.personPayableAmount,5292);assert.equal(projection.playerPayments.members.length,6);assert.equal(projection.storeReceived.amount,2000);assert.equal(projection.storeReceived.payments[0].paymentId,"deposit");
  assert.equal(projection.limitations.playerPendingIsStoreOnly,true);assert.equal(projection.limitations.hostCollectionNotStoreReceipt,true);
});

test("Store player positions aggregate each person responsibility payments refunds and later payments",()=>{
  let plan=fee.buildPlan({carId:"car-person-store",vendorName:"店家",requiredPlayerCount:3,playerFee:1000,playerIds:["a","b","c"]},"host","2026-08-24T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"指定費",amount:200,allocationType:"specific",personId:"a"},"host","2026-08-24T02:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"包廂費",amount:134,allocationType:"custom",allocations:[{personId:"b",amount:66},{personId:"c",amount:68}]},"host","2026-08-24T03:00:00.000Z");
  const payments=[
    {paymentId:"a-deposit",kind:"payment",amount:2000,paidBy:"a",note:"訂金"},
    {paymentId:"a-refund",kind:"refund",amount:500,paidBy:"a",note:"退款"},
    {paymentId:"a-more",kind:"payment",amount:200,paidBy:"a",note:"追加付款"},
    {paymentId:"b-part",kind:"payment",amount:600,paidBy:"b"},
    {paymentId:"c-all",kind:"payment",amount:1068,paidBy:"c"}
  ],result=fee.storePersonPositions(plan,payments),byId=new Map(result.members.map(item=>[item.personId,item]));
  assert.equal(result.members.length,3);assert.equal(byId.get("a").responsibility,1200);assert.equal(byId.get("a").netStorePaid,1700);assert.equal(byId.get("a").state,"receivable");assert.equal(byId.get("a").displayAmount,500);
  assert.equal(byId.get("b").state,"payable");assert.equal(byId.get("b").displayAmount,466);assert.equal(byId.get("c").state,"settled");assert.equal(result.pendingAmount,466);
  assert.deepEqual(Array.from(byId.get("a").feeSources,row=>row.label),["劇本費","指定費"]);assert.deepEqual(Array.from(byId.get("a").cashflowSources,row=>row.amount),[2000,-500,200]);
});

test("Store projection canonicalizes linked legacy identities and attributes every explicit payer reference",()=>{
  let plan=fee.buildPlan({carId:"car-linked",vendorName:"店家",requiredPlayerCount:1,playerFee:1000,playerIds:["legacy-shijie"]},"owner-account","2026-08-24T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"指定費",amount:200,allocationType:"specific",personId:"profile-shijie"},"owner-account","2026-08-24T02:00:00.000Z");
  const members=[
    {personId:"profile-shijie",identityIds:["profile-shijie","legacy-shijie"],roles:["player"],usesSystem:true},
    {personId:"owner-account",identityIds:["owner-account","profile-shijie"],roles:["owner"],usesSystem:true}
  ],result=fee.storePersonPositions(plan,[{paymentId:"deposit",kind:"payment",amount:2000,paidBy:"owner-account",note:"訂金"}],members);
  assert.equal(result.members.length,1);
  assert.equal(result.members[0].personId,"owner-account");
  assert.equal(result.members[0].responsibility,1200);
  assert.equal(result.members[0].netStorePaid,2000);
  assert.equal(result.members[0].state,"receivable");
  assert.equal(result.members[0].displayAmount,800);
  assert.deepEqual(Array.from(result.members[0].feeSources,row=>row.label),["劇本費","指定費"]);
  assert.deepEqual(Array.from(result.members[0].cashflowSources,row=>row.amount),[2000]);
});

test("Store payment attribution accepts explicit legacy payer fields but never creator identity",()=>{
  const plan=fee.buildPlan({carId:"car-payer",vendorName:"店家",requiredPlayerCount:1,playerFee:1000,playerIds:["legacy-person"]},"host","2026-08-24T01:00:00.000Z"),members=[{personId:"person",identityIds:["person","legacy-person","member-person"],roles:["player"]}];
  const result=fee.storePersonPositions(plan,[{kind:"payment",amount:600,payerMemberId:"member-person",createdBy:"someone-else"}],members);
  assert.equal(result.members.length,1);assert.equal(result.members[0].personId,"person");assert.equal(result.members[0].netStorePaid,600);assert.equal(result.members[0].displayAmount,400);
});

test("legacy unlinked Store payment remains received and attributes recordedBy as its historical payer",()=>{
  let plan=fee.buildPlan({carId:"car-legacy-payment",vendorName:"店家",requiredPlayerCount:1,playerFee:1000,playerIds:["legacy-shijie"]},"owner-id","2026-08-24T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"指定費",amount:200,allocationType:"specific",personId:"legacy-shijie"},"owner-id","2026-08-24T02:00:00.000Z");
  const members=[{personId:"owner-id",identityIds:["owner-id","legacy-shijie"],roles:["owner","player"]}],legacyPayment={paymentId:"old-deposit",kind:"deposit",amount:2000,recordedBy:"owner-id",settlementStatus:"payment_claimed",settlementAuthority:"manager_for_unlinked_vendor",note:"訂金"},projection=fee.storeFocusProjection(plan,[],[legacyPayment],members);
  assert.equal(projection.storeReceived.amount,2000);assert.equal(projection.storeReceived.payments.length,1);
  assert.equal(projection.playerPayments.members.length,1);assert.equal(projection.playerPayments.members[0].personId,"owner-id");assert.equal(projection.playerPayments.members[0].responsibility,1200);assert.equal(projection.playerPayments.members[0].netStorePaid,2000);assert.equal(projection.playerPayments.members[0].displayAmount,800);assert.equal(projection.playerPayments.members[0].state,"receivable");
});

test("editing only the fee amount preserves existing Split and exposes the allocation difference",()=>{
  let plan=fee.buildPlan({carId:"car-amount-only",vendorName:"店家",requiredPlayerCount:3,playerFee:1000,playerIds:["a","b","c"]},"host","2026-08-24T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"指定費",amount:200,allocationType:"custom",allocations:[{personId:"a",amount:66},{personId:"b",amount:66},{personId:"c",amount:68}]},"host","2026-08-24T02:00:00.000Z");
  const edited=fee.updateFeeAmount(plan,plan.feeItems[0].feeItemId,300,"host","2026-08-24T03:00:00.000Z");
  assert.equal(edited.feeItems[0].amount,300);assert.deepEqual(Array.from(edited.feeItems[0].allocations,row=>row.amount),[66,66,68]);assert.equal(edited.feeItems[0].allocations.reduce((sum,row)=>sum+row.amount,0),200);
});

test("Store outstanding uses receivable minus received while Person payable remains separately available",()=>{
  const plan=fee.buildPlan({carId:"car-person-store",vendorName:"店家",requiredPlayerCount:3,playerFee:1000,playerIds:["a","b","c"]},"host","2026-08-24T01:00:00.000Z"),projection=fee.storeFocusProjection(plan,[],[
    {kind:"payment",amount:1800,paidBy:"a"},{kind:"payment",amount:400,paidBy:"b"},{kind:"payment",amount:1000,paidBy:"c"}
  ]),byId=new Map(projection.playerPayments.members.map(item=>[item.personId,item]));
  assert.equal(byId.get("a").state,"receivable");assert.equal(byId.get("b").state,"payable");assert.equal(byId.get("c").state,"settled");assert.equal(projection.playerPayments.amount,0);assert.equal(projection.playerPayments.personPayableAmount,600);
});

test("fixed unjoined seats stay in Store outstanding without creating fake people",()=>{
  let plan=fee.buildPlan({carId:"car-unassigned",vendorName:"店家",requiredPlayerCount:6,playerFee:1000,playerIds:["legacy-shijie","b","c"]},"owner-account","2026-08-24T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"指定費",amount:200,allocationType:"custom",allocations:[{personId:"profile-shijie",amount:66},{personId:"c",amount:66},{personId:"b",amount:68}]},"owner-account","2026-08-24T02:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"個人指定費",amount:200,allocationType:"specific",personId:"profile-shijie"},"owner-account","2026-08-24T03:00:00.000Z");
  const members=[{personId:"profile-shijie",identityIds:["profile-shijie","legacy-shijie"],roles:["player"],usesSystem:true},{personId:"owner-account",identityIds:["owner-account","profile-shijie"],roles:["owner"],usesSystem:true},{personId:"b",identityIds:["b"],roles:["player"]},{personId:"c",identityIds:["c"],roles:["player"]}],payments=[{paymentId:"deposit",kind:"deposit",amount:2000,recordedBy:"owner-account",settlementStatus:"payment_claimed",settlementAuthority:"manager_for_unlinked_vendor"},{paymentId:"specified",kind:"payment",amount:200,paidBy:"profile-shijie",settlementStatus:"settled"}],projection=fee.storeFocusProjection(plan,[],payments,members),shijie=projection.playerPayments.members.find(item=>item.personId==="owner-account");
  assert.equal(projection.scriptFee.amount,6000);assert.equal(projection.extraFees.amount,400);assert.equal(projection.storeReceived.amount,2200);assert.equal(projection.playerPayments.amount,4200);
  assert.equal(projection.playerPayments.unassignedCount,3);assert.equal(projection.playerPayments.unassignedAmount,3000);assert.equal(projection.playerPayments.members.length,3);
  assert.equal(shijie.responsibility,1266);assert.equal(shijie.netStorePaid,2200);assert.equal(shijie.state,"receivable");assert.equal(shijie.displayAmount,934);
});

test("equal Store fee uses formal billing headcount and keeps empty-seat responsibility unassigned",()=>{
  let plan=fee.buildPlan({carId:"car-seat-fee",vendorName:"店家",requiredPlayerCount:6,playerFee:1000,playerIds:["a","b","c"]},"host","2026-08-24T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"指定費",amount:600,allocationType:"equal"},"host","2026-08-24T02:00:00.000Z");
  const projection=fee.storeFocusProjection(plan,[],[],[]),item=projection.extraFees.items[0],byId=new Map(projection.playerPayments.members.map(row=>[row.personId,row]));
  assert.deepEqual(Array.from(item.allocations,row=>row.amount),[100,100,100]);assert.equal(item.unassignedAmount,300);
  assert.equal(projection.playerPayments.unassignedCount,3);assert.equal(projection.playerPayments.unassignedAmount,3300);assert.equal(projection.playerPayments.amount,6600);
  assert.equal(byId.get("a").responsibility,1100);assert.equal(byId.get("b").responsibility,1100);assert.equal(byId.get("c").responsibility,1100);
  assert.equal(fee.summarize(plan,[],[]).memberDue,6600);
});

test("custom and single-person Store fees never invent an empty-seat share",()=>{
  let plan=fee.buildPlan({carId:"car-custom-fee",vendorName:"店家",requiredPlayerCount:6,playerFee:1000,playerIds:["a","b","c"]},"host","2026-08-24T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"自訂",amount:600,allocationType:"custom",allocations:[{personId:"a",amount:300},{personId:"b",amount:200},{personId:"c",amount:100}]},"host","2026-08-24T02:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"單人",amount:200,allocationType:"specific",personId:"a"},"host","2026-08-24T03:00:00.000Z");
  const projection=fee.storeFocusProjection(plan,[],[],[]);
  assert.deepEqual(Array.from(projection.extraFees.items,row=>row.unassignedAmount),[0,0]);assert.equal(projection.playerPayments.unassignedAmount,3000);
});

test("base fee uses fixed script capacity even before every player joins",()=>{
  const plan=fee.buildPlan({carId:"car-1",vendorName:"店家",requiredPlayerCount:6,playerFee:800,playerIds:["p1","p2"]},"host","2026-08-14T01:00:00.000Z"),summary=fee.summarize(plan,[],[]);
  assert.equal(plan.vendorBaseAmount,4800);assert.equal(summary.memberDue,4800);assert.equal(summary.unassignedCount,4);assert.equal(summary.unassignedBase,3200);
  const synced=fee.syncPlayers(plan,["p1","p2","p3"],"host","2026-08-14T02:00:00.000Z");assert.equal(synced.vendorBaseAmount,4800);assert.equal(fee.summarize(synced,[],[]).unassignedCount,3);
});

test("script data changes automatically recalculate the fixed vendor amount",()=>{
  const plan=fee.buildPlan({carId:"car-1",vendorName:"vendor",requiredPlayerCount:6,playerFee:800,playerIds:["p1","p2"]},"host","2026-08-14T01:00:00.000Z");
  const synced=fee.syncPlayers({...plan,requiredPlayerCount:7,playerFee:900},["p1","p2"],"host","2026-08-14T02:00:00.000Z");
  assert.equal(synced.vendorBaseAmount,6300);assert.equal(synced.vendorTotal,6300);assert.equal(synced.memberCharges[0].amount,900);
});

test("additional vendor fee supports equal specific host and custom allocation without fixed fields",()=>{
  let plan=fee.buildPlan({carId:"car-1",vendorName:"店家",requiredPlayerCount:2,playerFee:800,playerIds:["p1","p2"]},"host","2026-08-14T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"指定 DM 費",amount:200,allocationType:"equal"},"host","2026-08-14T02:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"服裝費",amount:300,allocationType:"specific",personId:"p1"},"host","2026-08-14T03:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"主揪招待",amount:100,allocationType:"host"},"host","2026-08-14T04:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"其他",amount:90,allocationType:"custom",allocations:[{personId:"p1",amount:40},{personId:"p2",amount:50}]},"host","2026-08-14T05:00:00.000Z");
  const summary=fee.summarize(plan,[],[]),byId=new Map(summary.members.map(item=>[item.personId,item.amount]));
  assert.equal(plan.vendorTotal,2290);assert.equal(byId.get("p1"),1240);assert.equal(byId.get("p2"),950);assert.equal(byId.get("host"),100);
});

test("custom additional fee must allocate its complete amount",()=>{
  const plan=fee.buildPlan({carId:"car-1",vendorName:"店家",requiredPlayerCount:2,playerFee:800,playerIds:["p1","p2"]},"host","2026-08-14T01:00:00.000Z");
  assert.throws(()=>fee.addFeeItem(plan,{title:"指定費",amount:200,allocationType:"custom",allocations:[{personId:"p1",amount:100}]},"host"),/fee_allocation_total_mismatch/);
});

test("editing an extra fee updates amount and split without touching payments",()=>{
  let plan=fee.buildPlan({carId:"car-edit",vendorName:"店家",requiredPlayerCount:3,playerFee:1000,playerIds:["a","b","c"]},"host","2026-08-24T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"指定費",amount:200,allocationType:"equal"},"host","2026-08-24T02:00:00.000Z");
  const payment={paymentId:"paid-1",personId:"a",kind:"payment",amount:200},id=plan.feeItems[0].feeItemId;
  const edited=fee.updateFeeItem(plan,id,{title:"指定費",amount:300,allocationType:"custom",allocations:[{personId:"a",amount:0},{personId:"b",amount:100},{personId:"c",amount:200}]},"host","2026-08-24T03:00:00.000Z");
  assert.equal(edited.feeItems[0].amount,300);
  assert.deepEqual(Array.from(edited.feeItems[0].allocations,row=>({personId:row.personId,amount:row.amount})),[{personId:"b",amount:100},{personId:"c",amount:200}]);
  assert.equal(edited.vendorTotal,3300);
  assert.deepEqual(payment,{paymentId:"paid-1",personId:"a",kind:"payment",amount:200});
});

test("fee payer remains optional and payment is not embedded in a fee item",()=>{
  let plan=fee.buildPlan({carId:"car-no-payer",vendorName:"店家",requiredPlayerCount:2,playerFee:1000,playerIds:["a","b"]},"host","2026-08-24T01:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"包廂費",amount:300,allocationType:"equal"},"host","2026-08-24T02:00:00.000Z");
  assert.equal(Object.hasOwn(plan.feeItems[0],"paidBy"),false);
  assert.equal(Object.hasOwn(plan.feeItems[0],"paidAmount"),false);
  assert.deepEqual(Array.from(plan.feeItems[0].allocations,row=>row.amount),[150,150]);
});

test("studio summary shows three fields normally and five fields only with extras",()=>{
  let plan=fee.buildPlan({carId:"car-1",vendorName:"店家",requiredPlayerCount:6,playerFee:1150,playerIds:["a","b","c","d","e","f"]},"host","2026-08-22T01:00:00.000Z");
  let summary=fee.summarize(plan,[],[]);
  assert.equal(summary.vendorBaseAmount,6900);assert.equal(summary.vendorExtraAmount,0);assert.deepEqual(Array.from(fee.studioSummaryItems(summary),item=>item.label),["劇本費用","已付款","待付款"]);
  plan=fee.addFeeItem(plan,{title:"DM 指定費",amount:500,allocationType:"equal"},"host","2026-08-22T02:00:00.000Z");
  plan=fee.addFeeItem(plan,{title:"場地費",amount:300,allocationType:"equal"},"host","2026-08-22T03:00:00.000Z");
  summary=fee.summarize(plan,[],[]);
  assert.equal(summary.vendorExtraAmount,800);assert.equal(summary.vendorTotal,7700);assert.deepEqual(Array.from(fee.studioSummaryItems(summary),item=>item.label),["劇本費用","額外費用","總額","已付款","待付款"]);
});

test("split studio payments and refunds preserve fee total and player collection independence",()=>{
  const plan=fee.buildPlan({carId:"car-1",vendorName:"店家",requiredPlayerCount:6,playerFee:1150,playerIds:["a","b","c","d","e","f"]},"host","2026-08-22T01:00:00.000Z");
  const paid=fee.summarize(plan,[{personId:"a",kind:"payment",amount:1150}],[{kind:"payment",amount:2000},{kind:"payment",amount:4900}]);
  assert.equal(paid.vendorTotal,6900);assert.equal(paid.vendorPaid,6900);assert.equal(paid.vendorOutstanding,0);assert.equal(paid.memberCollected,1150);assert.equal(paid.memberOutstanding,5750);
  const refunded=fee.summarize(plan,[{personId:"a",kind:"payment",amount:1150}],[{kind:"payment",amount:2000},{kind:"payment",amount:4900},{kind:"refund",amount:300}]);
  assert.equal(refunded.vendorTotal,6900);assert.equal(refunded.vendorPaid,6600);assert.equal(refunded.vendorOutstanding,300);assert.equal(refunded.memberCollected,1150);
});
