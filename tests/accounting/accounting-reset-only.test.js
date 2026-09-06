"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(path.join(__dirname, "../../api/reset-accounting-only.js"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../../pages/accounting-reset.html"), "utf8");

test("accounting reset is explicitly accounting-only and host-session scoped", () => {
  assert.match(api, /verifyMemberSession/);
  assert.match(api, /RESET_ACCOUNTING_ONLY/);
  assert.match(api, /collectOwnedCars/);
  assert.match(api, /\^accounting\/i/);
  assert.doesNotMatch(api, /migrateReminder/);
  assert.doesNotMatch(api, /collection\(["']players["']\)/);
  assert.doesNotMatch(api, /collection\(["']reminders["']\)/);
});

test("mobile reset page uses the protected accounting-only endpoint", () => {
  assert.match(page, /\/api\/reset-accounting-only/);
  assert.match(page, /RESET_ACCOUNTING_ONLY/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /credentials:\s*["']same-origin["']/);
  assert.match(page, /不會刪除/);
});
