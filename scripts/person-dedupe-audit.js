#!/usr/bin/env node
"use strict";

// READ-ONLY audit. This script never updates or deletes Firestore documents.
// Same-name is candidate discovery only. Safe identity requires consistent strong evidence.

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
function sameNameCandidate(a, b) {
  const left = norm(nameOf(a));
  const right = norm(nameOf(b));
  return Boolean(left && right && left === right);
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

function strongConflicts(rows) {
  const conflicts = [];
  ["lineUserId", "identityId", "profileId"].forEach(field => {
    const values = [...new Set(rows.map(row => ids(row)[field]).filter(Boolean))];
    if (values.length > 1) conflicts.push({ field, values });
  });
  return conflicts;
}

function strongGraphConnected(rows, strongEdges) {
  if (rows.length < 2) return false;
  const adjacency = new Map(rows.map(row => [text(row.id), new Set()]));
  strongEdges.forEach(edge => {
    adjacency.get(text(edge.from))?.add(text(edge.to));
    adjacency.get(text(edge.to))?.add(text(edge.from));
  });
  const start = text(rows[0].id);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current) || []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen.size === rows.length;
}

function classify(rows) {
  const strongEdges = [];
  const referenceEdges = [];
  const sameNameEdges = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const shared = sharedStrongEvidence(rows[i], rows[j]);
      if (shared.length) strongEdges.push({ from: rows[i].id, to: rows[j].id, shared });
      if (hasReferenceRelationship(rows[i], rows[j])) referenceEdges.push({ from: rows[i].id, to: rows[j].id });
      if (sameNameCandidate(rows[i], rows[j])) sameNameEdges.push({ from: rows[i].id, to: rows[j].id });
    }
  }
  const conflicts = strongConflicts(rows);
  const allRowsStronglyConnected = strongGraphConnected(rows, strongEdges);
  let disposition = "SAME NAME ONLY";
  if (conflicts.length > 0) disposition = "REVIEW REQUIRED";
  else if (strongEdges.length > 0 && allRowsStronglyConnected) disposition = "SAFE STRONG MATCH";
  else if (strongEdges.length > 0 || referenceEdges.length > 0) disposition = "REVIEW REQUIRED";
  return {
    disposition,
    hasStrongEvidence: strongEdges.length > 0,
    allRowsStronglyConnected,
    strongConflicts: conflicts,
    strongEdges,
    referenceEdges,
    sameNameEdges
  };
}

function recommendCanonical(rows, classification) {
  if (!classification || classification.disposition === "SAME NAME ONLY") return null;
  const ranked = [...rows].sort((a, b) => score(b) - score(a) || text(a.id).localeCompare(text(b.id)));
  const topScore = score(ranked[0]);
  const tied = ranked.filter(row => score(row) === topScore);
  if (tied.length > 1) {
    return {
      personId: null,
      score: topScore,
      reasons: ["CANONICAL_TIE_REQUIRES_REVIEW"],
      tiedPersonIds: tied.map(row => text(row.id)),
      recommendationOnly: true
    };
  }
  const top = ranked[0];
  const evidence = ids(top);
  const reasons = [];
  if (evidence.lineUserId) reasons.push("LINE_LINKED");
  if (evidence.identityId) reasons.push("IDENTITY_MATCH");
  if (evidence.profileId) reasons.push("PROFILE_MATCH");
  if (evidence.linkedPlayerIds.length) reasons.push("LINKED_HISTORY");
  if ((classification.referenceEdges || []).some(edge => edge.to === top.id)) reasons.push("CANONICAL_REFERENCE");
  return { personId: top.id, score: topScore, reasons, recommendationOnly: true };
}

function buildCandidateGroups(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const parent = source.map((_, index) => index);
  function find(index) {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  }
  function union(a, b) {
    const left = find(a); const right = find(b);
    if (left !== right) parent[right] = left;
  }
  for (let i = 0; i < source.length; i += 1) {
    for (let j = i + 1; j < source.length; j += 1) {
      if (sameNameCandidate(source[i], source[j]) || sharedStrongEvidence(source[i], source[j]).length || hasReferenceRelationship(source[i], source[j])) {
        union(i, j);
      }
    }
  }
  const groups = new Map();
  source.forEach((row, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(row);
  });
  return [...groups.values()].filter(group => group.length > 1);
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
  const candidates = buildCandidateGroups(players).map(rows => {
    const ranked = [...rows].sort((a, b) => score(b) - score(a) || text(a.id).localeCompare(text(b.id)));
    const classification = classify(ranked);
    return {
      names: [...new Set(ranked.map(nameOf).filter(Boolean))],
      classification: classification.disposition,
      warning: classification.disposition === "SAFE STRONG MATCH"
        ? "all candidate records are connected by consistent strong identity evidence; recommendation is still non-destructive until historical references are inventoried"
        : classification.strongConflicts.length
          ? "contradictory strong identity values detected; manual review required"
          : classification.disposition === "REVIEW REQUIRED"
            ? "candidate relationship exists but does not safely prove every record is the same Person"
            : "same-name only; never auto-merge",
      canonicalRecommendation: recommendCanonical(ranked, classification),
      ...classification,
      records: ranked.map(row => ({ id: row.id, name: nameOf(row), score: score(row), ...ids(row), strongKeys: strongKeys(row), referenceKeys: referenceKeys(row), source: text(row.source) }))
    };
  });
  const counts = candidates.reduce((out, item) => { out[item.classification] = (out[item.classification] || 0) + 1; return out; }, {});
  console.log(JSON.stringify({
    readOnly: true,
    collection: "players",
    totalPlayers: players.length,
    candidateGroups: candidates.length,
    candidateDiscovery: ["same normalized name", "shared lineUserId", "shared identityId", "shared formal profileId", "explicit canonical/merged/person/linkedPlayer relationship"],
    classifications: counts,
    safety: { writesFirestore: false, deletesFirestore: false, sameNameIsIdentityProof: false, syntheticLineProfileIsFormalIdentity: false, contradictoryStrongEvidenceIsSafe: false },
    candidates
  }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { text, norm, isSyntheticLineId, nameOf, ids, strongKeys, referenceKeys, sharedStrongEvidence, hasReferenceRelationship, sameNameCandidate, score, strongConflicts, strongGraphConnected, classify, recommendCanonical, buildCandidateGroups };
