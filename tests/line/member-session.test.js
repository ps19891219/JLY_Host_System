"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createMemberSession,
  verifyMemberSession,
  cookieHeader
} = require("../../services/line/member-session");

test("member session preserves verified LINE member identity", function () {
  const token = createMemberSession({
    profileId: "profile-1",
    identityId: "member-1",
    lineUserId: "U-line-1",
    displayName: "詩婕"
  }, "test-secret");
  const result = verifyMemberSession(token, "test-secret");
  assert.equal(result.valid, true);
  assert.equal(result.data.profileId, "profile-1");
  assert.equal(result.data.lineUserId, "U-line-1");
});

test("member session rejects tampering and uses a secure HttpOnly cookie", function () {
  const token = createMemberSession({
    profileId: "profile-1",
    lineUserId: "U-line-1"
  }, "test-secret");
  assert.equal(verifyMemberSession(`${token}x`, "test-secret").valid, false);
  const header = cookieHeader(token);
  assert.ok(header.includes("HttpOnly"));
  assert.ok(header.includes("Secure"));
  assert.ok(header.includes("SameSite=Lax"));
});
