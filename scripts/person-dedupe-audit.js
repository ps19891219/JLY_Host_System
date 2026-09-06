#!/usr/bin/env node
"use strict";

// READ-ONLY audit. This script never updates or deletes Firestore documents.
// Same-name records are candidates only. Auto-safe identity evidence must be strong and explicit.

const admin = require("firebase-admin");

function text(value) { return String(value || "").trim(); }
function norm(value) { return text(value).toLowerCase().replace(/\s+/g, ""); }
function isSyntheticLineId(value) { return text(value).toLowerCase().startsWith("line:"); }
function nameOf(row) { return text(row.displayName || row.nickname || row.playerName || row.lineDisplayName || row.name); }
function list(value) { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
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
  ["profileId", "identityId", "lineUserId"].forEach(field => {
    if (evidence[field]) keys.add(`${field}:${evidence[field]}`);
  });
  return [...keys];
}
function referenceKeys(row) {
  const evidence = ids(row);
  const keys = new Set();
  ["canonicalPersonId", "mergedIntoPersonId", "personId"].forEach(field => {
    if (evidence[field]) keys.add(`${field}:${evidence[field]}`);
  });
  evidence.linkedPlayerIds.forEach(value => keys.add(`linkedPlayerId:${value}`));
  return [...keys];
}
function sharedStrongEvidence(a, b) {
  const aKeys = new Set(strongKeys(a));
  return strongKeys(b).filter(key => aKeys.has(key));
}
function hasReferenceRelationship(a, b) {
  const aId = text(a.id); const bId = text(b.id);
  const ai = ids(a); const bi = ids(b);
  return [ai.canonicalPersonId, ai.mergedIntoPersonId, ai.personId, ...ai.linkedPlayerIds].includes(bId)
    || [bi.canonicalPersonId, bi.mergedIntoPersonId, bi.personId, ...bi.linkedPlayerIds].includes(aId);
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
  if (isSyntheticLineId(row.id)) n -= 1000;
  return n;
}
function classify(rows) {
  const strongEdges = [];
  const referenceEdges = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const shared = sharedStrongEvidence(rows[i], rows[j]);
      if (shared.length) strongEdges.push({ from: rows[i].id, to: rows[j].id, shared });
      if (hasReferenceRelationship(rows[i], rows[j])) referenceEdges.push({ from: rows[i].id, to: rows[j].id });
    }
  }
  const disposition = strongEdges.length ? "SAFE STRONG MATCH" : referenceEdges.length ? "REVIEW REQUIRED" : "SAME NAME ONLY";
  return { disposition, hasStrongEvidence: strongEdges.length > 0, strongEdges, referenceEdges };
}
function recommendCanonical(rows, classification) {
  if (classification.disposition === "SAME NAME ONLY") return null;
  const ranked = [...rows].sort((a, b) => score(b) - score(a) || text(a.id).localeCompare(text(b.id)));
  const top = ranked[0];
  const evidence = ids(top);
  const reasons = [];
  if (evidence.lineUserId) reasons.push("LINE_LINKED");
  if (evidence.identityId) reasons.push("IDENTITY_MATCH");
  if (evidence.profileId) reasons.push("PROFILE_MATCH");
  if (evidence.linkedPlayerIds.length) reasons.push("LINKED_HISTORY");
  if (classification.referenceEdges.some(edge => edge.to === top.id)) reasons.push("CANONICAL_REFERENCE");
  return { personId: top.id, score: score(top), reasons, recommendationOnly: true };
}

function initFirebase() {
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault() });
  return admin.firestore();
}
async function loadCollection(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function main() {
  const db = initFirebase();
  const players = await loadCollection(db, "players");
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
      classification: classification.disposition,
      warning: classification.disposition === "SAFE STRONG MATCH"
        ? "strong identity evidence exists; recommendation is still non-destructive until historical references are inventoried"
        : classification.disposition === "REVIEW REQUIRED"
          ? "reference relationship exists but is not sufficient identity proof; manual review required"
          : "same-name only; never auto-merge",
      canonicalRecommendation: recommendCanonical(ranked, classification),
      ...classification,
      records: ranked.map(row => ({ id: row.id, score: score(row), ...ids(row), strongKeys: strongKeys(row), referenceKeys: referenceKeys(row), source: text(row.source) }))
    });
  }
  const counts = candidates.reduce((out, item) => { out[item.classification] = (out[item.classification] || 0) + 1; return out; }, {});
  console.log(JSON.stringify({
    readOnly: true,
    collection: "players",
    totalPlayers: players.length,
    duplicateNameGroups: candidates.length,
    classifications: counts,
    safety: { writesFirestore: false, deletesFirestore: false, sameNameIsIdentityProof: false, syntheticLineProfileIsFormalIdentity: false },
    candidates
  }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { text, norm, isSyntheticLineId, nameOf, ids, strongKeys, referenceKeys, sharedStrongEvidence, hasReferenceRelationship, score, classify, recommendCanonical };
