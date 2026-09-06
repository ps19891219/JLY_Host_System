"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(path.join(__dirname, "../../api/maintenance-reset-current-accounting.js"), "utf8");

test("maintenance reset consumes the member-session verification contract correctly", () => {
  assert.match(api, /const verified = verifyMemberSession\(/);
  assert.match(api, /if \(!verified\.valid\)/);
  assert.match(api, /const session = verified\.data/);
  assert.doesNotMatch(api, /const session = await verifyMemberSession/);
});
