"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { collectMembers, prepareQuickAccounting } = require("../../services/line/quick-accounting-service");

const car = { ownerId: "host", ownerName: "詩婕", players: [{ playerId: "p1", playerName: "小英" }, { playerId: "p2", playerName: "小瑛" }], staffSlots: [{ memberId: "dm1", displayName: "DM" }] };
const context = { accountingCarId: "car-1", timestamp: Date.parse("2026-08-14T10:00:00.000Z"), source: { groupId: "g1" }, message: { id: "m1" } };

test("collects owner players and staff as formal activity members", () => {
  assert.deepEqual(collectMembers(car).map(item => item.personId), ["host", "p1", "p2", "dm1"]);
});

test("unique payer is ready for a formal transaction", async () => {
  const result = await prepareQuickAccounting(context, { title: "晚餐", amount: 690, payerInput: "小英" }, car, { playerId: "host", canManageAll: true });
  assert.equal(result.reason, "payer_resolved");
  assert.equal(result.payer.personId, "p1");
});

test("unresolved payer creates a pending draft without a transaction", async () => {
  let saved;
  const result = await prepareQuickAccounting(context, { title: "晚餐", amount: 690, payerInput: "小" }, car, { playerId: "host", canManageAll: true }, { saveAccountingDraft: async draft => { saved = draft; } });
  assert.equal(result.reason, "pending_identity");
  assert.equal(saved.status, "pending_identity");
  assert.deepEqual(saved.payerCandidateIds, ["p1", "p2"]);
});
