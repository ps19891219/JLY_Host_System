"use strict";

const { getFirestore } = require("./admin");

function normalizeText(value) {
  return String(value || "").trim();
}

function getCarRef(db, carId) {
  return db.collection("cars").doc(carId);
}

function getViewRef(carRef, name = "current") {
  return carRef.collection("accountingViews").doc(name);
}

function activeEntry(entry) {
  return entry && entry.status !== "deleted";
}

function compactEntry(entry) {
  return {
    id: normalizeText(entry.id || entry.messageId),
    type: normalizeText(entry.type),
    amount: Number(entry.amount) || 0,
    description: normalizeText(entry.description),
    actorMemberId: normalizeText(entry.actorMemberId),
    actorDisplayName: normalizeText(entry.actorDisplayName),
    payerMemberId: normalizeText(entry.payerMemberId),
    payerDisplayName: normalizeText(entry.payerDisplayName),
    shares: Array.isArray(entry.shares) ? entry.shares : [],
    createdAt: normalizeText(entry.createdAt),
    updatedAt: normalizeText(entry.updatedAt)
  };
}

function buildMemberBalances(entries) {
  const balances = new Map();
  function member(id, name) {
    const memberId = normalizeText(id);
    if (!memberId) return null;
    if (!balances.has(memberId)) {
      balances.set(memberId, {
        memberId,
        displayName: normalizeText(name),
        paidAmount: 0,
        shareAmount: 0,
        balance: 0,
        status: "settled"
      });
    }
    const item = balances.get(memberId);
    if (!item.displayName && name) item.displayName = normalizeText(name);
    return item;
  }
  for (const entry of entries) {
    const payer = member(entry.payerMemberId, entry.payerDisplayName);
    if (payer) payer.paidAmount += Number(entry.amount) || 0;
    for (const share of (Array.isArray(entry.shares) ? entry.shares : [])) {
      const participant = member(
        share.memberId,
        share.displayName || share.memberName
      );
      if (participant) participant.shareAmount += Number(share.amount) || 0;
    }
  }
  return [...balances.values()].map(item => {
    item.balance = item.paidAmount - item.shareAmount;
    item.status = item.balance > 0
      ? "receivable"
      : item.balance < 0 ? "payable" : "settled";
    return item;
  });
}

function applyEntryToMemberBalances(memberBalances, entry, factor = 1) {
  const balances = new Map();
  for (const item of (Array.isArray(memberBalances) ? memberBalances : [])) {
    const memberId = normalizeText(item.memberId);
    if (!memberId) continue;
    balances.set(memberId, {
      memberId,
      displayName: normalizeText(item.displayName),
      paidAmount: Number(item.paidAmount) || 0,
      shareAmount: Number(item.shareAmount) || 0
    });
  }
  function member(id, name) {
    const memberId = normalizeText(id);
    if (!memberId) return null;
    if (!balances.has(memberId)) {
      balances.set(memberId, {
        memberId,
        displayName: normalizeText(name),
        paidAmount: 0,
        shareAmount: 0
      });
    }
    const item = balances.get(memberId);
    if (!item.displayName && name) item.displayName = normalizeText(name);
    return item;
  }
  const payer = member(entry && entry.payerMemberId, entry && entry.payerDisplayName);
  if (payer) payer.paidAmount += factor * (Number(entry.amount) || 0);
  for (const share of (entry && Array.isArray(entry.shares) ? entry.shares : [])) {
    const participant = member(share.memberId, share.displayName || share.memberName);
    if (participant) participant.shareAmount += factor * (Number(share.amount) || 0);
  }
  return [...balances.values()]
    .map(item => {
      item.paidAmount = Math.max(0, item.paidAmount);
      item.shareAmount = Math.max(0, item.shareAmount);
      item.balance = item.paidAmount - item.shareAmount;
      item.status = item.balance > 0
        ? "receivable"
        : item.balance < 0 ? "payable" : "settled";
      return item;
    })
    .filter(item => item.paidAmount !== 0 || item.shareAmount !== 0);
}

function compactAudit(log) {
  return {
    id: normalizeText(log.id),
    entryId: normalizeText(log.entryId),
    operation: normalizeText(log.operation),
    actorMemberId: normalizeText(log.actorMemberId),
    actorDisplayName: normalizeText(log.actorDisplayName),
    actorUserId: normalizeText(log.actorUserId),
    before: log.before || null,
    after: log.after || null,
    createdAt: normalizeText(log.createdAt)
  };
}

function buildAccountingView(entries, auditLogs, updatedAt) {
  const active = (Array.isArray(entries) ? entries : [])
    .filter(activeEntry)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const totalIncome = active.reduce(
    (sum, entry) => sum + (entry.type === "income" ? Number(entry.amount) || 0 : 0),
    0
  );
  const totalExpense = active.reduce(
    (sum, entry) => sum + (entry.type === "expense" ? Number(entry.amount) || 0 : 0),
    0
  );
  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    activeEntryCount: active.length,
    memberBalances: buildMemberBalances(active),
    recentEntries: active.slice(0, 20).map(compactEntry),
    updatedAt: normalizeText(updatedAt) || new Date().toISOString()
  };
}

function buildAdminAccountingView(auditLogs, updatedAt) {
  return {
    recentAuditLogs: (Array.isArray(auditLogs) ? auditLogs : [])
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 10)
      .map(compactAudit),
    updatedAt: normalizeText(updatedAt) || new Date().toISOString()
  };
}

async function ensureCarAccountingView(carId) {
  const db = getFirestore();
  const carRef = getCarRef(db, normalizeText(carId));
  const viewRef = getViewRef(carRef);
  const adminViewRef = getViewRef(carRef, "admin");
  const [existing, existingAdmin] = await Promise.all([
    viewRef.get(),
    adminViewRef.get()
  ]);
  if (existing.exists && existingAdmin.exists) return existing.data();

  const [entriesSnapshot, auditSnapshot] = await Promise.all([
    carRef.collection("accountingEntries").get(),
    carRef.collection("accountingAuditLogs")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get()
  ]);
  const view = buildAccountingView(
    entriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    auditSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  );
  const adminView = buildAdminAccountingView(
    auditSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  );
  await Promise.all([
    viewRef.set(view, { merge: false }),
    adminViewRef.set(adminView, { merge: false })
  ]);
  return view;
}

async function getCarAccountingView(carId) {
  return ensureCarAccountingView(carId);
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
    actorMemberId: normalizeText(entry.actorMemberId),
    actorDisplayName: normalizeText(entry.actorDisplayName),
    payerMemberId: normalizeText(entry.payerMemberId),
    payerDisplayName: normalizeText(entry.payerDisplayName),
    shares: Array.isArray(entry.shares) ? entry.shares : [],
    type: normalizeText(entry.type),
    amount: Number(entry.amount),
    description: normalizeText(entry.description),
    source: normalizeText(entry.source) || "line_group",
    status: "active",
    createdAt: normalizeText(entry.createdAt) || now,
    updatedAt: now
  };

  await ensureCarAccountingView(carId);

  await db.runTransaction(async function (transaction) {
    const viewRef = getViewRef(carRef);
    const adminViewRef = getViewRef(carRef, "admin");
    const [existing, viewSnapshot, adminViewSnapshot] = await Promise.all([
      transaction.get(entryRef),
      transaction.get(viewRef),
      transaction.get(adminViewRef)
    ]);
    if (existing.exists) return;

    const audit = {
      id: auditRef.id,
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
    };
    const previousView = viewSnapshot.data() || {};
    const view = buildAccountingView(
      [...(previousView.recentEntries || []), { id: entryId, ...data }],
      [],
      now
    );
    view.totalIncome = Number(previousView.totalIncome || 0) +
      (data.type === "income" ? data.amount : 0);
    view.totalExpense = Number(previousView.totalExpense || 0) +
      (data.type === "expense" ? data.amount : 0);
    view.balance = view.totalIncome - view.totalExpense;
    view.activeEntryCount = Number(previousView.activeEntryCount || 0) + 1;
    view.memberBalances = applyEntryToMemberBalances(
      previousView.memberBalances,
      data,
      1
    );
    const adminView = buildAdminAccountingView(
      [audit, ...((adminViewSnapshot.data() || {}).recentAuditLogs || [])],
      now
    );

    transaction.set(entryRef, data, { merge: false });
    transaction.set(auditRef, audit);
    transaction.set(viewRef, view, { merge: false });
    transaction.set(adminViewRef, adminView, { merge: false });
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
  await ensureCarAccountingView(options.carId);

  return db.runTransaction(async function (transaction) {
    const viewRef = getViewRef(carRef);
    const adminViewRef = getViewRef(carRef, "admin");
    const [snapshot, viewSnapshot, adminViewSnapshot] = await Promise.all([
      transaction.get(entryRef),
      transaction.get(viewRef),
      transaction.get(adminViewRef)
    ]);
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

    const audit = {
      id: auditRef.id,
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
    };
    const previousView = viewSnapshot.data() || {};
    const recentEntries = (previousView.recentEntries || [])
      .filter(entry => entry.id !== options.entryId);
    if (after.status !== "deleted") recentEntries.unshift(after);
    const view = {
      ...previousView,
      totalIncome: Number(previousView.totalIncome || 0),
      totalExpense: Number(previousView.totalExpense || 0),
      activeEntryCount: Number(previousView.activeEntryCount || 0),
      recentEntries: recentEntries.slice(0, 20).map(compactEntry),
      updatedAt: now
    };
    if (before.type === "income") view.totalIncome -= Number(before.amount) || 0;
    if (before.type === "expense") view.totalExpense -= Number(before.amount) || 0;
    if (after.status !== "deleted") {
      if (after.type === "income") view.totalIncome += Number(after.amount) || 0;
      if (after.type === "expense") view.totalExpense += Number(after.amount) || 0;
    } else {
      view.activeEntryCount = Math.max(0, view.activeEntryCount - 1);
    }
    view.balance = view.totalIncome - view.totalExpense;
    view.memberBalances = applyEntryToMemberBalances(
      applyEntryToMemberBalances(previousView.memberBalances, before, -1),
      after.status === "deleted" ? null : after,
      1
    );
    const adminView = buildAdminAccountingView(
      [audit, ...((adminViewSnapshot.data() || {}).recentAuditLogs || [])],
      now
    );

    transaction.set(entryRef, storedAfter, { merge: false });
    transaction.set(auditRef, audit);
    transaction.set(viewRef, view, { merge: false });
    transaction.set(adminViewRef, adminView, { merge: false });
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
  migrateLegacyGroupAccounting,
  buildAccountingView,
  buildAdminAccountingView,
  buildMemberBalances,
  applyEntryToMemberBalances,
  ensureCarAccountingView,
  getCarAccountingView
};
