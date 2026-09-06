#!/usr/bin/env node
"use strict";

/**
 * Person canonical migration DRY RUN.
 * No apply mode. No Firestore writes/deletes.
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

function personReferenceAliases(row) {
  const aliases = new Set();
  const ownId = audit.text(row && row.id);
  if (ownId && !audit.isSyntheticLineId(ownId)) aliases.add(ownId);
  const evidence = audit.ids(row || {});
  if (evidence.personId && !audit.isSyntheticLineId(evidence.personId)) aliases.add(evidence.personId);
  evidence.linkedPlayerIds.forEach(value => {
    if (!audit.isSyntheticLineId(value)) aliases.add(value);
  });
  return [...aliases];
}

function buildAliasOwners(groups) {
  const aliasOwners = new Map();
  (Array.isArray(groups) ? groups : []).forEach(group => {
    group.rows.forEach(row => {
      personReferenceAliases(row).forEach(alias => {
        if (!aliasOwners.has(alias)) aliasOwners.set(alias, new Set());
        aliasOwners.get(alias).add(audit.text(row.id));
      });
    });
  });
  return aliasOwners;
}

async function walkCollection(collectionRef, visitor) {
  const snapshot = await collectionRef.get();
  for (const doc of snapshot.docs) {
    await visitor(doc);
    const subcollections = await doc.ref.listCollections();
    for (const subcollection of subcollections) await walkCollection(subcollection, visitor);
  }
}

async function inventoryAllReferences(db, aliasOwners) {
  const references = [];
  const targetIds = new Set(aliasOwners.keys());
  const topCollections = await db.listCollections();
  for (const collection of topCollections) {
    await walkCollection(collection, async doc => {
      const hits = findIdReferences(doc.data(), targetIds);
      hits.forEach(hit => references.push({
        matchedAlias: hit.personId,
        ownerPersonIds: [...(aliasOwners.get(hit.personId) || [])],
        documentPath: doc.ref.path,
        fieldPath: hit.fieldPath,
        domain: referenceDomain(doc.ref.path, hit.fieldPath)
      }));
    });
  }
  return references;
}

function buildGroups(players) {
  return audit.buildCandidateGroups(players).map(rows => {
    const ranked = [...rows].sort((a, b) => audit.score(b) - audit.score(a) || audit.text(a.id).localeCompare(audit.text(b.id)));
    const classification = audit.classify(ranked);
    return { rows: ranked, classification, recommendation: audit.recommendCanonical(ranked, classification) };
  });
}

function buildMigrationPlans(groups, references) {
  return groups.map(group => {
    const canonicalId = group.recommendation && group.recommendation.personId;
    const personIds = group.rows.map(row => audit.text(row.id));
    const aliasesByPerson = Object.fromEntries(group.rows.map(row => [audit.text(row.id), personReferenceAliases(row)]));
    const groupRefs = references.filter(ref => ref.ownerPersonIds.some(id => personIds.includes(id)));
    const ambiguousRefs = groupRefs.filter(ref => ref.ownerPersonIds.length > 1);
    const byDomain = groupRefs.reduce((out, ref) => {
      if (!out[ref.domain]) out[ref.domain] = [];
      out[ref.domain].push(ref);
      return out;
    }, {});
    const safeCandidate = group.classification.disposition === "SAFE STRONG MATCH" && canonicalId && ambiguousRefs.length === 0;
    return {
      names: [...new Set(group.rows.map(audit.nameOf).filter(Boolean))],
      classification: group.classification.disposition,
      strongConflicts: group.classification.strongConflicts || [],
      canonicalRecommendation: group.recommendation,
      migrationStatus: safeCandidate ? "DRY_RUN_CANDIDATE" : "BLOCKED_FOR_REVIEW",
      migrationBlockers: [
        ...(group.classification.disposition !== "SAFE STRONG MATCH" ? ["IDENTITY_REVIEW_REQUIRED"] : []),
        ...(!canonicalId ? ["NO_UNIQUE_CANONICAL_RECOMMENDATION"] : []),
        ...(ambiguousRefs.length ? ["AMBIGUOUS_HISTORICAL_ALIAS"] : [])
      ],
      moves: safeCandidate ? personIds.filter(id => id !== canonicalId).map(fromPersonId => ({
        fromPersonId,
        toPersonId: canonicalId,
        aliases: aliasesByPerson[fromPersonId],
        references: groupRefs.filter(ref => ref.ownerPersonIds.includes(fromPersonId)),
        writesPerformed: false
      })) : [],
      historicalReferenceInventory: byDomain,
      ambiguousHistoricalReferences: ambiguousRefs,
      aliasesByPerson,
      personIds
    };
  });
}

async function main() {
  const db = initFirebase();
  const playerSnap = await db.collection("players").get();
  const players = playerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const groups = buildGroups(players);
  const aliasOwners = buildAliasOwners(groups);
  const references = await inventoryAllReferences(db, aliasOwners);
  const plans = buildMigrationPlans(groups, references);
  const domainCounts = references.reduce((out, ref) => { out[ref.domain] = (out[ref.domain] || 0) + 1; return out; }, {});

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: "DRY_RUN_READ_ONLY",
    safety: {
      applyModeExists: false,
      writesFirestore: false,
      deletesFirestore: false,
      sameNameCreatesMigrationPlan: false,
      syntheticLineIdUsedAsPersonAlias: false,
      ambiguousAliasCanMigrate: false
    },
    summary: {
      candidateGroups: groups.length,
      candidatePersonIds: new Set(groups.flatMap(group => group.rows.map(row => audit.text(row.id)))).size,
      candidateReferenceAliases: aliasOwners.size,
      historicalReferences: references.length,
      referenceDomains: domainCounts
    },
    coverage: {
      strategy: "recursive Firestore traversal; candidate document ids + formal historical personId/linkedPlayerIds aliases; all current top-level collections and nested subcollections",
      expectedDomains: ["CAR", "MEMBERSHIP_PLAYER", "STAFF_DM", "APPLICATION", "SEAT", "ACCOUNTING", "PENDING_ACTION", "CALENDAR", "REMINDER", "LINE_PROFILE_IDENTITY", "OTHER"]
    },
    plans
  }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { findIdReferences, referenceDomain, personReferenceAliases, buildAliasOwners, buildGroups, buildMigrationPlans };
