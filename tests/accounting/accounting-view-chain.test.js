"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildActivityAccountingSummary
} = require("../../services/accounting/activity-accounting-summary");

const accountingData = require("../../js/modules/accounting/accounting-data");

function expense({ id, amount, paidBy, payments, splits, updatedAt = "2026-08-18T00:00:00.000Z" }) {
  return {
    transactionId: id,
    type: "expense",
    amount,
    paidBy,
    payerMemberId: paidBy,
    payments: payments || [{ personId: paidBy, amount }],
    splits,
    splitStatus: "completed",
    status: "active",
    createdAt: updatedAt,
    updatedAt
  };
}

test("全車誰欠誰依總實付與總應負重新配對", () => {
  const summary = buildActivityAccountingSummary([
    expense({
      id: "t1",
      amount: 1000,
      paidBy: "A",
      splits: [
        { personId: "A", amount: 400 },
        { personId: "B", amount: 300 },
        { personId: "C", amount: 300 }
      ]
    }),
    expense({
      id: "t2",
      amount: 200,
      paidBy: "B",
      splits: [
        { personId: "B", amount: 200 }
      ]
    })
  ], []);

  const members = new Map(summary.memberSummaries.map(item => [item.personId, item]));
  assert.equal(members.get("A").netAmount, 600);
  assert.equal(members.get("B").netAmount, -300);
  assert.equal(members.get("C").netAmount, -300);

  assert.deepEqual(summary.settlementTransfers, [
    { fromPersonId: "B", toPersonId: "A", amount: 300 },
    { fromPersonId: "C", toPersonId: "A", amount: 300 }
  ]);
});

test("多人付款仍依正式 payments personId 累計", () => {
  const summary = buildActivityAccountingSummary([
    expense({
      id: "multi",
      amount: 600,
      paidBy: "A",
      payments: [
        { personId: "A", amount: 400 },
        { personId: "B", amount: 200 }
      ],
      splits: [
        { personId: "A", amount: 200 },
        { personId: "B", amount: 200 },
        { personId: "C", amount: 200 }
      ]
    })
  ], []);

  const members = new Map(summary.memberSummaries.map(item => [item.personId, item]));
  assert.equal(members.get("A").paidAmount, 400);
  assert.equal(members.get("B").paidAmount, 200);
  assert.equal(members.get("C").shareAmount, 200);
  assert.deepEqual(summary.settlementTransfers, [
    { fromPersonId: "C", toPersonId: "A", amount: 200 }
  ]);
});

test("確認核銷只降低目前待結清，不改寫歷史實付與負擔", () => {
  const summary = buildActivityAccountingSummary([
    expense({
      id: "t1",
      amount: 1000,
      paidBy: "A",
      splits: [
        { personId: "A", amount: 400 },
        { personId: "B", amount: 300 },
        { personId: "C", amount: 300 }
      ]
    })
  ], [
    {
      settlementId: "s1",
      fromPersonId: "B",
      toPersonId: "A",
      amount: 100,
      status: "settled"
    }
  ]);

  const members = new Map(summary.memberSummaries.map(item => [item.personId, item]));
  assert.equal(members.get("A").paidAmount, 1000);
  assert.equal(members.get("B").shareAmount, 300);
  assert.equal(members.get("A").currentNetAmount, 500);
  assert.equal(members.get("B").currentNetAmount, -200);
  assert.equal(summary.outstandingAmount, 500);
});

test("Pairwise degraded path 不得把 A→B、B→C 改成 A→C", () => {
  const result = accountingData.netSettlementFromObligations([
    { fromPersonId: "A", toPersonId: "B", amount: 100 },
    { fromPersonId: "B", toPersonId: "C", amount: 100 }
  ]);
  assert.deepEqual(result.transfers, [
    { fromPersonId: "A", toPersonId: "B", amount: 100 },
    { fromPersonId: "B", toPersonId: "C", amount: 100 }
  ]);
  assert.equal(result.transfers.some(item => item.fromPersonId === "A" && item.toPersonId === "C"), false);
});

test("Pairwise 仍允許同一對 Person 雙向抵銷", () => {
  const result = accountingData.netSettlementFromObligations([
    { fromPersonId: "A", toPersonId: "B", amount: 100 },
    { fromPersonId: "B", toPersonId: "A", amount: 40 }
  ]);
  assert.deepEqual(result.transfers, [
    { fromPersonId: "A", toPersonId: "B", amount: 60 }
  ]);
});

test("Car Detail controller 不再從 pairwise obligations 重算誰欠誰", () => {
  const controller = fs.readFileSync(
    path.join(__dirname, "../../js/modules/accounting/accounting-controller.js"),
    "utf8"
  );
  const repository = fs.readFileSync(
    path.join(__dirname, "../../js/modules/accounting/accounting-repository.js"),
    "utf8"
  );

  assert.equal(controller.includes("netSettlementFromObligations(dashboard.obligationsByPair)"), false);
  assert.equal(controller.includes("dashboard.settlementTransfers"), true);
  assert.equal(controller.includes("netSettlementFromBalances(dashboard.balanceByPerson"), false);
  assert.equal(controller.includes("accounting_pairwise_view_unavailable"), true);
  assert.equal(repository.includes("VIEW_SCHEMA_VERSION = 8"), true);
  assert.equal(repository.includes("summarySourceVersion"), true);
  assert.equal(repository.includes(": buildSettlementPlan(currentBalance)"), false);
  assert.equal(repository.includes("accounting_pairwise_engine_unavailable"), true);
});

test("Car Detail 明細直接讀 canonical accountingEntries，不以 activityCurrent recentTransactions 當正式歷史", () => {
  const repository = fs.readFileSync(
    path.join(__dirname, "../../js/modules/accounting/accounting-repository.js"),
    "utf8"
  );

  assert.equal(repository.includes('.collection("accountingEntries")'), true);
  assert.equal(repository.includes('transactions: view.recentTransactions || []'), false);
  assert.equal(repository.includes('recentEntries.docs'), true);
});

test("玩家車團帳務 API 不再混用 legacy getCarAccountingView", () => {
  const contextApi = fs.readFileSync(
    path.join(__dirname, "../../api/group-assistant-context.js"),
    "utf8"
  );

  assert.equal(contextApi.includes("getCarAccountingView"), false);
  assert.equal(contextApi.includes('root.collection("accountingEntries").get()'), true);
  assert.equal(contextApi.includes("recentEntries"), true);
  assert.equal(contextApi.includes("activeEntryCount"), true);
});

