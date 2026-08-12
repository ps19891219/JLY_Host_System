"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createLoginState,
  verifyLoginState
} = require("../../services/line/login-state");

test("server-signed LINE login state survives browser transitions", function () {
  const now = Date.now();
  const state = createLoginState({
    playerProfileId: "player-1",
    identityId: "identity-1",
    returnPath: "/pages/myprofile.html"
  }, "secret", now);
  const result = verifyLoginState(state, "secret", now + 1000);
  assert.equal(result.valid, true);
  assert.equal(result.data.playerProfileId, "player-1");
  assert.equal(result.data.returnPath, "/pages/myprofile.html");
});

test("LINE login state rejects tampering and expiration", function () {
  const now = Date.now();
  const state = createLoginState({}, "secret", now);
  assert.equal(verifyLoginState(state + "x", "secret", now).valid, false);
  assert.equal(
    verifyLoginState(state, "secret", now + 11 * 60 * 1000).reason,
    "line_login_state_expired"
  );
});
