"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const audit = require("../../scripts/person-dedupe-audit.js");

test("same-name alone never becomes strong identity evidence", () => {
  const rows = [
    { id: "person-a", displayName: "Ian" },
    { id: "person-b", displayName: "Ian" }
  ];
  const result = audit.classify(rows);
  assert.equal(result.hasStrongEvidence, false);
  assert.equal(result.disposition, "manual_same_name_review");
  assert.deepEqual(result.evidenceEdges, []);
});

test("shared LINE user id is strong evidence", () => {
  const rows = [
    { id: "person-a", displayName: "Ian", lineUserId: "U123" },
    { id: "person-b", displayName: "Ian", lineUserId: "U123" }
  ];
  const result = audit.classify(rows);
  assert.equal(result.hasStrongEvidence, true);
  assert.ok(result.evidenceEdges[0].shared.includes("lineUserId:U123"));
});

test("synthetic line profile id is excluded from formal identity evidence", () => {
  const a = { id: "person-a", profileId: "line:U123" };
  const b = { id: "person-b", profileId: "line:U123" };
  assert.equal(audit.ids(a).profileId, "");
  assert.equal(audit.ids(b).profileId, "");
  assert.deepEqual(audit.sharedStrongEvidence(a, b), []);
});

test("canonical and linked historical ids contribute evidence without using name", () => {
  const a = { id: "person-a", canonicalPersonId: "person-c", linkedPlayerIds: ["legacy-1"] };
  const b = { id: "person-b", canonicalPersonId: "person-c", linkedPlayerIds: ["legacy-1"] };
  const shared = audit.sharedStrongEvidence(a, b);
  assert.ok(shared.includes("canonicalPersonId:person-c"));
  assert.ok(shared.includes("linkedPlayerId:legacy-1"));
});
