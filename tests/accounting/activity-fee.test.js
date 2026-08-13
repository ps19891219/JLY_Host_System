const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/activity-fee-data.js"),"utf8");
const context={window:{},Date};vm.runInNewContext(source,context);const fee=context.window.JLYActivityFeeData;

test("script fee plan keeps player receivables separate from external vendor payable",()=>{
  const plan=fee.buildPlan({carId:"car-1",vendorName:"劇本工作室",vendorTotal:4500,playerFee:800,memberIds:["a","b","c","d","e","f"]},"host","2026-08-14T01:00:00.000Z");
  assert.equal(plan.memberCharges.length,6);assert.equal(plan.vendorTotal,4500);assert.equal(plan.vendor.linkedStoreId,"");assert.equal(plan.feeType,"script_fee");
});

test("script fee summary tracks collections deposits balance payments refunds and custody",()=>{
  const plan=fee.buildPlan({carId:"car-1",vendorName:"劇本工作室",vendorTotal:4500,playerFee:800,memberIds:["a","b"]},"host","2026-08-14T01:00:00.000Z");
  const result=fee.summarize(plan,[{personId:"a",kind:"payment",amount:800},{personId:"b",kind:"payment",amount:800},{personId:"b",kind:"refund",amount:100}],[{kind:"deposit",amount:1500},{kind:"balance",amount:2000},{kind:"refund",amount:200}]);
  assert.equal(result.memberCollected,1500);assert.equal(result.memberOutstanding,100);assert.equal(result.vendorPaid,3300);assert.equal(result.vendorOutstanding,1200);assert.equal(result.custodyBalance,-1800);
});
