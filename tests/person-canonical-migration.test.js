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
    { id: "p2", playerName: "Ian", lineUserId: "U123", identityId: "identity-1" }
  ];
  const classification = audit.classify(rows);
  assert.equal(classification.disposition, "SAFE STRONG MATCH");
  assert.equal(classification.hasStrongEvidence, true);
  assert.equal(classification.allRowsStronglyConnected, true);
});

test("strong identity creates a candidate group even when names changed", () => {
  const groups = audit.buildCandidateGroups([
    { id: "p1", displayName: "小安", lineUserId: "U123" },
    { id: "p2", displayName: "安安", lineUserId: "U123" },
    { id: "p3", displayName: "完全不同的人" }
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].map(row => row.id).sort(), ["p1", "p2"]);
});

test("contradictory strong LINE identities force manual review", () => {
  const rows = [
    { id: "p1", playerName: "Ian", lineUserId: "U111", profileId: "profile-1" },
    { id: "p2", playerName: "Ian", lineUserId: "U222", profileId: "profile-1" }
  ];
  const classification = audit.classify(rows);
  assert.equal(classification.disposition, "REVIEW REQUIRED");
  assert.equal(classification.strongConflicts[0].field, "lineUserId");
});

test("partial strong edge cannot make an entire mixed group safe", () => {
  const rows = [
    { id: "p1", playerName: "Ian", lineUserId: "U123" },
    { id: "p2", playerName: "Ian", lineUserId: "U123" },
    { id: "p3", playerName: "Ian" }
  ];
  const classification = audit.classify(rows);
  assert.equal(classification.disposition, "REVIEW REQUIRED");
  assert.equal(classification.allRowsStronglyConnected, false);
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

test("historical personId and linkedPlayerIds become reference aliases but line provisional ids do not", () => {
  const aliases = dryRun.personReferenceAliases({
    id: "person-1",
    personId: "legacy-person-1",
    linkedPlayerIds: ["legacy-player-1", "line:U123"]
  });
  assert.deepEqual(aliases.sort(), ["legacy-person-1", "legacy-player-1", "person-1"]);
});

test("ambiguous historical alias blocks dry-run migration moves", () => {
  const rows = [
    { id: "p1", playerName: "Ian", lineUserId: "U123", linkedPlayerIds: ["legacy-shared"] },
    { id: "p2", playerName: "Ian", lineUserId: "U123", linkedPlayerIds: ["legacy-shared"] }
  ];
  const classification = audit.classify(rows);
  const recommendation = { personId: "p1", score: 100, reasons: ["LINE_LINKED"], recommendationOnly: true };
  const refs = [{ matchedAlias: "legacy-shared", ownerPersonIds: ["p1", "p2"], documentPath: "cars/c1", fieldPath: "players[0].personId", domain: "MEMBERSHIP_PLAYER" }];
  const plans = dryRun.buildMigrationPlans([{ rows, classification, recommendation }], refs);
  assert.equal(plans[0].migrationStatus, "BLOCKED_FOR_REVIEW");
  assert.ok(plans[0].migrationBlockers.includes("AMBIGUOUS_HISTORICAL_ALIAS"));
  assert.deepEqual(plans[0].moves, []);
});

test("dry-run migration plan blocks same-name-only groups", () => {
  const rows = [{ id: "p1", playerName: "Ian" }, { id: "p2", playerName: "Ian" }];
  const classification = audit.classify(rows);
  const plans = dryRun.buildMigrationPlans([{ rows, classification, recommendation: null }], []);
  assert.equal(plans[0].migrationStatus, "BLOCKED_FOR_REVIEW");
  assert.deepEqual(plans[0].moves, []);
});
