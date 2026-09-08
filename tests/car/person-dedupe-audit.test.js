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
  assert.equal(result.disposition, "SAME NAME ONLY");
  assert.deepEqual(result.strongEdges, []);
  assert.equal(result.sameNameEdges.length, 1);
});

test("shared LINE user id is strong evidence", () => {
  const rows = [
    { id: "person-a", displayName: "Ian", lineUserId: "U123" },
    { id: "person-b", displayName: "Ian", lineUserId: "U123" }
  ];
  const result = audit.classify(rows);
  assert.equal(result.hasStrongEvidence, true);
  assert.equal(result.disposition, "SAFE STRONG MATCH");
  assert.ok(result.strongEdges[0].shared.includes("lineUserId:U123"));
});

test("synthetic line profile id is excluded from formal identity evidence", () => {
  const a = { id: "person-a", profileId: "line:U123" };
  const b = { id: "person-b", profileId: "line:U123" };
  assert.equal(audit.ids(a).profileId, "");
  assert.equal(audit.ids(b).profileId, "");
  assert.deepEqual(audit.sharedStrongEvidence(a, b), []);
});

test("canonical and linked historical ids are reference evidence, not strong identity proof", () => {
  const a = {
    id: "person-a",
    canonicalPersonId: "person-b",
    linkedPlayerIds: ["legacy-1"]
  };
  const b = {
    id: "person-b",
    linkedPlayerIds: ["legacy-1"]
  };

  assert.deepEqual(audit.sharedStrongEvidence(a, b), []);
  assert.ok(audit.referenceKeys(a).includes("canonicalPersonId:person-b"));
  assert.ok(audit.referenceKeys(a).includes("linkedPlayerId:legacy-1"));
  assert.equal(audit.hasReferenceRelationship(a, b), true);

  const result = audit.classify([a, b]);
  assert.equal(result.hasStrongEvidence, false);
  assert.equal(result.disposition, "REVIEW REQUIRED");
  assert.equal(result.referenceEdges.length, 1);
});
