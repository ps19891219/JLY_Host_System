"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHandler } = require("../../api/line-login");

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = JSON.parse(body); }
  };
}

test("LINE login verifies identity and links the current member", async function () {
  let linked = null;
  const handler = createHandler({
    exchangeAuthorizationCode: async code => {
      assert.equal(code, "auth-code");
      return "access-token";
    },
    fetchLineProfile: async token => {
      assert.equal(token, "access-token");
      return { userId: "line-1", displayName: "小明" };
    },
    linkPlayerProfile: async (profileId, identityId, lineUser) => {
      linked = { profileId, identityId, lineUser };
      return { profileId, linked: true };
    }
  });
  const res = response();
  await handler({
    method: "POST",
    body: {
      code: "auth-code",
      playerProfileId: "player-1",
      identityId: "identity-1"
    }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(linked.profileId, "player-1");
  assert.equal(linked.lineUser.userId, "line-1");
});

test("LINE login refuses linking without an existing JLY identity", async function () {
  const handler = createHandler({
    exchangeAuthorizationCode: async () => "unused"
  });
  const res = response();
  await handler({
    method: "POST",
    body: { code: "auth-code" }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "member_link_data_missing");
});
