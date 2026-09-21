"use strict";

const assert = require("assert");
const domain = require("../../shared/work-schedule/staff-assignment-confirmation");

const shift = {
  workId: "work-1",
  date: "2026-09-27",
  startTime: "19:00",
  endTime: "23:00",
  rolePoolId: "dm",
  roleName: "DM"
};

const tentative = domain.createTentative({
  shiftId: "shift-1",
  personId: "person-1",
  studioId: "studio-1",
  sourceMatchingId: "matching-1",
  sourceSlotId: "slot-1",
  shift
});

assert.equal(tentative.status, "tentative");
const confirmed = domain.confirm(tentative, shift);
assert.equal(confirmed.status, "confirmed");
assert.equal(domain.decline(tentative).status, "declined");
assert.equal(domain.canPromoteToFormal(tentative, shift), false);
assert.equal(domain.canPromoteToFormal(confirmed, shift), true);
assert.equal(domain.projectFormalAssignment(confirmed, shift).confirmationStatus, "confirmed");
assert.throws(() => domain.projectFormalAssignment(tentative, shift), /assignment_not_confirmed/);

const changed = { ...shift, startTime: "20:00" };
assert.equal(domain.invalidateIfChanged(tentative, changed).status, "invalidated");
assert.throws(() => domain.confirm(tentative, changed), /shift_changed/);

const pending = domain.buildPendingAction(tentative);
assert.deepEqual(pending, {
  type: "staff_assignment_confirmation",
  responsiblePersonId: "person-1",
  studioId: "studio-1",
  source: "work_schedule",
  targetType: "work_shift",
  targetId: "shift-1",
  status: "pending"
});

const changedShift={...shift,startTime:"20:00"};
const invalidated=domain.invalidateIfChanged(confirmed,changedShift);
assert.equal(invalidated.status,domain.STATUS.INVALIDATED);
const reconfirmed=domain.confirm(invalidated,changedShift);
assert.equal(reconfirmed.status,domain.STATUS.CONFIRMED);
assert.equal(reconfirmed.shiftFingerprint,domain.fingerprint(changedShift));

console.log("staff-assignment-confirmation tests passed");
