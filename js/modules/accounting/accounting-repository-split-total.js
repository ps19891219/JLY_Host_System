(function () {
  "use strict";

  const PROJECTION_VERSION = "settled_split_v2";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function number(value) {
    return Math.round(Number(value) || 0);
  }

  function requireRepository() {
    if (!window.JLYAccountingRepository) throw new Error("accounting_repository_unavailable");
    return window.JLYAccountingRepository;
  }

  function requireDb() {
    if (!window.db) throw new Error("accounting_database_unavailable");
    return window.db;
  }

  const repository = requireRepository();
  const baseUpdateSplitAmounts = repository.updateSplitAmounts.bind(repository);
  const baseLoadDashboard = repository.loadDashboard.bind(repository);

  async function ensureProjectionVersion(carId) {
    const root = requireDb().collection("cars").doc(carId);
    const viewRef = root.collection("accountingViews").doc("activityCurrent");
    const snapshot = await viewRef.get();
    if (!snapshot.exists || snapshot.data().settledSplitProjectionVersion === PROJECTION_VERSION) return;
    await viewRef.set({
      summaryVersion: 0,
      summarySourceVersion: "",
      settledSplitProjectionVersion: PROJECTION_VERSION,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  async function loadDashboard(carId, currentPersonId) {
    await ensureProjectionVersion(carId);
    const result = await baseLoadDashboard(carId, currentPersonId);
    const viewRef = requireDb().collection("cars").doc(carId).collection("accountingViews").doc("activityCurrent");
    await viewRef.set({ settledSplitProjectionVersion: PROJECTION_VERSION }, { merge: true });
    return result;
  }

  async function updateSplitAmounts(carId, transactionId, amountsBySplitId, actorPersonId) {
    const supplied = amountsBySplitId && typeof amountsBySplitId === "object"
      ? { ...amountsBySplitId }
      : {};
    const hasRequestedTotal = Object.prototype.hasOwnProperty.call(supplied, "__transactionTotal");

    if (!hasRequestedTotal) {
      return baseUpdateSplitAmounts(carId, transactionId, supplied, actorPersonId);
    }

    const requestedTotal = number(supplied.__transactionTotal);
    delete supplied.__transactionTotal;

    const db = requireDb();
    const root = db.collection("cars").doc(carId);
    const entryRef = root.collection("accountingEntries").doc(transactionId);
    const entrySnapshot = await entryRef.get();
    if (!entrySnapshot.exists) throw new Error("transaction_not_found");

    const canonicalEntry = { transactionId: entrySnapshot.id, ...entrySnapshot.data() };
    if (requestedTotal === number(canonicalEntry.amount)) {
      return baseUpdateSplitAmounts(carId, transactionId, supplied, actorPersonId);
    }

    if (!Number.isFinite(requestedTotal) || requestedTotal <= 0) {
      throw new Error("split_amount_invalid");
    }

    const actions = root.collection("accountingPendingActions");
    const viewRef = root.collection("accountingViews").doc("activityCurrent");
    const now = new Date().toISOString();

    await db.runTransaction(async transaction => {
      const [freshEntrySnapshot, carSnapshot, viewSnapshot] = await Promise.all([
        transaction.get(entryRef),
        transaction.get(root),
        transaction.get(viewRef)
      ]);

      if (!freshEntrySnapshot.exists) throw new Error("transaction_not_found");
      const entry = { transactionId: freshEntrySnapshot.id, ...freshEntrySnapshot.data() };
      if (entry.splitStatus !== "completed") throw new Error("split_edit_not_allowed");

      const ownerId = text(carSnapshot.exists && carSnapshot.data().ownerId);
      const actor = text(actorPersonId);
      if (!actor || ![text(entry.createdBy), text(entry.paidBy), ownerId].filter(Boolean).includes(actor)) {
        throw new Error("split_permission_denied");
      }

      const currentSplits = Array.isArray(entry.splits) ? entry.splits : [];
      if (!currentSplits.length) throw new Error("split_not_found");

      const externalLocked = currentSplits.some(split =>
        split &&
        text(split.personId) !== text(entry.paidBy) &&
        text(split.settlementStatus) !== "payment_due"
      );
      if (externalLocked) throw new Error("transaction_amount_locked");

      const editableIds = new Set(
        currentSplits
          .filter(split => split && (
            text(split.settlementStatus) === "payment_due" ||
            (text(split.personId) === text(entry.paidBy) && text(split.settlementStatus) === "settled")
          ))
          .map(split => text(split.splitId))
          .filter(Boolean)
      );

      for (const splitId of Object.keys(supplied)) {
        if (!editableIds.has(text(splitId))) throw new Error("split_edit_not_allowed");
      }

      const nextSplits = currentSplits.map(split => {
        const splitId = text(split && split.splitId);
        if (!Object.prototype.hasOwnProperty.call(supplied, splitId)) return split;
        const amount = Number(supplied[splitId]);
        if (!Number.isFinite(amount) || amount < 0) throw new Error("split_amount_invalid");
        return { ...split, amount: Math.round(amount) };
      });

      const splitTotal = nextSplits.reduce((sum, split) => sum + number(split && split.amount), 0);
      if (splitTotal !== requestedTotal) throw new Error("split_total_mismatch");

      const oldIds = Array.isArray(entry.pendingActionIds) ? entry.pendingActionIds : [];
      const oldSnapshots = await Promise.all(oldIds.map(id => transaction.get(actions.doc(id))));

      oldSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) return;
        const old = snapshot.data() || {};
        if (old.status !== "pending" || old.actionType !== "payment_due") return;
        transaction.set(actions.doc(oldIds[index]), {
          ...old,
          status: "completed",
          completedAt: now,
          updatedAt: now,
          history: [
            ...(old.history || []),
            { status: "completed", reason: "split_amount_updated", actorPersonId: actor, at: now }
          ]
        }, { merge: false });
      });

      const preservedActionIds = oldSnapshots
        .map((snapshot, index) => ({ snapshot, id: oldIds[index] }))
        .filter(item => item.snapshot.exists)
        .map(item => ({ id: item.id, data: item.snapshot.data() || {} }))
        .filter(item => item.data.status === "pending" && item.data.actionType !== "payment_due")
        .map(item => item.id);

      const nextActionIds = [...preservedActionIds];
      for (const split of nextSplits) {
        if (!split || text(split.personId) === text(entry.paidBy) || text(split.settlementStatus) !== "payment_due") continue;
        const id = `payment_due-${transactionId}-${text(split.splitId)}`;
        nextActionIds.push(id);
        transaction.set(actions.doc(id), {
          pendingActionId: id,
          actionType: "payment_due",
          responsiblePersonId: text(split.personId),
          transactionId,
          splitId: text(split.splitId),
          activityId: entry.activityId || carId,
          carId,
          status: "pending",
          createdAt: now,
          updatedAt: now,
          completedAt: "",
          history: [{ status: "pending", reason: "split_amount_updated", actorPersonId: actor, at: now }]
        }, { merge: false });
      }

      const nextEntry = {
        ...entry,
        amount: requestedTotal,
        splits: nextSplits,
        shares: nextSplits,
        pendingActionIds: nextActionIds,
        updatedAt: now
      };

      transaction.set(entryRef, nextEntry, { merge: false });
      transaction.set(viewRef, {
        ...(viewSnapshot.exists ? viewSnapshot.data() : {}),
        summaryVersion: 0,
        summarySourceVersion: "",
        settledSplitProjectionVersion: PROJECTION_VERSION,
        updatedAt: now
      }, { merge: false });
    });
  }

  window.JLYAccountingRepository = {
    ...repository,
    loadDashboard,
    updateSplitAmounts
  };
})();
