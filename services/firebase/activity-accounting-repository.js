"use strict";

const { getFirestore } = require("./admin");
const { createTransaction } = require("../accounting/transaction");
const { buildPendingActions } = require("../accounting/pending-action");
const { toLegacyAccountingAliases } = require("../accounting/compatibility");

function text(value) { return String(value == null ? "" : value).trim(); }

function activityRoot(db, transaction) {
  if (transaction.activityType !== "car" || !transaction.carId) {
    throw new Error("activity_repository_not_implemented");
  }
  return db.collection("cars").doc(transaction.carId);
}

function snapshotData(snapshot) {
  return snapshot && snapshot.exists ? { id: snapshot.id, ...(snapshot.data() || {}) } : null;
}

function actionWithTransition(action, previous, now) {
  const history = Array.isArray(previous && previous.history) ? previous.history.slice() : [];
  if (!previous || previous.status !== "pending") {
    history.push({ status: "pending", at: now });
  }
  return { ...action, status: "pending", createdAt: text(previous && previous.createdAt) || action.createdAt || now, completedAt: "", updatedAt: now, history };
}

function completedAction(previous, now) {
  const history = Array.isArray(previous.history) ? previous.history.slice() : [];
  if (previous.status !== "completed") history.push({ status: "completed", at: now });
  return { ...previous, status: "completed", completedAt: previous.completedAt || now, updatedAt: now, history };
}

function createRepository(dependencies = {}) {
  const db = dependencies.db || getFirestore();
  const now = dependencies.now || (() => new Date().toISOString());

  async function saveTransaction(input, options = {}) {
    const canonical = createTransaction(input);
    const timestamp = now();
    const pending = buildPendingActions(canonical, options.accountingManagerPersonId);
    const root = activityRoot(db, canonical);
    const transactionRef = root.collection("accountingEntries").doc(canonical.transactionId);
    const pendingCollection = root.collection("accountingPendingActions");
    const pendingQuery = pendingCollection.where("transactionId", "==", canonical.transactionId);

    return db.runTransaction(async firestoreTransaction => {
      const [existingTransactionSnapshot, existingActionsSnapshot] = await Promise.all([
        firestoreTransaction.get(transactionRef),
        firestoreTransaction.get(pendingQuery)
      ]);
      const existingTransaction = snapshotData(existingTransactionSnapshot);
      const existingActions = new Map((existingActionsSnapshot.docs || []).map(snapshot => [snapshot.id, snapshotData(snapshot)]));
      const activeIds = new Set(pending.map(action => action.pendingActionId));

      for (const previous of existingActions.values()) {
        if (previous.status === "pending" && !activeIds.has(previous.pendingActionId)) {
          firestoreTransaction.set(pendingCollection.doc(previous.pendingActionId), completedAction(previous, timestamp), { merge: false });
        }
      }
      for (const action of pending) {
        const previous = existingActions.get(action.pendingActionId);
        firestoreTransaction.set(pendingCollection.doc(action.pendingActionId), actionWithTransition(action, previous, timestamp), { merge: false });
      }

      const stored = {
        ...canonical,
        ...toLegacyAccountingAliases(canonical),
        createdAt: text(existingTransaction && existingTransaction.createdAt) || canonical.createdAt,
        updatedAt: timestamp,
        pendingActionIds: pending.map(action => action.pendingActionId),
        schemaVersion: 1
      };
      firestoreTransaction.set(transactionRef, stored, { merge: false });
      firestoreTransaction.set(root.collection("accountingViews").doc("activityCurrent"), { schemaVersion: 0, updatedAt: timestamp }, { merge: true });
      return stored;
    });
  }

  async function listPendingActions(carId, responsiblePersonId) {
    let query = db.collection("cars").doc(text(carId)).collection("accountingPendingActions").where("status", "==", "pending");
    if (responsiblePersonId) query = query.where("responsiblePersonId", "==", text(responsiblePersonId));
    const snapshot = await query.get();
    return (snapshot.docs || []).map(snapshotData);
  }

  return { saveTransaction, listPendingActions };
}

module.exports = { createRepository, actionWithTransition, completedAction };
