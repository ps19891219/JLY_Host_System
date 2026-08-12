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
    verifyLoginState: () => ({
      valid: true,
      data: {
        playerProfileId: "player-1",
        identityId: "identity-1",
        returnPath: "/pages/myprofile.html"
      }
    }),
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

test("LINE login can recover an already-linked member in a new browser", async function () {
  let received = null;
  const handler = createHandler({
    verifyLoginState: () => ({
      valid: true,
      data: { returnPath: "/index.html" }
    }),
    exchangeAuthorizationCode: async () => "access-token",
    fetchLineProfile: async () => ({ userId: "line-1" }),
    linkPlayerProfile: async (profileId, identityId) => {
      received = { profileId, identityId };
      return {
        profileId: "player-1",
        identityId: "identity-1",
        linked: true,
        recovered: true
      };
    }
  });
  const res = response();
  await handler({
    method: "POST",
    body: { code: "auth-code" }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.memberLink.recovered, true);
  assert.equal(received.profileId, "");
  assert.equal(received.identityId, "");
});
