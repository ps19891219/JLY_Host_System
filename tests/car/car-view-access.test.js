"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isCarMember, carViewPayload } = require("../../services/car/car-view-access");

const car = {
  id: "car-1", scriptName: "溫床", date: "2026-08-20", note: "成員備註",
  players: [{ memberId: "member-1", displayName: "詩婕" }],
  staffSlots: [{ player: { profileId: "staff-1" }, displayName: "DM" }],
  seatSlots: [{ playerId: "member-1" }]
};

test("formal player and nested staff identity receive member access", () => {
  assert.equal(isCarMember(car, { identityId: "member-1" }), true);
  assert.equal(isCarMember(car, { profileId: "staff-1" }), true);
});

test("linked identity from a car member receives member access", () => {
  const linkedCar = { ...car, players: [{ linkedPlayerIds: ["old-member-id"] }] };
  assert.equal(isCarMember(linkedCar, { identityId: "old-member-id" }), true);
});

test("member payload keeps full car information", () => {
  const result = carViewPayload(car, { identityId: "member-1" });
  assert.equal(result.access, "member");
  assert.equal(result.car.players.length, 1);
  assert.equal(result.car.staffSlots.length, 1);
  assert.equal(result.car.note, "成員備註");
});

test("public payload excludes member staff seat and private note data", () => {
  const result = carViewPayload(car, null);
  assert.equal(result.access, "public");
  assert.equal(result.car.players, undefined);
  assert.equal(result.car.staffSlots, undefined);
  assert.equal(result.car.seatSlots, undefined);
  assert.equal(result.car.note, undefined);
});
