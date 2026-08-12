"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAccountingView,
  buildAdminAccountingView,
  applyEntryToMemberBalances
} = require("../../services/firebase/car-accounting-repository");

test("one accounting view summarizes all active car entries", function () {
  const view = buildAccountingView([
    {
      id: "income-1",
      type: "income",
      amount: 1000,
      description: "成員繳費",
      status: "active",
      createdAt: "2026-08-12T12:00:00.000Z"
    },
    {
      id: "expense-1",
      type: "expense",
      amount: 120,
      description: "測試費用",
      status: "active",
      createdAt: "2026-08-12T13:00:00.000Z"
    },
    {
      id: "deleted-1",
      type: "expense",
      amount: 500,
      status: "deleted",
      createdAt: "2026-08-12T14:00:00.000Z"
    }
  ], [], "2026-08-12T15:00:00.000Z");

  assert.equal(view.totalIncome, 1000);
  assert.equal(view.totalExpense, 120);
  assert.equal(view.balance, 880);
  assert.equal(view.activeEntryCount, 2);
  assert.equal(view.recentEntries.length, 2);
  assert.equal(view.recentEntries[0].id, "expense-1");
});

test("member view keeps only recent 20 entries and admin view keeps 10 audits", function () {
  const entries = Array.from({ length: 25 }, (_, index) => ({
    id: `entry-${index}`,
    type: "income",
    amount: 1,
    status: "active",
    createdAt: new Date(1000 + index).toISOString()
  }));
  const audits = Array.from({ length: 15 }, (_, index) => ({
    id: `audit-${index}`,
    entryId: `entry-${index}`,
    operation: "create",
    createdAt: new Date(1000 + index).toISOString()
  }));
  const view = buildAccountingView(entries);
  const adminView = buildAdminAccountingView(audits);

  assert.equal(view.recentEntries.length, 20);
  assert.equal(Object.hasOwn(view, "recentAuditLogs"), false);
  assert.equal(adminView.recentAuditLogs.length, 10);
  assert.equal(view.totalIncome, 25);
});

test("member balances show who should receive and who should pay", function () {
  const view = buildAccountingView([{
    id: "expense-1",
    type: "expense",
    amount: 400,
    status: "active",
    payerMemberId: "member-shijie",
    payerDisplayName: "詩婕",
    shares: [
      { memberId: "member-shijie", displayName: "詩婕", amount: 100 },
      { memberId: "member-ming", displayName: "小明", amount: 100 },
      { memberId: "member-hua", displayName: "小花", amount: 200 }
    ]
  }]);

  assert.deepEqual(view.memberBalances, [
    {
      memberId: "member-shijie",
      displayName: "詩婕",
      paidAmount: 400,
      shareAmount: 100,
      balance: 300,
      status: "receivable"
    },
    {
      memberId: "member-ming",
      displayName: "小明",
      paidAmount: 0,
      shareAmount: 100,
      balance: -100,
      status: "payable"
    },
    {
      memberId: "member-hua",
      displayName: "小花",
      paidAmount: 0,
      shareAmount: 200,
      balance: -200,
      status: "payable"
    }
  ]);
});

test("member balance accumulation is independent from the recent entry limit", function () {
  let balances = [];
  for (let index = 0; index < 25; index += 1) {
    balances = applyEntryToMemberBalances(balances, {
      amount: 10,
      payerMemberId: "member-shijie",
      payerDisplayName: "詩婕",
      shares: [{ memberId: "member-ming", displayName: "小明", amount: 10 }]
    });
  }

  assert.equal(balances[0].paidAmount, 250);
  assert.equal(balances[0].balance, 250);
  assert.equal(balances[1].shareAmount, 250);
  assert.equal(balances[1].balance, -250);
});

test("member view does not expose LINE internal user id", function () {
  const view = buildAccountingView([{
    id: "entry-1",
    type: "income",
    amount: 100,
    status: "active",
    userId: "U-secret-line-id"
  }]);

  assert.equal(Object.hasOwn(view.recentEntries[0], "userId"), false);
});
