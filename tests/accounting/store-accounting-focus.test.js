const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"../..",file),"utf8");

test("Store Accounting first layer only renders the four formal rows",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js");
  for(const row of ["劇本費","額外費用","玩家付款","店家總收款"])assert.match(controller,new RegExp(`row\\([^\\n]+\\"${row}\\"`));
  for(const removed of [">費用項目<",">玩家繳費<",">付款紀錄<",">調整紀錄<",">店家總應收<",">已支付<",">還要付<"])assert.doesNotMatch(controller,new RegExp(removed));
  assert.match(controller,/accounting-store-focus/);assert.match(controller,/storeFocusProjection/);
});

test("Store payment history arrow is conditional on actual child events",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js");
  assert.match(controller,/hasDetails\?`<button[^`]+data-payment-history/);
  assert.match(controller,/event\.action!=="vendor_payment_recorded"/);
  assert.match(controller,/before&&event\.before\.paymentId===paymentId/);
});

test("Store player payment uses three human-facing methods without a second schema",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js"),repository=read("js/modules/accounting/activity-fee-repository.js");
  for(const label of ["店家儲值金","現場支付","主揪代收"])assert.match(controller,new RegExp(label));
  assert.match(controller,/host_collection_pending/);assert.match(controller,/payment_claimed/);assert.match(controller,/settleVendorPayment/);
  assert.doesNotMatch(repository,/paymentMethod/);
  assert.doesNotMatch(controller,/Store Projection/);
});

test("extra fees use a three-level view and do not expose people in level two",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js");
  assert.match(controller,/data-fee-item-toggle/);
  assert.match(controller,/accounting-extra-fee-detail/);
  assert.match(controller,/分帳明細/);
  assert.match(controller,/data-fee-item-edit/);
});

test("extra fee amount uses an audited inline editor and keeps split editing separate",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js"),css=read("css/pages/accounting.css");
  assert.match(controller,/data-fee-amount-edit/);assert.match(controller,/data-fee-amount-save/);assert.match(controller,/data-fee-amount-cancel/);assert.match(controller,/inputmode="numeric"/);
  assert.match(controller,/repository\.savePlan/);assert.match(controller,/data\.updateFeeItem/);assert.match(controller,/restoreFeeItemView/);assert.match(controller,/window\.scrollTo/);
  assert.doesNotMatch(controller,/>修改金額<\/button>/);assert.match(controller,/>管理分帳 〉<\/button>/);
  assert.match(css,/\.accounting-inline-amount-editor/);
});

test("each Split amount uses inline draft validation before one audited save",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js"),css=read("css/pages/accounting.css");
  for(const marker of ["data-fee-split-inline","data-fee-split-edit","data-fee-split-save","data-fee-split-cancel","data-fee-split-summary"])assert.match(controller,new RegExp(marker));
  assert.match(controller,/state\.delta!==0/);assert.match(controller,/allocationType:"custom"/);assert.match(controller,/分帳合計/);assert.match(controller,/費用總額/);assert.match(controller,/尚差 -/);assert.match(controller,/管理分帳/);
  assert.match(css,/accounting-split-total/);assert.match(css,/accounting-inline-split/);
});

test("Store player payment view keeps payable and receivable positions but omits settled people",()=>{
  const data=read("js/modules/accounting/activity-fee-data.js"),controller=read("js/modules/accounting/activity-fee-controller.js");
  assert.match(data,/storeOutstandingAmount=Math\.max\(0,summary\.vendorTotal-storeReceivedAmount\)/);
  assert.match(data,/personPayableAmount:playerPayments\.pendingAmount/);
  assert.match(controller,/activePeople=focus\.playerPayments\.members\.filter\(item=>item\.state!=="settled"\)/);
  assert.match(controller,/isPayable\?"應付":"應收"/);
  assert.match(controller,/canPay=isPayable/);
  assert.match(controller,/目前沒有未結清的玩家店家帳務/);
});

test("Store split manager stays inside the selected fee card",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js"),css=read("css/pages/accounting.css");
  assert.match(controller,/detail\.appendChild\(feeItemForm\)/);assert.match(controller,/accounting-inline-split-manager/);assert.match(controller,/restoreFeeItemFormHost/);assert.match(css,/accounting-inline-split-manager/);
});

test("Store player rows keep canonical net positions while completed cashflow also stays in Store received",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js");
  assert.match(controller,/activePeople\.map/);
  assert.match(controller,/data-store-person-toggle/);
  for(const label of ["店家費用責任","總負擔","實際淨支付","目前結果"])assert.match(controller,new RegExp(label));
  assert.match(controller,/receivedGroups=new Map/);assert.match(controller,/data-store-received-person-toggle/);
});

test("Store received stays collapsed and payment arrows require actual child history",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js");
  assert.match(controller,/row\("storeReceivedDetails","店家總收款",focus\.storeReceived\.amount\)/);
  assert.match(controller,/id="storeReceivedDetails"[^>]+hidden/);
  assert.match(controller,/hasDetails\?`<button[^`]+data-payment-history/);
  assert.match(controller,/paidBy/);
  assert.doesNotMatch(controller,/data-vendor-menu=/);
  assert.match(controller,/data-vendor-payment-inline/);
});

test("Store player payment is inline and preserves the current Store view",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js"),css=read("css/pages/accounting.css");
  for(const marker of ["data-store-payment-form","data-store-payment-cancel","data-store-payment-status","restoreStoreView"])assert.match(controller,new RegExp(marker));
  assert.match(controller,/value="\$\{item\.displayAmount\}"/);assert.match(controller,/repository\.recordVendorPayment/);
  assert.match(css,/accounting-store-inline-payment/);
});

test("Store payment choices stay compact and received details cannot overflow mobile cards",()=>{
  const css=read("css/pages/accounting.css"),controller=read("js/modules/accounting/activity-fee-controller.js");
  assert.match(css,/accounting-store-inline-payment fieldset\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/white-space:nowrap/);
  assert.match(css,/accounting-store-received-person,\.accounting-store-received-person>\*\{min-width:0\}/);
  assert.match(css,/accounting-store-received-person \.accounting-fee-members>li\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(controller,/receivedGroups=new Map/);
  assert.match(controller,/data-store-received-person-toggle/);
});

test("Store receivable recovery is not faked through a payment or expense record",()=>{
  const controller=read("js/modules/accounting/activity-fee-controller.js"),repository=read("js/modules/accounting/activity-fee-repository.js");
  assert.doesNotMatch(controller,/data-store-receivable-recovery/);
  assert.doesNotMatch(repository,/recoveryAllocation|storeReceivableRecovery/);
});
