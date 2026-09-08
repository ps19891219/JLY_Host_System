"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  prepareGroupPairing,
  confirmGroupPairing
} = require("../../services/line/group-car-pairing-service");

function context(userId = "line-helper") {
  return {
    source: { type: "group", groupId: "group-1", userId }
  };
}

function authorizedPairing(overrides = {}) {
  return {
    carId: "car-1",
    status: "pending",
    authorizationType: "car_owner_session",
    authorizedByPersonId: "owner-person-1",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    ...overrides
  };
}

test("authorized pairing code can be prepared by a non-owner group participant", async function () {
  let update = null;
  let playerLookupCalled = false;
  const result = await prepareGroupPairing(context("line-friend"), "A7K9P2", {
    getPairingCode: async () => authorizedPairing(),
    findPlayerByLineUserId: async () => {
      playerLookupCalled = true;
      return null;
    },
    getCarById: async () => ({
      id: "car-1",
      ownerId: "owner-person-1",
      scriptName: "測試劇本",
      date: "2026-08-20"
    }),
    updatePairingCode: async (_code, changes) => { update = changes; }
  });

  assert.equal(result.prepared, true);
  assert.equal(result.car.label, "測試劇本");
  assert.equal(update.status, "awaiting_confirmation");
  assert.equal(update.groupId, "group-1");
  assert.equal(update.requestedBy, "line-friend");
  assert.equal(playerLookupCalled, false);
});

test("legacy pairing code without car-side authorization is rejected", async function () {
  const result = await prepareGroupPairing(context(), "A7K9P2", {
    getPairingCode: async () => ({
      carId: "car-1",
      status: "pending",
      expiresAt: new Date(Date.now() + 60000).toISOString()
    })
  });
  assert.equal(result.prepared, false);
  assert.equal(result.reason, "pairing_not_authorized");
});

test("confirmation stays limited to the same group and same LINE executor", async function () {
  const mismatch = await confirmGroupPairing(context("line-other"), "A7K9P2", {
    getPairingCode: async () => authorizedPairing({
      status: "awaiting_confirmation",
      groupId: "group-1",
      requestedBy: "line-friend"
    })
  });
  assert.equal(mismatch.bound, false);
  assert.equal(mismatch.reason, "pairing_confirmation_mismatch");
});

test("authorized confirmation passes pairing authority into binding without requiring owner executor", async function () {
  let updates = 0;
  let bindDependencies = null;
  const pairing = authorizedPairing({
    status: "awaiting_confirmation",
    groupId: "group-1",
    requestedBy: "line-friend"
  });
  const result = await confirmGroupPairing(context("line-friend"), "A7K9P2", {
    getPairingCode: async () => pairing,
    bindGroupToCar: async (_context, _carId, dependencies) => {
      bindDependencies = dependencies;
      return {
        bound: true,
        migration: { migrated: 0 },
        car: { id: "car-1", label: "測試劇本" }
      };
    },
    updatePairingCode: async () => { updates += 1; }
  });
  assert.equal(result.bound, true);
  assert.equal(updates, 1);
  assert.equal(bindDependencies.authorizedPairing, true);
  assert.equal(bindDependencies.pairingAuthorization, pairing);
});

test("expired pairing code cannot be prepared", async function () {
  const result = await prepareGroupPairing(context(), "A7K9P2", {
    getPairingCode: async () => authorizedPairing({
      expiresAt: new Date(Date.now() - 60000).toISOString()
    })
  });
  assert.equal(result.reason, "pairing_expired");
});
