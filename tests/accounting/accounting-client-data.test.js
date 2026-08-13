const test = require("node:test");
const assert = require("node:assert/strict");
const accountingData = require("../../js/modules/accounting/accounting-data");

test("collectActivityMembers merges formal owner, player, and staff identities", () => {
  const members = accountingData.collectActivityMembers({
    ownerId: "owner-1",
    ownerName: "詩婕",
    players: [
      { playerId: "player-1", playerName: "小霙" },
      { playerId: "shared-1", playerName: "共同成員" },
      { playerId: "cancelled-1", playerName: "取消玩家", status: "cancelled" },
      { playerName: "沒有正式 ID" }
    ],
    staffSlots: [
      { memberId: "staff-1", displayName: "DM" },
      { memberId: "shared-1", displayName: "共同成員" }
    ]
  });

  assert.deepEqual(members.map(item => item.personId), ["owner-1", "player-1", "shared-1", "staff-1"]);
  assert.deepEqual(members.find(item => item.personId === "shared-1").roles, ["player", "staff"]);
});

test("buildQuickTransaction creates one pending Activity transaction and separates creator from payer", () => {
  const transaction = accountingData.buildQuickTransaction({ transactionId: "web-1", carId: "car-99", title: "晚餐", amount: 1680, createdBy: "member-shijie", paidBy: "member-xiaoying" }, "2026-08-13T01:00:00.000Z");
  assert.equal(transaction.activityId, "car-99");
  assert.equal(transaction.activityType, "car");
  assert.equal(transaction.villageType, "script_village");
  assert.equal(transaction.createdBy, "member-shijie");
  assert.equal(transaction.paidBy, "member-xiaoying");
  assert.equal(transaction.splitStatus, "pending");
  assert.equal(transaction.settlementStatus, "pending");
  assert.equal(transaction.amount, 1680);
});

test("buildQuickTransaction rejects missing formal creator identity", () => {
  assert.throws(() => accountingData.buildQuickTransaction({ transactionId: "web-2", carId: "car-99", title: "停車費", amount: 200, createdBy: "" }), /quick_transaction_invalid/);
});

test("current profile resolves to an older linked car identity and keeps the person's name", () => {
  const members = accountingData.collectActivityMembers({
    ownerId: "old-jly-identity",
    organizerName: "凱崴私團"
  });
  members[0].identityIds.push("profile-shijie");

  const current = accountingData.resolveCurrentActivityMember(members, {
    identityIds: ["profile-shijie", "old-jly-identity"],
    displayName: "詩婕"
  });

  assert.equal(current.personId, "old-jly-identity");
  assert.equal(current.displayName, "詩婕");
  assert.notEqual(current.displayName, "凱崴私團");
});

test("getCurrentIdentity includes profile, device, and linked identities", () => {
  const values = new Map([
    ["currentPlayerProfileId", "profile-shijie"],
    ["currentPlayerId", "device-shijie"],
    ["currentPlayerName", "詩婕"],
    ["linkedPlayerIds", JSON.stringify(["old-jly-identity"])]
  ]);
  const identity = accountingData.getCurrentIdentity({ getItem: key => values.get(key) || "" });
  assert.deepEqual(identity.identityIds, ["profile-shijie", "device-shijie", "old-jly-identity"]);
  assert.equal(identity.displayName, "詩婕");
});
