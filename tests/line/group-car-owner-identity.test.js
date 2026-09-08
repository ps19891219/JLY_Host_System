"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildIdentityComponent,
  getIdentityIds,
  getCarOwnerIds,
  identityIdsOwnCar,
  isCarOwner
} = require("../../services/line/group-car-binding-service");

test("LINE group owner accepts canonical Person aliases from bound player profile", () => {
  const player = {
    id: "profile-current",
    personId: "person-current",
    identityId: "identity-current",
    profileId: "profile-current",
    canonicalPersonId: "person-current",
    linkedPlayerIds: ["legacy-owner-id"]
  };

  assert.equal(isCarOwner(player, { ownerId: "legacy-owner-id" }), true);
  assert.equal(isCarOwner(player, { ownerId: "person-current" }), true);
  assert.equal(isCarOwner(player, { ownerProfileId: "profile-current" }), true);
});

test("pairing owner resolution follows explicit historical Person links across records", () => {
  const rows = [
    {
      id: "person-current",
      lineUserId: "U123",
      identityId: "identity-shared",
      linkedPlayerIds: ["legacy-owner-id"]
    },
    {
      id: "legacy-owner-id",
      identityId: "identity-shared",
      mergedIntoPersonId: "person-current"
    }
  ];

  const component = buildIdentityComponent(rows, "U123");
  assert.equal(component.valid, true);
  assert.equal(component.ids.has("legacy-owner-id"), true);
  assert.equal(identityIdsOwnCar(component.ids, { ownerId: "legacy-owner-id" }), true);
});

test("renamed Person remains resolvable without name matching", () => {
  const rows = [
    {
      id: "person-current",
      displayName: "新名字",
      lineUserId: "U123",
      identityId: "identity-shared"
    },
    {
      id: "legacy-owner-id",
      displayName: "舊名字",
      identityId: "identity-shared"
    }
  ];

  const component = buildIdentityComponent(rows, "U123");
  assert.equal(component.valid, true);
  assert.equal(component.ids.has("legacy-owner-id"), true);
});

test("conflicting strong identity evidence fails closed", () => {
  const rows = [
    {
      id: "person-current",
      lineUserId: "U123",
      identityId: "identity-a",
      linkedPlayerIds: ["legacy-owner-id"]
    },
    {
      id: "legacy-owner-id",
      lineUserId: "U999",
      identityId: "identity-b",
      mergedIntoPersonId: "person-current"
    }
  ];

  const component = buildIdentityComponent(rows, "U123");
  assert.equal(component.valid, false);
  assert.deepEqual(
    component.conflicts.map(item => item.field).sort(),
    ["identityId", "lineUserId"]
  );
});

test("LINE group owner does not use display name as identity proof", () => {
  const player = {
    id: "person-a",
    displayName: "詩婕"
  };

  assert.equal(isCarOwner(player, {
    ownerId: "person-b",
    ownerName: "詩婕"
  }), false);
});

test("provisional line ids are excluded from formal owner identity aliases", () => {
  const actorIds = getIdentityIds({
    id: "person-a",
    personId: "line:U123",
    linkedPlayerIds: ["line:U123"]
  });
  const ownerIds = getCarOwnerIds({
    ownerId: "line:U123"
  });

  assert.equal(actorIds.has("line:U123"), false);
  assert.equal(ownerIds.has("line:U123"), false);
});

test("unrelated Person cannot bind a car group", () => {
  assert.equal(isCarOwner(
    { id: "person-a", identityId: "identity-a" },
    { ownerId: "person-b" }
  ), false);
});
