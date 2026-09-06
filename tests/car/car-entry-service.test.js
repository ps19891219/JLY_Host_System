"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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

const session = {
  profileId: "person-1",
  identityId: "identity-1",
  lineUserId: "line-1",
  displayName: "詩婕"
};

test("player entry creates one formal pending application without changing player or seat data", async () => {
  const db = mockDb({
    players: [{ memberId: "existing-player", displayName: "A" }],
    seatSlots: [{ id: "seat-1", playerId: "existing-player" }],
    staffSlots: [{ id: "dm-1", memberId: "dm-existing", displayName: "DM" }],
    applications: []
  });
  const before = db.current();

  const result = await submitCarEntry(
    { carId: "car-1", type: "player", position: "女位", isCrossPlay: true },
    session,
    { db }
  );

  const after = db.current();
  assert.equal(result.type, "player");
  assert.equal(result.status, "pending");
  assert.match(result.id, /^player_app_/);
  assert.equal(after.applications.length, 1);
  assert.equal(after.applications[0].memberId, "person-1");
  assert.equal(after.applications[0].profileId, "person-1");
  assert.equal(after.applications[0].position, "女位");
  assert.equal(after.applications[0].isCrossPlay, true);
  assert.equal(after.applications[0].status, "pending");
  assert.deepEqual(after.players, before.players);
  assert.deepEqual(after.seatSlots, before.seatSlots);
  assert.deepEqual(after.staffSlots, before.staffSlots);
});

test("existing player and pending player application cannot be duplicated", async () => {
  const joinedDb = mockDb({ players: [{ memberId: "person-1", displayName: "詩婕" }], applications: [] });
  await assert.rejects(
    submitCarEntry({ carId: "car-1", type: "player" }, session, { db: joinedDb }),
    error => error.code === "already_player"
  );

  const pendingDb = mockDb({ players: [], applications: [{ memberId: "person-1", status: "pending", displayName: "詩婕" }] });
  await assert.rejects(
    submitCarEntry({ carId: "car-1", type: "player" }, session, { db: pendingDb }),
    error => error.code === "player_application_pending"
  );
});

test("DM entry preserves formal application shape and does not create staff before host approval", async () => {
  const db = mockDb({
    staffSlots: [{ id: "dm-1", label: "DM", displayName: "詩婕", memberId: "" }],
    dmApplications: [],
    players: [],
    seatSlots: []
  });
  const before = db.current();

  const result = await submitCarEntry(
    { carId: "car-1", type: "dm", targetStaffId: "dm-1" },
    session,
    { db }
  );

  const after = db.current();
  assert.match(result.id, /^dm_app_/);
  assert.equal(after.dmApplications.length, 1);
  assert.equal(after.dmApplications[0].id, result.id);
  assert.equal(after.dmApplications[0].memberId, "person-1");
  assert.equal(after.dmApplications[0].claimType, "existing_person");
  assert.equal(after.dmApplications[0].targetStaffId, "dm-1");
  assert.equal(after.dmApplications[0].status, "pending");
  assert.deepEqual(after.staffSlots, before.staffSlots);
  assert.deepEqual(after.players, before.players);
  assert.deepEqual(after.seatSlots, before.seatSlots);
});

test("existing staff and pending DM application cannot be duplicated", async () => {
  const staffDb = mockDb({ staffSlots: [{ id: "dm-1", memberId: "person-1", displayName: "詩婕" }], dmApplications: [] });
  await assert.rejects(
    submitCarEntry({ carId: "car-1", type: "dm" }, session, { db: staffDb }),
    error => error.code === "already_staff"
  );

  const pendingDb = mockDb({ staffSlots: [], dmApplications: [{ memberId: "person-1", status: "pending", displayName: "詩婕" }] });
  await assert.rejects(
    submitCarEntry({ carId: "car-1", type: "dm" }, session, { db: pendingDb }),
    error => error.code === "dm_application_pending"
  );
});
