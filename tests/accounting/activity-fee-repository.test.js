const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../../js/modules/accounting/activity-fee-repository.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(source, context);
const repository = context.window.JLYActivityFeeRepository;

test("unlinked studio payment keeps creator and actual payer explicit without an orphan pending action", () => {
  const fields = repository.vendorPaymentFields({ kind: "payment", paidBy: "host-person" }, "host-person");
  assert.equal(fields.createdBy, "host-person");
  assert.equal(fields.paidBy, "host-person");
  assert.equal(fields.settlementStatus, "payment_claimed");
  assert.equal(fields.settlementAuthority, "manager_for_unlinked_vendor");
  assert.deepEqual(Array.from(fields.pendingActionIds), []);
});

test("manual unlinked studio reconciliation settles the same payment and preserves its history fields", () => {
  const before = { paymentId: "vendor-payment-1", amount: 1000, createdBy: "host-person", paidBy: "host-person", settlementStatus: "payment_claimed" };
  const after = repository.settledVendorPaymentFields(before, "host-person", "2026-08-22T12:00:00.000Z");
  assert.equal(after.paymentId, before.paymentId);
  assert.equal(after.amount, 1000);
  assert.equal(after.createdBy, "host-person");
  assert.equal(after.paidBy, "host-person");
  assert.equal(after.settlementStatus, "settled");
  assert.equal(after.settledBy, "host-person");
  assert.equal(after.settlementAuthority, "manager_for_unlinked_vendor");
  assert.deepEqual(Array.from(after.pendingActionIds), []);
});
