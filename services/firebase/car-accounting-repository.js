"use strict";

const { getFirestore } = require("./admin");

function normalizeText(value) {
  return String(value || "").trim();
}

function getCarRef(db, carId) {
  return db.collection("cars").doc(carId);
}

async function saveCarAccountingEntry(entry) {
  const carId = normalizeText(entry.carId);
  const entryId = normalizeText(entry.messageId || entry.entryId);
  const db = getFirestore();
  const carRef = getCarRef(db, carId);
  const entryRef = carRef.collection("accountingEntries").doc(entryId);
  const auditRef = carRef.collection("accountingAuditLogs").doc();
  const now = new Date().toISOString();
  const data = {
    carId,
    groupId: normalizeText(entry.groupId),
    messageId: entryId,
    userId: normalizeText(entry.userId),
    type: normalizeText(entry.type),
    amount: Number(entry.amount),
    description: normalizeText(entry.description),
    source: normalizeText(entry.source) || "line_group",
    status: "active",
    createdAt: normalizeText(entry.createdAt) || now,
    updatedAt: now
  };

  await db.runTransaction(async function (transaction) {
    const existing = await transaction.get(entryRef);
    if (existing.exists) return;

    transaction.set(entryRef, data, { merge: false });
    transaction.set(auditRef, {
      carId,
      groupId: data.groupId,
      entryId,
      operation: "create",
      actorUserId: data.userId,
      actorMemberId: normalizeText(entry.actorMemberId),
      actorDisplayName: normalizeText(entry.actorDisplayName),
      authorityReason: "entry_creator",
      before: null,
      after: data,
      createdAt: now
    });
  });

  return data;
}

async function listCarAccountingEntries(carId, options = {}) {
  let query = getFirestore()
    .collection("cars")
    .doc(normalizeText(carId))
    .collection("accountingEntries")
    .orderBy("createdAt", "desc");

  if (options.startAt) {
    query = query.where("createdAt", ">=", options.startAt);
  }
  if (options.endBefore) {
    query = query.where("createdAt", "<", options.endBefore);
  }

  const snapshot = await query.get();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(entry => entry.status !== "deleted");
}

function getEntryCode(entryId) {
  return normalizeText(entryId).slice(-8).toUpperCase();
}

async function findCarAccountingEntryByCode(carId, entryCode) {
  const code = normalizeText(entryCode).toUpperCase();
  const entries = await listCarAccountingEntries(carId);
  const matches = entries.filter(
    entry => getEntryCode(entry.id) === code
  );
  return matches.length === 1 ? matches[0] : null;
}

async function mutateCarAccountingEntry(options) {
  const db = getFirestore();
  const carRef = getCarRef(db, normalizeText(options.carId));
  const entryRef = carRef
    .collection("accountingEntries")
    .doc(normalizeText(options.entryId));
  const auditRef = carRef.collection("accountingAuditLogs").doc();

  return db.runTransaction(async function (transaction) {
    const snapshot = await transaction.get(entryRef);
    if (!snapshot.exists) return null;

    const before = { id: snapshot.id, ...snapshot.data() };
    if (before.status === "deleted") return null;

    const now = new Date().toISOString();
    const after = options.operation === "delete"
      ? {
          ...before,
          status: "deleted",
          deletedAt: now,
          deletedBy: options.actorUserId,
          updatedAt: now
        }
      : {
          ...before,
          type: options.changes.type,
          amount: options.changes.amount,
          description: options.changes.description,
          updatedAt: now,
          updatedBy: options.actorUserId
        };
    const storedAfter = { ...after };
    delete storedAfter.id;

    transaction.set(entryRef, storedAfter, { merge: false });
    transaction.set(auditRef, {
      carId: options.carId,
      groupId: before.groupId || "",
      entryId: options.entryId,
      operation: options.operation,
      actorUserId: options.actorUserId,
      actorMemberId: normalizeText(options.actorMemberId),
      actorDisplayName: normalizeText(options.actorDisplayName),
      authorityReason: options.authorityReason,
      before,
      after,
      createdAt: now
    });
    return after;
  });
}

async function listCarAccountingAuditLogs(carId, limit = 10) {
  const snapshot = await getFirestore()
    .collection("cars")
    .doc(normalizeText(carId))
    .collection("accountingAuditLogs")
    .orderBy("createdAt", "desc")
    .limit(Math.min(Math.max(Number(limit) || 10, 1), 20))
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function migrateLegacyGroupAccounting(carId, groupId, entries) {
  const list = Array.isArray(entries) ? entries : [];
  const migrationRef = getFirestore()
    .collection("cars")
    .doc(carId)
    .collection("accountingMigrations")
    .doc(`line-group-${groupId}`);
  const existingMigration = await migrationRef.get();
  if (existingMigration.exists) {
    return {
      migrated: 0,
      alreadyMigrated: true
    };
  }
  let migrated = 0;

  for (const entry of list) {
    await saveCarAccountingEntry({
      ...entry,
      carId,
      groupId,
      entryId: entry.id,
      messageId: entry.id,
      source: "line_group_migration"
    });
    migrated += 1;
  }

  await migrationRef.set({
      source: "lineGroupAccounts",
      groupId,
      migratedCount: migrated,
      migratedAt: new Date().toISOString()
    }, { merge: true });

  return { migrated };
}

module.exports = {
  saveCarAccountingEntry,
  listCarAccountingEntries,
  findCarAccountingEntryByCode,
  mutateCarAccountingEntry,
  listCarAccountingAuditLogs,
  migrateLegacyGroupAccounting
};
