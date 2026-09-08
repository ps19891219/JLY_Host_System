"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getIdentityIds,
  getCarOwnerIds,
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
