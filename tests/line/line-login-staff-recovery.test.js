"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  allowsVerifiedFirstLink,
  allowsExistingIdentityRecovery
} = require("../../api/line-login");

test("Work Schedule staff entry may recover an existing LINE identity", () => {
  assert.equal(allowsExistingIdentityRecovery("work_schedule_staff_entry"), true);
});

test("Work Schedule staff entry cannot create a provisional first-link identity", () => {
  assert.equal(allowsVerifiedFirstLink("work_schedule_staff_entry"), false);
});

test("car player and DM entry keep existing recovery and provisional behavior", () => {
  for (const purpose of ["car_player_entry", "car_dm_entry"]) {
    assert.equal(allowsExistingIdentityRecovery(purpose), true);
    assert.equal(allowsVerifiedFirstLink(purpose), true);
  }
});
