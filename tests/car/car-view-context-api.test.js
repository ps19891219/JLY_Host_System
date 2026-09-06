"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHandler } = require("../../api/car-view-context");

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = JSON.parse(body); }
  };
}

test("car view API returns the complete car to a verified formal member", async () => {
  const handler = createHandler({
    getCarById: async () => ({ id: "car-1", players: [{ memberId: "member-1" }], note: "private" }),
    verifyMemberSession: () => ({ valid: true, data: { identityId: "member-1", profileId: "profile-1", displayName: "詩婕" } })
  });
  const res = response();
  await handler({ method: "GET", query: { id: "car-1" }, headers: { cookie: "jly_member_session=test" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.access, "member");
  assert.equal(res.body.viewer.playerStatus, "joined");
  assert.equal(res.body.car.note, "private");
  assert.equal(res.body.car.players.length, 1);
});

test("car view API gives an anonymous viewer a safe renderable overview", async () => {
  const handler = createHandler({
    getCarById: async () => ({
      id: "car-1",
      scriptName: "溫床",
      gameDate: "2026-09-12",
      gameTime: "19:00",
      players: [{ memberId: "member-1", displayName: "玩家 A", position: "男位" }],
      staffSlots: [{ id: "dm-private", memberId: "dm-1", displayName: "DM A", label: "DM" }],
      seatSlots: [{ id: "seat-private", position: "男位", playerId: "member-1" }],
      publicNote: "公開備註",
      note: "private",
      hostNote: "host only",
      lineToken: "secret"
    }),
    verifyMemberSession: () => ({ valid: false })
  });
  const res = response();
  await handler({ method: "GET", query: { id: "car-1" }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.access, "public");
  assert.equal(res.body.viewer.authenticated, false);
  assert.equal(res.body.car.players.length, 1);
  assert.equal(res.body.car.players[0].memberId, undefined);
  assert.equal(res.body.car.staffSlots[0].memberId, undefined);
  assert.equal(res.body.car.seatSlots[0].id, "public-seat-1");
  assert.equal(res.body.car.note, undefined);
  assert.equal(res.body.car.hostNote, undefined);
  assert.equal(res.body.car.lineToken, undefined);
});
