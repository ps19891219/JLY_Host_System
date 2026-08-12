/*
JLY Host System

Module:
LINE Group Accounting Repository V1

Firestore path:
lineGroupAccounts/{groupId}/entries/{messageId}
*/

"use strict";

const {
  getFirestore
} = require(
  "./admin"
);

const COLLECTION_NAME =
  "lineGroupAccounts";

function normalizeText(value) {
  return String(value || "").trim();
}

async function saveGroupAccountingEntry(entry) {
  const source =
    entry && typeof entry === "object"
      ? entry
      : {};

  const groupId = normalizeText(source.groupId);
  const messageId = normalizeText(source.messageId);
  const userId = normalizeText(source.userId);
  const type = normalizeText(source.type);
  const description = normalizeText(source.description);
  const amount = Number(source.amount);

  if (!groupId) {
    throw new Error("LINE groupId is required.");
  }

  if (!messageId) {
    throw new Error("LINE messageId is required.");
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Accounting amount must be a positive integer.");
  }

  if (!description) {
    throw new Error("Accounting description is required.");
  }

  if (type !== "income" && type !== "expense") {
    throw new Error("Accounting type is invalid.");
  }

  const createdAt =
    normalizeText(source.createdAt) ||
    new Date().toISOString();

  const data = {
    groupId,
    messageId,
    userId,
    type,
    amount,
    description,
    source: "line_group",
    status: "active",
    createdAt,
    updatedAt: new Date().toISOString()
  };

  const db = getFirestore();
  const accountRef = db
    .collection(COLLECTION_NAME)
    .doc(groupId);
  const entryRef = accountRef
    .collection("entries")
    .doc(messageId);
  const auditRef = accountRef
    .collection("auditLogs")
    .doc();

  await db.runTransaction(async function (transaction) {
    const existing = await transaction.get(entryRef);

    if (existing.exists) {
      return;
    }

    transaction.set(entryRef, data, { merge: false });
    transaction.set(auditRef, {
      groupId,
      entryId: messageId,
      operation: "create",
      actorUserId: userId,
      authorityReason: "entry_creator",
      before: null,
      after: data,
      createdAt: data.updatedAt
    });
  });

  return data;
}

async function listGroupAccountingAuditLogs(
  groupId,
  limit = 10
) {
  const normalizedGroupId = normalizeText(groupId);

  if (!normalizedGroupId) {
    throw new Error("LINE groupId is required.");
  }

  const safeLimit = Math.min(
    Math.max(Number(limit) || 10, 1),
    20
  );

  const snapshot = await getFirestore()
    .collection(COLLECTION_NAME)
    .doc(normalizedGroupId)
    .collection("auditLogs")
    .orderBy("createdAt", "desc")
    .limit(safeLimit)
    .get();

  return snapshot.docs.map(function (document) {
    return { id: document.id, ...document.data() };
  });
}

async function listGroupAccountingEntries(
  groupId,
  options = {}
) {
  const normalizedGroupId =
    normalizeText(groupId);

  if (!normalizedGroupId) {
    throw new Error("LINE groupId is required.");
  }

  let query = getFirestore()
    .collection(COLLECTION_NAME)
    .doc(normalizedGroupId)
    .collection("entries")
    .orderBy("createdAt", "desc");

  const startAt = normalizeText(options.startAt);
  const endBefore = normalizeText(options.endBefore);

  if (startAt) {
    query = query.where(
      "createdAt",
      ">=",
      startAt
    );
  }

  if (endBefore) {
    query = query.where(
      "createdAt",
      "<",
      endBefore
    );
  }

  const snapshot = await query.get();

  return snapshot.docs.map(
    function (document) {
      return {
        id: document.id,
        ...document.data()
      };
    }
  ).filter(function (entry) {
    return entry.status !== "deleted";
  });
}

function getEntryCode(entryId) {
  const value = normalizeText(entryId);
  return value.slice(-8).toUpperCase();
}

async function findGroupAccountingEntryByCode(
  groupId,
  entryCode
) {
  const entries = await listGroupAccountingEntries(groupId);
  const normalizedCode = normalizeText(entryCode).toUpperCase();
  const matches = entries.filter(function (entry) {
    return getEntryCode(entry.id) === normalizedCode;
  });

  return matches.length === 1 ? matches[0] : null;
}

async function mutateGroupAccountingEntry(options) {
  const groupId = normalizeText(options.groupId);
  const entryId = normalizeText(options.entryId);
  const actorUserId = normalizeText(options.actorUserId);
  const operation = normalizeText(options.operation);
  const authorityReason = normalizeText(options.authorityReason);
  const changes = options.changes || {};
  const db = getFirestore();
  const accountRef = db.collection(COLLECTION_NAME).doc(groupId);
  const entryRef = accountRef.collection("entries").doc(entryId);
  const auditRef = accountRef.collection("auditLogs").doc();

  return db.runTransaction(async function (transaction) {
    const snapshot = await transaction.get(entryRef);

    if (!snapshot.exists) {
      return null;
    }

    const before = { id: snapshot.id, ...snapshot.data() };

    if (before.status === "deleted") {
      return null;
    }

    const now = new Date().toISOString();
    const after = operation === "delete"
      ? {
          ...before,
          status: "deleted",
          deletedAt: now,
          deletedBy: actorUserId,
          updatedAt: now
        }
      : {
          ...before,
          type: changes.type,
          amount: changes.amount,
          description: changes.description,
          updatedAt: now,
          updatedBy: actorUserId
        };

    const storedAfter = { ...after };
    delete storedAfter.id;

    transaction.set(entryRef, storedAfter, { merge: false });
    transaction.set(auditRef, {
      groupId,
      entryId,
      operation,
      actorUserId,
      authorityReason,
      before,
      after,
      createdAt: now
    });

    return after;
  });
}

module.exports = {
  COLLECTION_NAME,
  saveGroupAccountingEntry,
  listGroupAccountingEntries,
  getEntryCode,
  findGroupAccountingEntryByCode,
  mutateGroupAccountingEntry,
  listGroupAccountingAuditLogs
};
