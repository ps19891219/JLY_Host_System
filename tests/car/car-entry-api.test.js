"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHandler } = require("../../api/car-entry");

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = JSON.parse(body); }
  };
}

test("car entry API requires an identified member session for writes", async () => {
  const handler = createHandler({ verifyMemberSession: () => ({ valid: false }) });
  const res = response();
  await handler({ method: "POST", headers: {}, body: { carId: "car-1", type: "player" } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "identity_required");
});

test("car entry API sends player and DM actions through the same shared service", async () => {
  const calls = [];
  const handler = createHandler({
    verifyMemberSession: () => ({
      valid: true,
      data: { profileId: "person-1", identityId: "identity-1", lineUserId: "line-1", displayName: "詩婕" }
    }),
    submitCarEntry: async (payload, session) => {
      calls.push({ payload, session });
      return { id: `${payload.type}-app`, type: payload.type, status: "pending" };
    }
  });

  const playerRes = response();
  await handler({ method: "POST", headers: { cookie: "jly_member_session=test" }, body: { carId: "car-1", type: "player", position: "女位" } }, playerRes);
  const dmRes = response();
  await handler({ method: "POST", headers: { cookie: "jly_member_session=test" }, body: { carId: "car-1", type: "dm", targetStaffId: "dm-1" } }, dmRes);

  assert.equal(playerRes.statusCode, 200);
  assert.equal(dmRes.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].payload.type, "player");
  assert.equal(calls[1].payload.type, "dm");
  assert.equal(calls[0].session.profileId, "person-1");
  assert.equal(calls[1].session.profileId, "person-1");
});
