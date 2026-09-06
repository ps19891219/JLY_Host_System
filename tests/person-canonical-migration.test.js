"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const audit = require("../scripts/person-dedupe-audit");
const dryRun = require("../scripts/person-canonical-migration-dry-run");

test("same name alone never becomes a merge recommendation", () => {
  const rows = [{ id: "p1", playerName: "Ian" }, { id: "p2", playerName: "Ian" }];
  const classification = audit.classify(rows);
  assert.equal(classification.disposition, "SAME NAME ONLY");
  assert.equal(audit.recommendCanonical(rows, classification), null);
});

test("shared LINE identity is classified as safe strong match", () => {
  const rows = [
    { id: "p1", playerName: "Ian", lineUserId: "U123" },
    { id: "p2", playerName: "Ian", lineUserId: "U123" }
  ];
  const classification = audit.classify(rows);
  assert.equal(classification.disposition, "SAFE STRONG MATCH");
  assert.equal(classification.hasStrongEvidence, true);
});

test("canonical or linked history relationship requires review without strong identity", () => {
  const rows = [
    { id: "p1", playerName: "Ian", canonicalPersonId: "p2" },
    { id: "p2", playerName: "Ian" }
  ];
  assert.equal(audit.classify(rows).disposition, "REVIEW REQUIRED");
});

test("line provisional ids are penalized as canonical candidates", () => {
  const formal = { id: "person-1", lineUserId: "U123" };
  const provisional = { id: "line:U123", lineUserId: "U123" };
  assert.ok(audit.score(formal) > audit.score(provisional));
});

test("recursive value inspection finds Person ids in nested membership/accounting shapes", () => {
  const hits = dryRun.findIdReferences({
    players: [{ personId: "p1" }],
    accounting: { obligations: [{ responsiblePersonId: "p2" }] }
  }, new Set(["p1", "p2"]));
  assert.deepEqual(hits.map(hit => hit.personId).sort(), ["p1", "p2"]);
});

test("dry-run migration plan blocks same-name-only groups", () => {
  const rows = [{ id: "p1", playerName: "Ian" }, { id: "p2", playerName: "Ian" }];
  const classification = audit.classify(rows);
  const plans = dryRun.buildMigrationPlans([{ rows, classification, recommendation: null }], []);
  assert.equal(plans[0].migrationStatus, "BLOCKED_FOR_REVIEW");
  assert.deepEqual(plans[0].moves, []);
});
