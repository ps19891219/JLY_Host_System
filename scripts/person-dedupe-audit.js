#!/usr/bin/env node
"use strict";

// READ-ONLY audit. This script never updates or deletes Firestore documents.
// Same-name records are candidates only. Auto-safe identity evidence must be strong and explicit.

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();

function text(value) { return String(value || "").trim(); }
function norm(value) { return text(value).toLowerCase().replace(/\s+/g, ""); }
function isSyntheticLineId(value) { return text(value).toLowerCase().startsWith("line:"); }
function nameOf(row) {
  return text(row.displayName || row.nickname || row.playerName || row.lineDisplayName || row.name);
}
function list(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function ids(row) {
  return {
    canonicalPersonId: text(row.canonicalPersonId),
    mergedIntoPersonId: text(row.mergedIntoPersonId),
    personId: text(row.personId),
    profileId: isSyntheticLineId(row.profileId) ? "" : text(row.profileId),
    identityId: isSyntheticLineId(row.identityId) ? "" : text(row.identityId),
    lineUserId: text(row.lineUserId),
    linkedPlayerIds: list(row.linkedPlayerIds).filter(value => !isSyntheticLineId(value))
  };
}
function strongKeys(row) {
  const evidence = ids(row);
  const keys = new Set();
  if (text(row.id)) keys.add(`doc:${text(row.id)}`);
  ["canonicalPersonId", "mergedIntoPersonId", "personId", "profileId", "identityId", "lineUserId"].forEach(field => {
    if (evidence[field]) keys.add(`${field}:${evidence[field]}`);
  });
  evidence.linkedPlayerIds.forEach(value => keys.add(`linkedPlayerId:${value}`));
  return [...keys];
}
function sharedStrongEvidence(a, b) {
  const aKeys = new Set(strongKeys(a));
  return strongKeys(b).filter(key => aKeys.has(key));
}
function score(row) {
  const evidence = ids(row);
  let n = 0;
  if (evidence.lineUserId) n += 100;
  if (evidence.identityId) n += 60;
  if (evidence.profileId) n += 40;
  if (evidence.canonicalPersonId && evidence.canonicalPersonId === text(row.id)) n += 35;
  if (evidence.personId && evidence.personId === text(row.id)) n += 30;
  n += Math.min(evidence.linkedPlayerIds.length, 20);
  return n;
}
function classify(rows) {
  const edges = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const shared = sharedStrongEvidence(rows[i], rows[j]);
      if (shared.length) edges.push({ from: rows[i].id, to: rows[j].id, shared });
    }
  }
  return {
    disposition: edges.length ? "strong_evidence_review" : "manual_same_name_review",
    hasStrongEvidence: edges.length > 0,
    evidenceEdges: edges
  };
}

async function loadCollection(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function main() {
  const players = await loadCollection("players");
  const byName = new Map();
  players.forEach(row => {
    const key = norm(nameOf(row));
    if (!key) return;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  });

  const candidates = [];
  for (const rows of byName.values()) {
    if (rows.length < 2) continue;
    const ranked = [...rows].sort((a, b) => score(b) - score(a) || text(a.id).localeCompare(text(b.id)));
    const classification = classify(ranked);
    candidates.push({
      name: nameOf(ranked[0]),
      warning: classification.hasStrongEvidence
        ? "strong identity evidence exists; still verify historical references before migration/deletion"
        : "same-name only; never auto-merge, host/manual review required",
      suggestedCanonicalId: classification.hasStrongEvidence ? ranked[0].id : null,
      ...classification,
      records: ranked.map(row => ({
        id: row.id,
        score: score(row),
        ...ids(row),
        strongKeys: strongKeys(row),
        source: text(row.source)
      }))
    });
  }

  const strongEvidenceGroups = candidates.filter(group => group.hasStrongEvidence).length;
  console.log(JSON.stringify({
    readOnly: true,
    collection: "players",
    totalPlayers: players.length,
    duplicateNameGroups: candidates.length,
    strongEvidenceGroups,
    manualSameNameGroups: candidates.length - strongEvidenceGroups,
    safety: {
      writesFirestore: false,
      deletesFirestore: false,
      sameNameIsIdentityProof: false,
      syntheticLineProfileIsFormalIdentity: false
    },
    candidates
  }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { text, norm, isSyntheticLineId, nameOf, ids, strongKeys, sharedStrongEvidence, score, classify };
