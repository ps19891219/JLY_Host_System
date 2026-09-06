#!/usr/bin/env node
"use strict";

// READ-ONLY audit. This script never updates or deletes Firestore documents.
// It intentionally treats same-name records as candidates only, never as proof of identity.

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();

function text(value) { return String(value || "").trim(); }
function norm(value) { return text(value).toLowerCase().replace(/\s+/g, ""); }
function nameOf(row) {
  return text(row.displayName || row.nickname || row.playerName || row.lineDisplayName || row.name);
}
function ids(row) {
  return {
    personId: text(row.personId), profileId: text(row.profileId), identityId: text(row.identityId),
    lineUserId: text(row.lineUserId), linkedPlayerIds: Array.isArray(row.linkedPlayerIds) ? row.linkedPlayerIds.map(text).filter(Boolean) : []
  };
}
function score(row) {
  const evidence = ids(row);
  let n = 0;
  if (evidence.lineUserId) n += 100;
  if (evidence.identityId) n += 60;
  if (evidence.profileId) n += 40;
  if (evidence.personId) n += 30;
  n += Math.min(evidence.linkedPlayerIds.length, 20);
  return n;
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
    const ranked = [...rows].sort((a, b) => score(b) - score(a));
    candidates.push({
      name: nameOf(ranked[0]),
      warning: "same-name is not identity proof; host/manual review required before migration",
      suggestedCanonicalId: ranked[0].id,
      records: ranked.map(row => ({ id: row.id, score: score(row), ...ids(row), source: text(row.source) }))
    });
  }

  console.log(JSON.stringify({
    readOnly: true,
    collection: "players",
    totalPlayers: players.length,
    duplicateNameGroups: candidates.length,
    candidates
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});