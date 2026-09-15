"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  identityIdsFromProfile,
  classifyCar,
  planRecovery
} = require("../../services/car/mycar-view-recovery-plan");

test("profile identity includes formal linkedPlayerIds but excludes provisional LINE ids", () => {
  assert.deepEqual(
    identityIdsFromProfile("profile-1", {
      identityId: "person-1",
      linkedPlayerIds: ["legacy-1", "line:temporary"]
    }).sort(),
    ["legacy-1", "person-1", "profile-1"].sort()
  );
});

test("host precedence remains when the same car also contains player membership", () => {
  const role = classifyCar({
    ownerId: "person-1",
    players: [{ playerId: "legacy-1", status: "joined" }]
  }, ["person-1", "legacy-1"]);
  assert.equal(role.isHost, true);
  assert.equal(role.isPlayer, false);
});

test("historical player membership can resolve through formal member identity fields", () => {
  const role = classifyCar({
    ownerId: "someone-else",
    players: [{ playerId: "old-player", personId: "person-1", status: "joined" }]
  }, ["person-1"]);
  assert.equal(role.isHost, false);
  assert.equal(role.isPlayer, true);
});

test("incomplete Core read can never become a recovery write", () => {
  assert.throws(() => planRecovery({
    identityIds: ["person-1"],
    coreCars: [],
    coreReadComplete: false,
    allowWrite: true
  }), /mycar_recovery_core_read_incomplete/);
});

test("zero Core matches require explicit empty confirmation even when writes are enabled", () => {
  const plan = planRecovery({
    identityIds: ["person-1"],
    coreCars: [],
    coreReadComplete: true,
    allowWrite: true
  });
  assert.equal(plan.shouldWrite, false);
  assert.equal(plan.after.all, 0);
});

test("known-good Core matches produce host and player counts without mutating Core objects", () => {
  const coreCars = [
    { id: "host-car", ownerId: "person-1", players: [] },
    { id: "player-car", ownerId: "other", players: [{ playerId: "legacy-1", status: "joined" }] }
  ];
  const original = JSON.stringify(coreCars);
  const plan = planRecovery({
    existingView: { cars: [] },
    identityIds: ["person-1", "legacy-1"],
    coreCars,
    coreReadComplete: true,
    allowWrite: true
  });
  assert.deepEqual(plan.after, { all: 2, host: 1, player: 1 });
  assert.equal(plan.shouldWrite, true);
  assert.equal(JSON.stringify(coreCars), original);
});
