"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const approvalPath = path.join(__dirname, "../../js/modules/car/detail/application/identity-claim-approval.js");
const source = fs.readFileSync(approvalPath, "utf8");

test("new LINE application reuses an existing canonical Person instead of rejecting it", () => {
  assert.match(source, /const existingPerson = await resolveLinePerson\(db, app\);/);
  assert.match(source, /existingPerson \? db\.collection\("players"\)\.doc\(existingPerson\.id\)/);
  assert.doesNotMatch(source, /LINE Identity 已經有正式 Person，不能再建立第二個 Person/);
});

test("existing historical roster claim prefers the claimant canonical Person", () => {
  assert.match(source, /async function canonicalForExistingClaim/);
  assert.match(source, /if \(linePerson\)/);
  assert.match(source, /legacyPerson: targetPerson && targetPerson\.id !== linePerson\.id/);
  assert.match(source, /updateExistingRosterIdentity\(freshTarget, latestPerson, current\)/);
});

test("historical aliases and linked player ids are preserved on the canonical Person", () => {
  assert.match(source, /function mergePersonPatch/);
  assert.match(source, /linkedPlayerIds/);
  assert.match(source, /aliases/);
  assert.match(source, /candidateIds\(target, app\).*linkedPlayerIds\.add/);
});

test("same-name evidence alone is never used to resolve a Person", () => {
  assert.doesNotMatch(source, /where\("displayName"/);
  assert.doesNotMatch(source, /where\("nickname"/);
  assert.match(source, /where\("lineUserId", "==", lineUserId\)/);
});

test("existing Person new membership is protected from duplicate membership", () => {
  assert.match(source, /這個 Person 已經在這台車裡，不會重複加入/);
});
