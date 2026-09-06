"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(path.join(__dirname, "../../api/maintenance-reset-current-accounting.js"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../../pages/accounting-reset.html"), "utf8");

test("accounting-only mode is explicit, confirmed, and host-session scoped", () => {
  assert.match(api, /verifyMemberSession/);
  assert.match(api, /mode\s*===\s*["']accounting_only["']/);
  assert.match(api, /RESET_ACCOUNTING_ONLY/);
  assert.match(api, /collectOwnedCars/);
  assert.match(api, /\^accounting\/i/);
  assert.match(api, /if \(accountingOnly\)[\s\S]*remindersMigrated:\s*0[\s\S]*return;/);
});

test("legacy reminder migration remains outside accounting-only mode", () => {
  assert.match(api, /async function migrateReminder/);
  assert.match(api, /for \(const car of cars\)[\s\S]*migrateReminder/);
  assert.doesNotMatch(api, /collection\(["']players["']\)/);
});

test("mobile reset page uses accounting-only mode on the existing maintenance endpoint", () => {
  assert.match(page, /\/api\/maintenance-reset-current-accounting/);
  assert.match(page, /mode:\s*["']accounting_only["']/);
  assert.match(page, /RESET_ACCOUNTING_ONLY/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /credentials:\s*["']same-origin["']/);
  assert.match(page, /不會刪除/);
});
