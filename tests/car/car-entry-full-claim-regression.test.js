"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { submitCarEntry } = require("../../services/car/car-entry-service");

function mockDb(initialCar) {
  let car = JSON.parse(JSON.stringify(initialCar));
  const ref = { key: "car-1" };
  return {
    collection(name) {
      assert.equal(name, "cars");
      return { doc(id) { assert.equal(id, "car-1"); return ref; } };
    },
    async runTransaction(callback) {
      const transaction = {
        async get(target) {
          assert.equal(target, ref);
          return { exists: true, id: "car-1", data: () => JSON.parse(JSON.stringify(car)) };
        },
        update(target, patch) {
          assert.equal(target, ref);
          car = { ...car, ...JSON.parse(JSON.stringify(patch)) };
        }
      };
      await callback(transaction);
    },
    current() { return JSON.parse(JSON.stringify(car)); }
  };
}

function lineSession(suffix, displayName) {
  return {
    profileId: `person-${suffix}`,
    identityId: `identity-${suffix}`,
    lineUserId: `line-${suffix}`,
    displayName: displayName || suffix
  };
}

function players(count) {
  return Array.from({ length: count }, (_, index) => ({
    playerId: `player-${index + 1}`,
    displayName: String.fromCharCode(65 + index),
    status: "joined"
  }));
}

test("A/H full 6/6 still accepts exact existing player claim without adding membership", async () => {
  const roster = players(6);
  const db = mockDb({ totalPeople: 6, players: roster, applications: [] });
  const before = db.current();
  const result = await submitCarEntry(
    { carId: "car-1", type: "player", targetPlayerId: "player-3" },
    lineSession("claim-c", "C"),
    { db }
  );
  const after = db.current();
  assert.equal(result.claimType, "existing_person");
  assert.equal(after.applications[0].targetPlayerId, "player-3");
  assert.equal(after.applications[0].targetPlayerName, "C");
  assert.equal(after.players.length, 6);
  assert.deepEqual(after.players, before.players);
});

test("B full 6/6 blocks only a new player application", async () => {
  const db = mockDb({ totalPeople: 6, players: players(6), applications: [] });
  await assert.rejects(
    submitCarEntry({ carId: "car-1", type: "player" }, lineSession("new-g", "G"), { db }),
    error => error.code === "player_capacity_full"
  );
  assert.equal((db.current().applications || []).length, 0);
});

test("C 5/6 permits a normal new player application", async () => {
  const db = mockDb({ totalPeople: 6, players: players(5), applications: [] });
  const result = await submitCarEntry(
    { carId: "car-1", type: "player", position: "不限" },
    lineSession("new-g", "G"),
    { db }
  );
  assert.equal(result.claimType, "new_person");
  assert.equal(db.current().players.length, 5);
  assert.equal(db.current().applications.length, 1);
});

test("D player already bound to another LINE identity cannot be claimed", async () => {
  const db = mockDb({
    totalPeople: 1,
    players: [{ playerId: "player-1", displayName: "A", lineUserId: "line-other" }],
    applications: []
  });
  await assert.rejects(
    submitCarEntry({ carId: "car-1", type: "player", targetPlayerId: "player-1" }, lineSession("claim-a", "A"), { db }),
    error => error.code === "player_claim_unavailable"
  );
});

test("E duplicate display names require the exact target id and are never auto-selected by name", async () => {
  const db = mockDb({
    totalPeople: 2,
    players: [
      { playerId: "same-1", personId: "canonical-1", displayName: "小安" },
      { playerId: "same-2", personId: "canonical-2", displayName: "小安" }
    ],
    applications: []
  });
  const result = await submitCarEntry(
    { carId: "car-1", type: "player", targetPlayerId: "same-2" },
    lineSession("claim-same", "小安"),
    { db }
  );
  assert.equal(result.claimType, "existing_person");
  assert.equal(db.current().applications[0].targetPlayerId, "same-2");
  assert.equal(db.current().applications[0].targetPersonId, "canonical-2");
});

test("F/H existing named DM slot remains claimable even when every formal staff slot is filled", async () => {
  const db = mockDb({
    staffSlots: [
      { id: "staff-1", label: "主持 1", displayName: "DM A" },
      { id: "staff-2", label: "主持 2", displayName: "DM B" }
    ],
    dmApplications: []
  });
  const before = db.current();
  const result = await submitCarEntry(
    { carId: "car-1", type: "dm", targetStaffId: "staff-2" },
    lineSession("dm-b", "DM B"),
    { db }
  );
  assert.equal(result.claimType, "existing_slot");
  assert.equal(db.current().dmApplications[0].targetStaffId, "staff-2");
  assert.deepEqual(db.current().staffSlots, before.staffSlots);
});

test("G DM slot bound to another LINE identity cannot be claimed", async () => {
  const db = mockDb({
    staffSlots: [{ id: "staff-1", displayName: "DM A", lineUserId: "line-other" }],
    dmApplications: []
  });
  await assert.rejects(
    submitCarEntry({ carId: "car-1", type: "dm", targetStaffId: "staff-1" }, lineSession("dm-a", "DM A"), { db }),
    error => error.code === "staff_slot_unavailable"
  );
});

test("I new DM application is limited by formal slot availability while legacy cars remain compatible", async () => {
  const fullDb = mockDb({ staffSlots: [{ id: "staff-1", displayName: "DM A" }], dmApplications: [] });
  await assert.rejects(
    submitCarEntry({ carId: "car-1", type: "dm" }, lineSession("dm-new", "DM New"), { db: fullDb }),
    error => error.code === "dm_capacity_full"
  );

  const openDb = mockDb({ staffSlots: [{ id: "staff-1", label: "主持 1", displayName: "" }], dmApplications: [] });
  const openResult = await submitCarEntry({ carId: "car-1", type: "dm" }, lineSession("dm-open", "DM New"), { db: openDb });
  assert.equal(openResult.claimType, "new_person");
  assert.equal(openDb.current().staffSlots.length, 1);

  const legacyDb = mockDb({ dmApplications: [] });
  const legacyResult = await submitCarEntry({ carId: "car-1", type: "dm" }, lineSession("dm-legacy", "DM Legacy"), { db: legacyDb });
  assert.equal(legacyResult.claimType, "new_person");
});

test("full-car UI keeps a LINE action host and separates existing claim from new signup", () => {
  const actions = fs.readFileSync(path.join(__dirname, "../../js/car/car-view-actions.js"), "utf8");
  assert.match(actions, /car-view-entry-actions/);
  assert.match(actions, /container\.appendChild\(host\)/);
  assert.match(actions, /認領名單中的我/);
  assert.match(actions, /認領既有人員不會再占一個名額/);
  assert.match(actions, /目前已滿，暫停新增報名/);
  assert.match(actions, /if\(!target\) assertNewPlayerCapacity/);
});
