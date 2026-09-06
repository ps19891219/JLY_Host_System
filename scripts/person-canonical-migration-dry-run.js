#!/usr/bin/env node
"use strict";

/**
 * Person canonical migration DRY RUN.
 *
 * This tool intentionally has no apply mode and no Firestore write calls.
 * It inventories every Firestore document reachable from top-level collections,
 * including nested car/accounting/reminder/application subcollections, then
 * reports exact fields containing candidate Person ids.
 */

const admin = require("firebase-admin");
const audit = require("./person-dedupe-audit");

function initFirebase() {
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault() });
  return admin.firestore();
}

function findIdReferences(value, targetIds, fieldPath = "", out = []) {
  if (typeof value === "string") {
    if (targetIds.has(value)) out.push({ fieldPath, personId: value });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findIdReferences(item, targetIds, `${fieldPath}[${index}]`, out));
    return out;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => findIdReferences(item, targetIds, fieldPath ? `${fieldPath}.${key}` : key, out));
  }
  return out;
}

function referenceDomain(documentPath, fieldPath) {
  const value = `${documentPath}.${fieldPath}`.toLowerCase();
  if (/account|transaction|split|settlement|obligation/.test(value)) return "ACCOUNTING";
  if (/pending/.test(value)) return "PENDING_ACTION";
  if (/seat/.test(value)) return "SEAT";
  if (/dmapplication|application/.test(value)) return "APPLICATION";
  if (/staff|dm/.test(value)) return "STAFF_DM";
  if (/line|identity|profile/.test(value)) return "LINE_PROFILE_IDENTITY";
  if (/calendar/.test(value)) return "CALENDAR";
  if (/reminder/.test(value)) return "REMINDER";
  if (/member|player/.test(value)) return "MEMBERSHIP_PLAYER";
  if (/car/.test(value)) return "CAR";
  return "OTHER";
}

async function walkCollection(collectionRef, visitor) {
  const snapshot = await collectionRef.get();
  for (const doc of snapshot.docs) {
    await visitor(doc);
    const subcollections = await doc.ref.listCollections();
    for (const subcollection of subcollections) await walkCollection(subcollection, visitor);
  }
}

async function inventoryAllReferences(db, targetIds) {
  const references = [];
  const topCollections = await db.listCollections();
  for (const collection of topCollections) {
    await walkCollection(collection, async doc => {
      const hits = findIdReferences(doc.data(), targetIds);
      hits.forEach(hit => references.push({
        personId: hit.personId,
        documentPath: doc.ref.path,
        fieldPath: hit.fieldPath,
        domain: referenceDomain(doc.ref.path, hit.fieldPath)
      }));
    });
  }
  return references;
}

function buildGroups(players) {
  const byName = new Map();
  players.forEach(row => {
    const key = audit.norm(audit.nameOf(row));
    if (!key) return;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  });
  return [...byName.values()].filter(rows => rows.length > 1).map(rows => {
    const ranked = [...rows].sort((a, b) => audit.score(b) - audit.score(a) || audit.text(a.id).localeCompare(audit.text(b.id)));
    const classification = audit.classify(ranked);
    return { rows: ranked, classification, recommendation: audit.recommendCanonical(ranked, classification) };
  });
}

function buildMigrationPlans(groups, references) {
  return groups.map(group => {
    const canonicalId = group.recommendation && group.recommendation.personId;
    const personIds = group.rows.map(row => row.id);
    const groupRefs = references.filter(ref => personIds.includes(ref.personId));
    const byDomain = groupRefs.reduce((out, ref) => {
      if (!out[ref.domain]) out[ref.domain] = [];
      out[ref.domain].push(ref);
      return out;
    }, {});
    return {
      name: audit.nameOf(group.rows[0]),
      classification: group.classification.disposition,
      canonicalRecommendation: group.recommendation,
      migrationStatus: group.classification.disposition === "SAFE STRONG MATCH" ? "DRY_RUN_CANDIDATE" : "BLOCKED_FOR_REVIEW",
      moves: canonicalId ? personIds.filter(id => id !== canonicalId).map(fromPersonId => ({
        fromPersonId,
        toPersonId: canonicalId,
        references: groupRefs.filter(ref => ref.personId === fromPersonId),
        writesPerformed: false
      })) : [],
      historicalReferenceInventory: byDomain,
      personIds
    };
  });
}

async function main() {
  const db = initFirebase();
  const playerSnap = await db.collection("players").get();
  const players = playerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const groups = buildGroups(players);
  const targetIds = new Set(groups.flatMap(group => group.rows.map(row => row.id)));
  const references = await inventoryAllReferences(db, targetIds);
  const plans = buildMigrationPlans(groups, references);
  const domainCounts = references.reduce((out, ref) => { out[ref.domain] = (out[ref.domain] || 0) + 1; return out; }, {});

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: "DRY_RUN_READ_ONLY",
    safety: {
      applyModeExists: false,
      writesFirestore: false,
      deletesFirestore: false,
      sameNameCreatesMigrationPlan: false
    },
    summary: {
      candidateGroups: groups.length,
      candidatePersonIds: targetIds.size,
      historicalReferences: references.length,
      referenceDomains: domainCounts
    },
    coverage: {
      strategy: "recursive Firestore traversal; all current top-level collections and nested subcollections",
      expectedDomains: ["CAR", "MEMBERSHIP_PLAYER", "STAFF_DM", "APPLICATION", "SEAT", "ACCOUNTING", "PENDING_ACTION", "CALENDAR", "REMINDER", "LINE_PROFILE_IDENTITY", "OTHER"]
    },
    plans
  }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { findIdReferences, referenceDomain, buildGroups, buildMigrationPlans };
