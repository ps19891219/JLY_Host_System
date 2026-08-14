"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createTransaction } = require("../../services/accounting/transaction");
const { buildEqualSplits, validateSplitTotal } = require("../../services/accounting/split");
const { claimPayment, confirmPayment, rejectPaymentClaim, withdrawPaymentClaim, getTransactionSettlementStatus } = require("../../services/accounting/settlement");
const { buildPendingActions } = require("../../services/accounting/pending-action");

test("quick transaction separates creator and payer and defaults to pending split", () => {
  const transaction = createTransaction({ transactionId:"tx-1", activityId:"car-99", createdBy:"member-shijie", paidBy:"member-xiaowen", title:"晚餐", amount:1680 });
  assert.equal(transaction.activityType, "car"); assert.equal(transaction.villageType, "script_village");
  assert.equal(transaction.createdBy, "member-shijie"); assert.equal(transaction.paidBy, "member-xiaowen");
  assert.equal(transaction.splitStatus, "pending");
});

test("equal split assigns indivisible remainder deterministically to the last member", () => {
  const splits = buildEqualSplits([{personId:"a"},{personId:"b"},{personId:"c"}], 100);
  assert.deepEqual(splits.map(item=>item.amount), [33,33,34]);
  assert.equal(validateSplitTotal(splits,100).valid,true);
});

test("custom split must equal transaction amount", () => {
  assert.equal(validateSplitTotal([{personId:"a",amount:300},{personId:"b",amount:380}],690).valid,false);
  assert.throws(()=>createTransaction({transactionId:"tx",activityId:"car",createdBy:"a",paidBy:"a",title:"餐費",amount:690,splitStatus:"completed",splits:[{personId:"a",amount:300},{personId:"b",amount:380}]}),/split_total_mismatch/);
});

test("payer claims payment but only receiver can confirm settlement", () => {
  const claimed = claimPayment({personId:"debtor",amount:300},"debtor","2026-08-13T01:00:00.000Z");
  assert.equal(claimed.settlementStatus,"payment_claimed");
  assert.throws(()=>confirmPayment(claimed,"debtor","receiver"),/receiver_required/);
  const settled = confirmPayment(claimed,"receiver","receiver","2026-08-13T02:00:00.000Z");
  assert.equal(settled.settlementStatus,"settled");
});

test("payment claim can be withdrawn or rejected before confirmation", () => {
  const claimed = claimPayment({personId:"debtor",amount:300},"debtor");
  assert.equal(withdrawPaymentClaim(claimed,"debtor").settlementStatus,"payment_due");
  assert.equal(rejectPaymentClaim(claimed,"receiver","receiver").settlementStatus,"settlement_rejected");
});

test("pending actions assign the next responsible person", () => {
  const pending = createTransaction({transactionId:"tx-1",activityId:"car-1",createdBy:"creator",paidBy:"receiver",title:"晚餐",amount:600});
  assert.equal(buildPendingActions(pending,"manager")[0].responsiblePersonId,"manager");
  const complete = createTransaction({transactionId:"tx-2",activityId:"car-1",createdBy:"creator",paidBy:"receiver",title:"停車",amount:300,splitStatus:"completed",splits:[{personId:"receiver",amount:100,settlementStatus:"settled"},{personId:"debtor",amount:200}]});
  const due = buildPendingActions(complete,"manager");
  assert.equal(due.length,1); assert.equal(due[0].actionType,"payment_due"); assert.equal(due[0].responsiblePersonId,"debtor");
  assert.equal(getTransactionSettlementStatus(complete.splits),"pending");
});

test("payer own share is already settled and does not create a payment action", () => {
  const transaction = createTransaction({transactionId:"tx-3",activityId:"car-1",createdBy:"creator",paidBy:"payer",title:"晚餐",amount:600,splitStatus:"completed",splits:[{personId:"payer",amount:300},{personId:"friend",amount:300}]});
  assert.equal(transaction.splits[0].settlementStatus,"settled");
  const actions = buildPendingActions(transaction,"manager");
  assert.equal(actions.length,1);
  assert.equal(actions[0].responsiblePersonId,"friend");
});
