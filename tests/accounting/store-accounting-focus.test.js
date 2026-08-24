const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"../..",file),"utf8");

test("Store Accounting first layer only renders the four formal rows",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js");
  for(const row of ["劇本費","額外費用","玩家待付款","店家總收款"])assert.match(controller,new RegExp(`row\\([^\\n]+\\"${row}\\"`));
  for(const removed of [">費用項目<",">玩家繳費<",">付款紀錄<",">調整紀錄<",">店家總應收<",">已支付<",">還要付<"])assert.doesNotMatch(controller,new RegExp(removed));
  assert.match(controller,/accounting-store-focus/);assert.match(controller,/storeFocusProjection/);
});

test("Store payment history arrow is conditional on actual child events",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js");
  assert.match(controller,/hasDetails\?`<button[^`]+data-payment-history/);
  assert.match(controller,/event\.action!=="vendor_payment_recorded"/);
  assert.match(controller,/before&&event\.before\.paymentId===paymentId/);
});

test("unsupported payment methods are not faked in the Store UI",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js"),repository=read("js/modules/accounting/activity-fee-repository.js");
  for(const label of ["店家儲值金","現場支付","主揪代收"])assert.doesNotMatch(controller,new RegExp(label));
  assert.doesNotMatch(repository,/paymentMethod/);assert.doesNotMatch(repository,/host_collection_confirmation/);
  assert.match(controller,/活動支出抵扣尚無可安全共用的 Store Projection/);
});
