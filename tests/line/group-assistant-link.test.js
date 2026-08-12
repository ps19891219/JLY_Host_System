"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createGroupAssistantToken,
  verifyGroupAssistantToken
} = require("../../services/line/group-assistant-link");

test("group assistant link preserves signed group and car binding", function () {
  const token = createGroupAssistantToken(
    { groupId: "group-1", carId: "car-99" },
    "test-secret"
  );
  const result = verifyGroupAssistantToken(token, "test-secret");
  assert.equal(result.valid, true);
  assert.equal(result.data.groupId, "group-1");
  assert.equal(result.data.carId, "car-99");
});

test("group assistant link rejects tampering", function () {
  const token = createGroupAssistantToken(
    { groupId: "group-1", carId: "car-99" },
    "test-secret"
  );
  const result = verifyGroupAssistantToken(`${token}x`, "test-secret");
  assert.equal(result.valid, false);
});
