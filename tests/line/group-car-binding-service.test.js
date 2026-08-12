"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  bindGroupToCar
} = require(
  "../../services/line/group-car-binding-service"
);

function context() {
  return {
    source: {
      type: "group",
      groupId: "group-1",
      userId: "line-owner"
    }
  };
}

test("only the linked car owner can bind a group", async function () {
  const result = await bindGroupToCar(
    context(),
    "car-1",
    {
      findPlayerByLineUserId: async () => ({
        id: "profile-1",
        linkedPlayerIds: ["not-owner"]
      }),
      getCarById: async () => ({
        id: "car-1",
        ownerId: "owner-1"
      }),
      getBindingByGroupId: async () => null
    }
  );

  assert.equal(result.bound, false);
  assert.equal(result.reason, "owner_required");
});

test("a car owner can bind through the member JLY identity id", async function () {
  const result = await bindGroupToCar(
    context(),
    "car-identity-owner",
    {
      findPlayerByLineUserId: async () => ({
        id: "member-document-id",
        identityId: "legacy-owner-id",
        linkedPlayerIds: []
      }),
      getCarById: async () => ({
        id: "car-identity-owner",
        ownerId: "legacy-owner-id"
      }),
      getBindingByGroupId: async () => null,
      saveBinding: async binding => binding,
      listGroupAccountingEntries: async () => [],
      migrateLegacyGroupAccounting: async () => ({ migrated: 0 })
    }
  );

  assert.equal(result.bound, true);
  assert.equal(result.binding.carId, "car-identity-owner");
  assert.equal(result.car.label, "car-identity-owner");
});

test("binding migrates legacy group entries to the car", async function () {
  let savedBinding = null;
  let migrationInput = null;

  const result = await bindGroupToCar(
    context(),
    "car-1",
    {
      findPlayerByLineUserId: async () => ({
        id: "profile-1",
        linkedPlayerIds: ["owner-1"]
      }),
      getCarById: async () => ({
        id: "car-1",
        ownerId: "owner-1"
      }),
      getBindingByGroupId: async () => null,
      saveBinding: async binding => {
        savedBinding = binding;
        return binding;
      },
      listGroupAccountingEntries: async () => [
        { id: "entry-1", amount: 100 }
      ],
      migrateLegacyGroupAccounting: async (
        carId,
        groupId,
        entries
      ) => {
        migrationInput = { carId, groupId, entries };
        return { migrated: entries.length };
      }
    }
  );

  assert.equal(result.bound, true);
  assert.equal(savedBinding.carId, "car-1");
  assert.equal(migrationInput.groupId, "group-1");
  assert.equal(result.migration.migrated, 1);
  assert.equal(result.car.id, "car-1");
});

test("an active binding cannot be overwritten by another car", async function () {
  let saveCalls = 0;
  const result = await bindGroupToCar(
    context(),
    "car-2",
    {
      findPlayerByLineUserId: async () => ({
        id: "owner-2"
      }),
      getCarById: async () => ({
        id: "car-2",
        ownerId: "owner-2"
      }),
      getBindingByGroupId: async () => ({
        groupId: "group-1",
        carId: "car-1",
        status: "active"
      }),
      saveBinding: async () => {
        saveCalls += 1;
      }
    }
  );

  assert.equal(result.bound, false);
  assert.equal(result.reason, "binding_conflict");
  assert.equal(saveCalls, 0);
});
