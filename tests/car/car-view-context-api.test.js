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
    verifyMemberSession: () => ({ valid: true, data: { identityId: "member-1", profileId: "profile-1" } })
  });
  const res = response();
  await handler({ method: "GET", query: { id: "car-1" }, headers: { cookie: "jly_member_session=test" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.access, "member");
  assert.equal(res.body.car.note, "private");
  assert.equal(res.body.car.players.length, 1);
});

test("car view API strips member data for a public viewer", async () => {
  const handler = createHandler({
    getCarById: async () => ({ id: "car-1", scriptName: "溫床", players: [{ memberId: "member-1" }], note: "private" }),
    verifyMemberSession: () => ({ valid: false })
  });
  const res = response();
  await handler({ method: "GET", query: { id: "car-1" }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.access, "public");
  assert.equal(res.body.car.players, undefined);
  assert.equal(res.body.car.note, undefined);
});
