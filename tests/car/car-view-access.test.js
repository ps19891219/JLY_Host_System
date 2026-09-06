"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isCarMember, viewerState, carViewPayload } = require("../../services/car/car-view-access");

const car = {
  id: "car-1",
  scriptName: "溫床",
  date: "2026-08-20",
  gameTime: "19:30",
  price: 850,
  totalPeople: 6,
  maleSlots: 3,
  femaleSlots: 3,
  studioName: "JLY Studio",
  location: "台北",
  publicNote: "請提早十分鐘到",
  note: "主揪內部備註",
  hostNote: "不可公開",
  ownerId: "host-private-id",
  lineToken: "secret-token",
  accounting: { internal: true },
  players: [{ memberId: "member-1", displayName: "詩婕", position: "女位", isCrossPlay: false }],
  staffSlots: [{ id: "dm-1", player: { profileId: "staff-1" }, memberId: "staff-1", displayName: "DM A", label: "DM" }],
  seatSlots: [{ id: "seat-private", label: "女1", position: "女位", playerId: "member-1" }],
  applications: [{ id: "app-1", memberId: "pending-1", displayName: "等待玩家", status: "pending" }],
  dmApplications: [{ id: "dm-app-1", memberId: "pending-dm", displayName: "等待 DM", status: "pending" }]
};

test("formal player and nested staff identity receive member access", () => {
  assert.equal(isCarMember(car, { identityId: "member-1" }), true);
  assert.equal(isCarMember(car, { profileId: "staff-1" }), true);
});

test("linked identity from a car member receives member access", () => {
  const linkedCar = { ...car, players: [{ linkedPlayerIds: ["old-member-id"] }] };
  assert.equal(isCarMember(linkedCar, { identityId: "old-member-id" }), true);
});

test("same display name alone never unlocks full member access", () => {
  assert.equal(isCarMember(car, { profileId: "different-id", displayName: "詩婕" }), false);
});

test("member payload keeps complete car information", () => {
  const result = carViewPayload(car, { identityId: "member-1", profileId: "profile-1", displayName: "詩婕" });
  assert.equal(result.access, "member");
  assert.equal(result.viewer.playerStatus, "joined");
  assert.equal(result.car.players.length, 1);
  assert.equal(result.car.staffSlots.length, 1);
  assert.equal(result.car.note, "主揪內部備註");
});

test("anonymous payload contains renderable car overview but strips private/internal fields", () => {
  const result = carViewPayload(car, null);
  assert.equal(result.access, "public");
  assert.equal(result.viewer.authenticated, false);
  assert.equal(result.car.scriptName, "溫床");
  assert.equal(result.car.players.length, 1);
  assert.equal(result.car.players[0].displayName, "詩婕");
  assert.equal(result.car.players[0].memberId, undefined);
  assert.equal(result.car.staffSlots.length, 1);
  assert.equal(result.car.staffSlots[0].memberId, undefined);
  assert.equal(result.car.seatSlots.length, 1);
  assert.equal(result.car.seatSlots[0].id, "public-seat-1");
  assert.equal(result.car.seatSlots[0].playerId, "public-player-1");
  assert.equal(result.car.publicNote, "請提早十分鐘到");
  assert.equal(result.car.note, undefined);
  assert.equal(result.car.hostNote, undefined);
  assert.equal(result.car.ownerId, undefined);
  assert.equal(result.car.lineToken, undefined);
  assert.equal(result.car.accounting, undefined);
  assert.equal(result.car.applications, undefined);
  assert.equal(result.car.dmApplications, undefined);
});

test("viewer state distinguishes joined and pending formal identities", () => {
  assert.equal(viewerState(car, { profileId: "pending-1", displayName: "等待玩家" }).playerStatus, "pending");
  assert.equal(viewerState(car, { profileId: "pending-dm", displayName: "等待 DM" }).dmStatus, "pending");
  assert.equal(viewerState(car, { profileId: "member-1", displayName: "詩婕" }).playerStatus, "joined");
  assert.equal(viewerState(car, { profileId: "staff-1", displayName: "DM A" }).dmStatus, "joined");
});
