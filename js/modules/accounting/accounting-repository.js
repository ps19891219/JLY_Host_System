(function () {
  "use strict";

  function requireDb() {
    if (!window.db) throw new Error("accounting_database_unavailable");
    return window.db;
  }

  const viewName = "activityCurrent";
  const VIEW_SCHEMA_VERSION = 6;
  const SUMMARY_VERSION = 2;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function number(value) {
    return Math.round(Number(value) || 0);
  }

  function actionCounts(actions) {
    const result = {
      total: 0,
      pendingSplit: 0,
      paymentDue: 0,
      paymentConfirmation: 0
    };

    for (const action of actions || []) {
      if (!action || action.status !== "pending") continue;
      result.total += 1;
      if (action.actionType === "pending_split") result.pendingSplit += 1;
      else if (action.actionType === "payment_confirmation") result.paymentConfirmation += 1;
      else result.paymentDue += 1;
    }

    return result;
  }

  function normalizePayments(entry) {
    const supplied = Array.isArray(entry && entry.payments)
      ? entry.payments
      : [];

    if (supplied.length) {
      return supplied
        .map(item => ({
          personId: text(item && (item.personId || item.memberId || item.playerId)),
          amount: number(item && item.amount)
        }))
        .filter(item => item.personId && item.amount > 0);
    }

    const personId = text(entry && (entry.paidBy || entry.payerMemberId));
    const amount = number(entry && entry.amount);
    return personId && amount > 0 ? [{ personId, amount }] : [];
  }

  function normalizeSplits(entry) {
    const source = Array.isArray(entry && entry.splits)
      ? entry.splits
      : Array.isArray(entry && entry.shares)
        ? entry.shares
        : [];

    return source
      .map(item => ({
        personId: text(item && (item.personId || item.memberId || item.playerId)),
        amount: number(item && item.amount)
      }))
      .filter(item => item.personId && item.amount > 0);
  }

  function buildSettlementBalances(transactions) {
    const balances = new Map();
    const add = (personId, amount) => {
      const id = text(personId);
      const value = number(amount);
      if (!id || !value) return;
      balances.set(id, (balances.get(id) || 0) + value);
    };

    for (const entry of transactions || []) {
      if (!entry || entry.status === "deleted" || entry.type !== "expense") continue;
      if (entry.splitStatus !== "completed") continue;

      for (const payment of normalizePayments(entry)) {
        add(payment.personId, payment.amount);
      }

      for (const split of normalizeSplits(entry)) {
        add(split.personId, -split.amount);
      }
    }

    return balances;
  }

  function applyConfirmedSettlements(balanceMap, settlements) {
    const result = new Map(balanceMap || []);

    const ensure = personId => {
      const id = text(personId);
      if (!id) return "";
      if (!result.has(id)) result.set(id, 0);
      return id;
    };

    for (const item of settlements || []) {
      if (!item || item.status !== "settled") continue;

      const from = ensure(item.fromPersonId);
      const to = ensure(item.toPersonId);
      const amount = number(item.amount);
      if (!from || !to || from === to || amount <= 0) continue;

      result.set(from, (result.get(from) || 0) + amount);
      result.set(to, (result.get(to) || 0) - amount);
    }

    return result;
  }

  function buildSettlementPlan(balanceMap) {
    const debtors = [];
    const creditors = [];

    for (const [personId, rawBalance] of balanceMap || []) {
      const balance = number(rawBalance);
      if (!personId || !balance) continue;
      if (balance < 0) debtors.push({ personId, amount: -balance });
      if (balance > 0) creditors.push({ personId, amount: balance });
    }

    debtors.sort((a, b) => b.amount - a.amount || a.personId.localeCompare(b.personId));
    creditors.sort((a, b) => b.amount - a.amount || a.personId.localeCompare(b.personId));

    const transfers = [];
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amount = Math.min(debtor.amount, creditor.amount);

      if (amount > 0) {
        transfers.push({
          fromPersonId: debtor.personId,
          toPersonId: creditor.personId,
          amount
        });
      }

      debtor.amount -= amount;
      creditor.amount -= amount;
      if (debtor.amount === 0) debtorIndex += 1;
      if (creditor.amount === 0) creditorIndex += 1;
    }

    return transfers;
  }

  function sourceVersionFromData(transactions, settlements) {
    const latestEntry = (transactions || []).reduce(
      (latest, item) => String(item && item.updatedAt || "") > latest
        ? String(item.updatedAt || "")
        : latest,
      ""
    );

    const latestSettlement = (settlements || []).reduce(
      (latest, item) => String(item && item.updatedAt || "") > latest
        ? String(item.updatedAt || "")
        : latest,
      ""
    );

    return `${latestEntry}|${latestSettlement}`;
  }

  function buildView(transactions, actions, settlements, now) {
    const active = (transactions || [])
      .filter(item => item && item.status !== "deleted")
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const originalBalance = buildSettlementBalances(active);
    const currentBalance = applyConfirmedSettlements(originalBalance, settlements);
    const settlementTransfers = buildSettlementPlan(currentBalance);

    return {
      schemaVersion: VIEW_SCHEMA_VERSION,
      summaryVersion: SUMMARY_VERSION,
      summarySourceVersion: sourceVersionFromData(active, settlements),
      recentTransactions: active.slice(0, 5),
      balanceByPerson: [...currentBalance]
        .map(([personId, balance]) => ({ personId, balance: number(balance) }))
        .filter(item => item.balance),
      settlementTransfers,
      // Legacy compatibility. It now contains the global optimized settlement plan.
      obligationsByPair: settlementTransfers,
      activeNetSettlements: (settlements || []).filter(item => item && item.status === "payment_claimed"),
      pendingCounts: actionCounts(actions),
      updatedAt: now || new Date().toISOString()
    };
  }

  async function latestUpdatedAt(root, collectionName) {
    const snapshot = await root
      .collection(collectionName)
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();

    return snapshot.empty
      ? ""
      : String(snapshot.docs[0].data().updatedAt || "");
  }

  async function currentSourceVersion(root) {
    const [entryVersion, settlementVersion] = await Promise.all([
      latestUpdatedAt(root, "accountingEntries"),
      latestUpdatedAt(root, "accountingSettlements")
    ]);

    return `${entryVersion}|${settlementVersion}`;
  }

  async function rebuildActivityView(root) {
    const [entries, actions, settlements] = await Promise.all([
      root.collection("accountingEntries").get(),
      root.collection("accountingPendingActions").where("status", "==", "pending").get(),
      root.collection("accountingSettlements").get()
    ]);

    const view = buildView(
      entries.docs.map(doc => ({ transactionId: doc.id, ...doc.data() })),
      actions.docs.map(doc => ({ pendingActionId: doc.id, ...doc.data() })),
      settlements.docs.map(doc => ({ settlementId: doc.id, ...doc.data() }))
    );

    await root.collection("accountingViews").doc(viewName).set(view, { merge: false });
    return view;
  }

  async function ensureActivityView(root) {
    const ref = root.collection("accountingViews").doc(viewName);
    const [snapshot, sourceVersion] = await Promise.all([
      ref.get(),
      currentSourceVersion(root)
    ]);

    if (
      snapshot.exists &&
      Number(snapshot.data().schemaVersion) >= VIEW_SCHEMA_VERSION &&
      Number(snapshot.data().summaryVersion) >= SUMMARY_VERSION &&
      snapshot.data().summarySourceVersion === sourceVersion
    ) {
      return snapshot.data();
    }

    return rebuildActivityView(root);
  }

  async function loadDashboard(carId, currentPersonId) {
    const root = requireDb().collection("cars").doc(carId);
    const view = await ensureActivityView(root);

    let actionQuery = root
      .collection("accountingPendingActions")
      .where("status", "==", "pending");

    if (currentPersonId) {
      actionQuery = actionQuery.where("responsiblePersonId", "==", currentPersonId);
    }

    const actions = await actionQuery.get();

    return {
      transactions: view.recentTransactions || [],
      pendingActions: actions.docs.map(doc => ({ pendingActionId: doc.id, ...doc.data() })),
      pendingCounts: view.pendingCounts || actionCounts([]),
      balanceByPerson: view.balanceByPerson || [],
      settlementTransfers: view.settlementTransfers || view.obligationsByPair || [],
      obligationsByPair: view.settlementTransfers || view.obligationsByPair || [],
      activeNetSettlements: view.activeNetSettlements || []
    };
  }

  function replaceRecent(view, entry) {
    const recent = (view.recentTransactions || [])
      .filter(item => item.transactionId !== entry.transactionId && item.status !== "deleted");

    if (entry.status !== "deleted") recent.push(entry);
    recent.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return recent.slice(0, 5);
  }

  function invalidateSummary(view, patch, now) {
    return {
      ...view,
      ...patch,
      schemaVersion: VIEW_SCHEMA_VERSION,
      summaryVersion: 0,
      summarySourceVersion: "",
      updatedAt: now || new Date().toISOString()
    };
  }

  async function loadPendingDrafts(carId) {
    const snapshot = await requireDb()
      .collection("cars")
      .doc(carId)
      .collection("accountingDrafts")
      .where("status", "==", "pending_identity")
      .get();

    return snapshot.docs
      .map(doc => ({ draftId: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  }

  async function transitionDraft(carId, draftId, action, actorPersonId, details) {
    const db = requireDb();
    const root = db.collection("cars").doc(carId);
    const ref = root.collection("accountingDrafts").doc(draftId);
    const audit = root.collection("accountingDraftAuditLogs").doc();
    const now = new Date().toISOString();

    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("draft_not_found");

      const before = snapshot.data();
      if (before.status !== "pending_identity") throw new Error("draft_already_processed");

      const after = {
        ...before,
        status: action === "confirmed" ? "confirmed" : "dismissed",
        resolvedPersonId: String(details && details.paidBy || ""),
        resolvedTransactionId: String(details && details.transactionId || ""),
        resolvedBy: actorPersonId,
        resolvedAt: now,
        updatedAt: now
      };

      transaction.set(ref, after, { merge: false });
      transaction.set(audit, {
        auditId: audit.id,
        draftId,
        action,
        actorPersonId,
        before,
        after,
        createdAt: now
      }, { merge: false });
    });
  }

  function adjustCounts(counts, oldActions, nextActions) {
    const all = [
      ...(oldActions || []).map(action => ({ ...action, _factor: -1 })),
      ...(nextActions || []).map(action => ({ ...action, _factor: 1 }))
    ];

    const result = {
      total: Number(counts && counts.total) || 0,
      pendingSplit: Number(counts && counts.pendingSplit) || 0,
      paymentDue: Number(counts && counts.paymentDue) || 0,
      paymentConfirmation: Number(counts && counts.paymentConfirmation) || 0
    };

    for (const action of all) {
      if (action.status && action.status !== "pending") continue;
      result.total += action._factor;
      if (action.actionType === "pending_split") result.pendingSplit += action._factor;
      else if (action.actionType === "payment_confirmation") result.paymentConfirmation += action._factor;
      else result.paymentDue += action._factor;
    }

    Object.keys(result).forEach(key => {
      result[key] = Math.max(0, result[key]);
    });

    return result;
  }

  async function createQuickTransaction(data, managerPersonId) {
    const db = requireDb();
    const root = db.collection("cars").doc(data.carId);
    const transactionRef = root.collection("accountingEntries").doc(data.transactionId);
    const actionId = `pending_split-${data.transactionId}-${managerPersonId || data.createdBy}`;
    const actionRef = root.collection("accountingPendingActions").doc(actionId);

    await ensureActivityView(root);

    await db.runTransaction(async transaction => {
      const viewRef = root.collection("accountingViews").doc(viewName);
      const [existing, viewSnapshot] = await Promise.all([
        transaction.get(transactionRef),
        transaction.get(viewRef)
      ]);

      if (existing.exists) throw new Error("transaction_already_exists");

      transaction.set(transactionRef, {
        ...data,
        pendingActionIds: [actionId]
      }, { merge: false });

      transaction.set(actionRef, {
        pendingActionId: actionId,
        actionType: "pending_split",
        responsiblePersonId: managerPersonId || data.createdBy,
        transactionId: data.transactionId,
        splitId: "",
        activityId: data.activityId,
        carId: data.carId,
        status: "pending",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        completedAt: "",
        history: [{ status: "pending", at: data.createdAt }]
      }, { merge: false });

      const action = { actionType: "pending_split", status: "pending" };
      const view = viewSnapshot.data() || {};

      transaction.set(viewRef, invalidateSummary(view, {
        recentTransactions: replaceRecent(view, data),
        pendingCounts: adjustCounts(view.pendingCounts, [], [action])
      }, data.updatedAt), { merge: false });
    });

    return data;
  }

  async function completeSplit(carId, transactionId, splits, actorPersonId, managerPersonId) {
    const db = requireDb();
    const root = db.collection("cars").doc(carId);
    const entryRef = root.collection("accountingEntries").doc(transactionId);
    const actions = root.collection("accountingPendingActions");
    const now = new Date().toISOString();

    await ensureActivityView(root);

    await db.runTransaction(async transaction => {
      const viewRef = root.collection("accountingViews").doc(viewName);
      const [entrySnapshot, viewSnapshot] = await Promise.all([
        transaction.get(entryRef),
        transaction.get(viewRef)
      ]);

      if (!entrySnapshot.exists) throw new Error("transaction_not_found");

      const entry = { transactionId: entrySnapshot.id, ...entrySnapshot.data() };
      if (
        actorPersonId !== entry.createdBy &&
        actorPersonId !== entry.paidBy &&
        actorPersonId !== managerPersonId
      ) {
        throw new Error("split_permission_denied");
      }

      const oldIds = Array.isArray(entry.pendingActionIds) ? entry.pendingActionIds : [];
      const oldSnapshots = await Promise.all(oldIds.map(id => transaction.get(actions.doc(id))));

      oldSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) return;
        const old = snapshot.data();
        transaction.set(actions.doc(oldIds[index]), {
          ...old,
          status: "completed",
          completedAt: now,
          updatedAt: now,
          history: [...(old.history || []), { status: "completed", at: now, actorPersonId }]
        }, { merge: false });
      });

      const pendingIds = [];
      for (const split of splits) {
        if (split.settlementStatus === "settled") continue;
        const id = `payment_due-${transactionId}-${split.personId}`;
        pendingIds.push(id);
        transaction.set(actions.doc(id), {
          pendingActionId: id,
          actionType: "payment_due",
          responsiblePersonId: split.personId,
          transactionId,
          splitId: split.splitId,
          activityId: entry.activityId || carId,
          carId,
          status: "pending",
          createdAt: now,
          updatedAt: now,
          completedAt: "",
          history: [{ status: "pending", at: now }]
        }, { merge: false });
      }

      const nextEntry = {
        ...entry,
        splits,
        shares: splits,
        participants: splits.map(split => split.personId),
        splitStatus: "completed",
        settlementStatus: pendingIds.length ? "payment_due" : "settled",
        pendingActionIds: pendingIds,
        updatedAt: now
      };

      const oldActions = oldSnapshots.filter(item => item.exists).map(item => item.data());
      const nextActions = splits
        .filter(split => split.settlementStatus !== "settled")
        .map(() => ({ actionType: "payment_due", status: "pending" }));
      const view = viewSnapshot.data() || {};

      transaction.set(entryRef, nextEntry, { merge: false });
      transaction.set(viewRef, invalidateSummary(view, {
        recentTransactions: replaceRecent(view, nextEntry),
        pendingCounts: adjustCounts(view.pendingCounts, oldActions, nextActions)
      }, now), { merge: false });
    });
  }

  async function saveSettlement(carId, transactionId, splitId, nextSplit, actorPersonId) {
    const db = requireDb();
    const root = db.collection("cars").doc(carId);
    const entryRef = root.collection("accountingEntries").doc(transactionId);
    const actions = root.collection("accountingPendingActions");
    const now = new Date().toISOString();

    await ensureActivityView(root);

    await db.runTransaction(async transaction => {
      const viewRef = root.collection("accountingViews").doc(viewName);
      const [entrySnapshot, viewSnapshot] = await Promise.all([
        transaction.get(entryRef),
        transaction.get(viewRef)
      ]);

      if (!entrySnapshot.exists) throw new Error("transaction_not_found");

      const entry = { transactionId: entrySnapshot.id, ...entrySnapshot.data() };
      const splits = (entry.splits || []).map(split => split.splitId === splitId ? nextSplit : split);
      if (!splits.some(split => split.splitId === splitId)) throw new Error("split_not_found");

      const oldIds = Array.isArray(entry.pendingActionIds) ? entry.pendingActionIds : [];
      const oldSnapshots = await Promise.all(oldIds.map(id => transaction.get(actions.doc(id))));
      const nextActions = [];

      for (const split of splits) {
        if (split.personId === entry.paidBy || split.settlementStatus === "settled") continue;

        const type = split.settlementStatus === "payment_claimed"
          ? "payment_confirmation"
          : split.settlementStatus === "settlement_rejected"
            ? "settlement_rejected"
            : "payment_due";

        const responsible = type === "payment_confirmation" ? entry.paidBy : split.personId;
        const id = `${type}-${transactionId}-${split.splitId}`;

        nextActions.push({
          pendingActionId: id,
          actionType: type,
          responsiblePersonId: responsible,
          transactionId,
          splitId: split.splitId,
          activityId: entry.activityId || carId,
          carId,
          status: "pending",
          createdAt: now,
          updatedAt: now,
          completedAt: "",
          history: [{ status: "pending", at: now, actorPersonId }]
        });
      }

      const nextIds = new Set(nextActions.map(item => item.pendingActionId));
      oldSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists || nextIds.has(oldIds[index])) return;
        const old = snapshot.data();
        transaction.set(actions.doc(oldIds[index]), {
          ...old,
          status: "completed",
          completedAt: now,
          updatedAt: now,
          history: [...(old.history || []), { status: "completed", at: now, actorPersonId }]
        }, { merge: false });
      });

      nextActions.forEach(action => transaction.set(actions.doc(action.pendingActionId), action, { merge: true }));

      const pendingActionIds = nextActions.map(action => action.pendingActionId);
      const settlementStatus = splits.length && splits.every(split => split.settlementStatus === "settled")
        ? "settled"
        : "pending";

      const nextEntry = {
        ...entry,
        splits,
        shares: splits,
        settlementStatus,
        pendingActionIds,
        updatedAt: now
      };

      const oldActions = oldSnapshots.filter(item => item.exists).map(item => item.data());
      const view = viewSnapshot.data() || {};

      transaction.set(entryRef, nextEntry, { merge: false });
      transaction.set(viewRef, invalidateSummary(view, {
        recentTransactions: replaceRecent(view, nextEntry),
        pendingCounts: adjustCounts(view.pendingCounts, oldActions, nextActions)
      }, now), { merge: false });
    });
  }

  async function loadTransactionPage(carId, pageSize, lastDocument) {
    let query = requireDb()
      .collection("cars")
      .doc(carId)
      .collection("accountingEntries")
      .orderBy("createdAt", "desc")
      .limit(pageSize || 10);

    if (lastDocument) query = query.startAfter(lastDocument);

    const snapshot = await query.get();
    return {
      transactions: snapshot.docs
        .map(doc => ({ transactionId: doc.id, ...doc.data() }))
        .filter(item => item.status !== "deleted"),
      lastDocument: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.docs.length === (pageSize || 10)
    };
  }

  function netTransferAmount(items, from, to) {
    return (items || [])
      .filter(item => item.fromPersonId === from && item.toPersonId === to)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  async function claimNetSettlement(carId, input) {
    const db = requireDb();
    const root = db.collection("cars").doc(carId);
    const viewRef = root.collection("accountingViews").doc(viewName);
    const now = new Date().toISOString();
    const id = `net-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ref = root.collection("accountingSettlements").doc(id);
    const actionRef = root.collection("accountingPendingActions").doc(`net_confirmation-${id}`);

    await ensureActivityView(root);

    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(viewRef);
      const view = snapshot.data() || {};
      const from = String(input.fromPersonId || "");
      const to = String(input.toPersonId || "");
      const amount = Number(input.amount) || 0;
      const managerClaim = input.action === "manager_claim";
      const allowed = input.actorPersonId === from || (
        managerClaim &&
        input.actorPersonId === input.managerPersonId &&
        !input.targetUsesSystem
      );

      if (!allowed || !from || !to) throw new Error("net_settlement_not_allowed");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("net_settlement_invalid_amount");
      if ((view.activeNetSettlements || []).some(item =>
        item.fromPersonId === from &&
        item.toPersonId === to &&
        item.status === "payment_claimed"
      )) {
        throw new Error("net_settlement_already_claimed");
      }
      if (netTransferAmount(view.settlementTransfers || view.obligationsByPair, from, to) < amount) {
        throw new Error("net_settlement_amount_changed");
      }

      const record = {
        settlementId: id,
        activityId: carId,
        carId,
        fromPersonId: from,
        toPersonId: to,
        amount,
        status: "payment_claimed",
        paymentClaimedBy: input.actorPersonId,
        paymentClaimedFor: managerClaim ? from : "",
        claimAuthority: managerClaim ? "manager_for_offline_member" : "self",
        paymentClaimedAt: now,
        createdAt: now,
        updatedAt: now,
        history: [{
          action: "payment_claimed",
          actorPersonId: input.actorPersonId,
          forPersonId: managerClaim ? from : "",
          authority: managerClaim ? "manager_for_offline_member" : "self",
          at: now
        }]
      };

      const pending = {
        pendingActionId: `net_confirmation-${id}`,
        actionType: "payment_confirmation",
        responsiblePersonId: to,
        settlementId: id,
        activityId: carId,
        carId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        completedAt: "",
        history: [{
          status: "pending",
          at: now,
          actorPersonId: input.actorPersonId,
          forPersonId: managerClaim ? from : ""
        }]
      };

      transaction.set(ref, record, { merge: false });
      transaction.set(actionRef, pending, { merge: false });
      transaction.set(viewRef, invalidateSummary(view, {
        activeNetSettlements: [...(view.activeNetSettlements || []), record],
        pendingCounts: adjustCounts(view.pendingCounts, [], [pending])
      }, now), { merge: false });
    });
  }

  async function transitionNetSettlement(carId, settlementId, action, actorPersonId, authority) {
    const db = requireDb();
    const root = db.collection("cars").doc(carId);
    const viewRef = root.collection("accountingViews").doc(viewName);
    const ref = root.collection("accountingSettlements").doc(settlementId);
    const actionRef = root.collection("accountingPendingActions").doc(`net_confirmation-${settlementId}`);
    const now = new Date().toISOString();

    await ensureActivityView(root);

    await db.runTransaction(async transaction => {
      const [viewSnapshot, recordSnapshot, actionSnapshot] = await Promise.all([
        transaction.get(viewRef),
        transaction.get(ref),
        transaction.get(actionRef)
      ]);

      if (!recordSnapshot.exists) throw new Error("net_settlement_not_found");

      const view = viewSnapshot.data() || {};
      const record = recordSnapshot.data();
      if (record.status !== "payment_claimed") throw new Error("net_settlement_invalid_status");

      const managerConfirm = action === "manager_confirm";
      let next;

      if (action === "withdraw") {
        if (actorPersonId !== record.fromPersonId) throw new Error("net_settlement_not_allowed");
        next = {
          ...record,
          status: "withdrawn",
          withdrawnBy: actorPersonId,
          withdrawnAt: now,
          updatedAt: now,
          history: [...(record.history || []), { action: "withdrawn", actorPersonId, at: now }]
        };
      } else if (action === "confirm" || managerConfirm) {
        const canConfirm = action === "confirm"
          ? actorPersonId === record.toPersonId
          : authority &&
            actorPersonId === authority.managerPersonId &&
            !authority.targetUsesSystem;

        if (!canConfirm) throw new Error("net_settlement_not_allowed");
        if (netTransferAmount(view.settlementTransfers || view.obligationsByPair, record.fromPersonId, record.toPersonId) < record.amount) {
          throw new Error("net_settlement_amount_changed");
        }

        next = {
          ...record,
          status: "settled",
          confirmedBy: actorPersonId,
          confirmedFor: managerConfirm ? record.toPersonId : "",
          confirmationAuthority: managerConfirm ? "manager_for_offline_member" : "receiver",
          confirmedAt: now,
          updatedAt: now,
          history: [...(record.history || []), {
            action: "settled",
            actorPersonId,
            forPersonId: managerConfirm ? record.toPersonId : "",
            authority: managerConfirm ? "manager_for_offline_member" : "receiver",
            at: now
          }]
        };
      } else {
        throw new Error("net_settlement_action_unknown");
      }

      const oldPending = actionSnapshot.exists ? actionSnapshot.data() : null;
      if (oldPending) {
        transaction.set(actionRef, {
          ...oldPending,
          status: "completed",
          completedAt: now,
          updatedAt: now,
          history: [...(oldPending.history || []), { status: "completed", actorPersonId, at: now }]
        }, { merge: false });
      }

      transaction.set(ref, next, { merge: false });
      transaction.set(viewRef, invalidateSummary(view, {
        activeNetSettlements: (view.activeNetSettlements || [])
          .filter(item => item.settlementId !== settlementId),
        pendingCounts: adjustCounts(view.pendingCounts, oldPending ? [oldPending] : [], [])
      }, now), { merge: false });
    });
  }

  window.JLYAccountingRepository = {
    loadDashboard,
    loadPendingDrafts,
    transitionDraft,
    loadTransactionPage,
    createQuickTransaction,
    completeSplit,
    saveSettlement,
    claimNetSettlement,
    transitionNetSettlement
  };
})();
