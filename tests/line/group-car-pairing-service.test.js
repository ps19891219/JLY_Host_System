"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  prepareGroupPairing,
  confirmGroupPairing
} = require("../../services/line/group-car-pairing-service");

function context() {
  return {
    source: { type: "group", groupId: "group-1", userId: "line-owner" }
  };
}

test("pairing code shows car details before binding", async function () {
  let update = null;
  const result = await prepareGroupPairing(context(), "A7K9P2", {
    getPairingCode: async () => ({
      carId: "car-1",
      status: "pending",
      expiresAt: new Date(Date.now() + 60000).toISOString()
    }),
    findPlayerByLineUserId: async () => ({ id: "member-1" }),
    getCarById: async () => ({
      id: "car-1",
      ownerId: "member-1",
      scriptName: "測試劇本",
      date: "2026-08-20"
    }),
    updatePairingCode: async (_code, changes) => { update = changes; }
  });

  assert.equal(result.prepared, true);
  assert.equal(result.car.label, "測試劇本");
  assert.equal(update.status, "awaiting_confirmation");
  assert.equal(update.groupId, "group-1");
});

test("pairing code rejects a user who is not the car owner", async function () {
  const result = await prepareGroupPairing(context(), "A7K9P2", {
    getPairingCode: async () => ({
      carId: "car-1",
      status: "pending",
      expiresAt: new Date(Date.now() + 60000).toISOString()
    }),
    findPlayerByLineUserId: async () => ({ id: "member-2" }),
    getCarById: async () => ({ id: "car-1", ownerId: "member-1" })
  });
  assert.equal(result.prepared, false);
  assert.equal(result.reason, "owner_required");
});

test("confirmation is limited to the original group and owner", async function () {
  let updates = 0;
  const result = await confirmGroupPairing(context(), "A7K9P2", {
    getPairingCode: async () => ({
      carId: "car-1",
      status: "awaiting_confirmation",
      groupId: "group-1",
      requestedBy: "line-owner",
      expiresAt: new Date(Date.now() + 60000).toISOString()
    }),
    bindGroupToCar: async () => ({
      bound: true,
      migration: { migrated: 0 },
      car: { id: "car-1", label: "測試劇本" }
    }),
    updatePairingCode: async () => { updates += 1; }
  });
  assert.equal(result.bound, true);
  assert.equal(updates, 1);
});

test("expired pairing code cannot be prepared", async function () {
  const result = await prepareGroupPairing(context(), "A7K9P2", {
    getPairingCode: async () => ({
      carId: "car-1",
      status: "pending",
      expiresAt: new Date(Date.now() - 60000).toISOString()
    })
  });
  assert.equal(result.reason, "pairing_expired");
});
