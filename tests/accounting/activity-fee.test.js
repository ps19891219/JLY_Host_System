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
  const projection=fee.storeFocusProjection(plan,[{personId:"a",kind:"payment",amount:1000}],[{paymentId:"deposit",kind:"payment",amount:2000,note:"訂金"}]);
  assert.deepEqual({amount:projection.scriptFee.amount,unit:projection.scriptFee.unitAmount,count:projection.scriptFee.headcount},{amount:6000,unit:1000,count:6});
  assert.equal(projection.extraFees.amount,550);assert.deepEqual(Array.from(projection.extraFees.items,item=>item.title),["指定費","包廂費"]);
  assert.equal(projection.playerPending.amount,5550);assert.equal(projection.storeReceived.amount,2000);assert.equal(projection.storeReceived.payments[0].paymentId,"deposit");
  assert.equal(projection.limitations.playerPendingIsStoreOnly,true);assert.equal(projection.limitations.hostCollectionNotStoreReceipt,true);
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
