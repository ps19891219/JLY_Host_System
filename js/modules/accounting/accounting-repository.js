(function () {
  "use strict";

  function requireDb() {
    if (!window.db) throw new Error("accounting_database_unavailable");
    return window.db;
  }

  const viewName = "activityCurrent";
  const VIEW_SCHEMA_VERSION = 10;
  const SUMMARY_VERSION = 3;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function number(value) {
    return Math.round(Number(value) || 0);
  }

  function activityMemberIds(car) {
    const source = car || {};
    if (window.JLYAccountingData && typeof window.JLYAccountingData.collectActivityMembers === "function") {
      return window.JLYAccountingData.collectActivityMembers(source).map(item => text(item.personId));
    }
    const ids = new Set([text(source.ownerId)]);
    const add = item => {
      const nested = item && (item.memberSnapshot || item.member || item.player) || {};
      const id = text(item && (item.personId || item.memberId || item.playerId || item.profileId || item.id) || nested.personId || nested.memberId || nested.playerId || nested.profileId || nested.id);
      if (id) ids.add(id);
    };
    (source.players || []).forEach(add);
    (source.staffSlots || []).forEach(add);
    return [...ids].filter(Boolean);
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

    const pairwise =
      typeof window !== "undefined"
        ? window.JLYPairwiseObligation
        : null;

    const grossObligations =
      pairwise &&
      typeof pairwise.buildTransactionObligations === "function" &&
      typeof pairwise.applySettlements === "function"
        ? pairwise.applySettlements(
            active.flatMap(item =>
              pairwise.buildTransactionObligations(item)
            ),
            settlements
          )
        : [];

    const delegated = typeof window !== "undefined" ? window.JLYDelegatedPayment : null;
    const reimbursementObligations = delegated && typeof delegated.buildReimbursementObligation === "function"
      ? (settlements || []).map(item => delegated.buildReimbursementObligation(item)).filter(Boolean)
      : [];
    if (!pairwise || typeof pairwise.aggregatePairwiseObligations !== "function") {
      throw new Error("accounting_pairwise_engine_unavailable");
    }
    const settlementTransfers = pairwise.aggregatePairwiseObligations(
      [],
      [...grossObligations, ...reimbursementObligations]
    );

    const expenseEntries = active.filter(item => item.type === "expense");
    const expenseSourcesByPerson = [];
    const actualPaymentsMap = new Map();
    const settledPaidMap = new Map();
    const settledReceivedMap = new Map();

    expenseEntries.forEach(item => (item.splits || item.shares || []).forEach(split => {
      const personId = text(split.personId || split.memberId);
      const amountValue = number(split.amount);
      if (!personId || !amountValue) return;
      expenseSourcesByPerson.push({
        personId,
        sourceType: "transaction_split",
        sourceId: text(split.splitId || item.transactionId),
        transactionId: text(item.transactionId),
        title: text(item.title || item.description) || "未命名帳目",
        amount: amountValue,
        settlementStatus: text(split.settlementStatus)
      });
    }));

    expenseEntries.forEach(item => {
      const payments=Array.isArray(item.payments)&&item.payments.length?item.payments:[{personId:item.paidBy||item.payerMemberId,amount:item.amount}];
      payments.filter(row=>row&&row.status!=="deleted"&&row.status!=="cancelled").forEach(row=>{const personId=text(row.personId||row.paidBy),value=number(row.amount);if(personId&&value)actualPaymentsMap.set(personId,(actualPaymentsMap.get(personId)||0)+value);});
    });

    (settlements || [])
      .filter(item => item && item.status === "settled")
      .forEach(item => {
        const personId = text(item.paidBy || item.paymentClaimedBy || item.fromPersonId);
        const receiverPersonId = text(item.receiverPersonId || item.toPersonId);
        const value = number(item.amount);
        if (!value) return;
        if (personId) settledPaidMap.set(personId, (settledPaidMap.get(personId) || 0) + value);
        if (receiverPersonId) settledReceivedMap.set(receiverPersonId, (settledReceivedMap.get(receiverPersonId) || 0) + value);
      });
    return {
      schemaVersion: VIEW_SCHEMA_VERSION,
      summaryVersion: SUMMARY_VERSION,
      summarySourceVersion: sourceVersionFromData(active, settlements),
      recentTransactions: active.slice(0, 5),
      transactionExpenseProjection: {
        actualExpense: expenseEntries.reduce((sum, item) => sum + number(item.amount), 0),
        splitTotal: expenseEntries.length,
        splitCompleted: expenseEntries.filter(item => item.splitStatus !== "pending").length,
        personSources: expenseSourcesByPerson,
        actualPaymentsByPerson:[...actualPaymentsMap].map(([personId,amount])=>({personId,amount}))
      },
      settledPaidByPerson: [...settledPaidMap]
        .map(([personId, amount]) => ({ personId, amount })),
      settledReceivedByPerson: [...settledReceivedMap]
        .map(([personId, amount]) => ({ personId, amount })),
      balanceByPerson: [...currentBalance]
        .map(([personId, balance]) => ({ personId, balance: number(balance) }))
        .filter(item => item.balance),

      grossObligations,

      pairwiseObligations:
        settlementTransfers,

      settlementTransfers:
        settlementTransfers.map(item => ({
          fromPersonId: item.fromPersonId,
          toPersonId: item.toPersonId,
          amount: item.amount
        })),

      // Legacy compatibility: keep the historic simple transfer shape
      // while the rich pairwise metadata remains available separately.
      obligationsByPair:
        settlementTransfers.map(item => ({
          fromPersonId: item.fromPersonId,
          toPersonId: item.toPersonId,
          amount: item.amount
        })),

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

    const [actions, recentEntries] = await Promise.all([
      actionQuery.get(),
      root
        .collection("accountingEntries")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get()
    ]);

    return {
      // Detailed/recent rows read the canonical transactions directly.
      // activityCurrent is summary/cache only and is never the source of truth
      // for transaction history.
      transactions: recentEntries.docs
        .map(doc => ({ transactionId: doc.id, ...doc.data() }))
        .filter(item => item.status !== "deleted"),
      pendingActions: actions.docs.map(doc => ({ pendingActionId: doc.id, ...doc.data() })),
      pendingCounts: view.pendingCounts || actionCounts([]),
      balanceByPerson: view.balanceByPerson || [],
      grossObligations: view.grossObligations || view.pairwiseObligations || view.settlementTransfers || view.obligationsByPair || [],
      pairwiseObligations: view.pairwiseObligations || [],
      settlementTransfers: view.settlementTransfers || view.obligationsByPair || [],
      obligationsByPair: view.obligationsByPair || view.settlementTransfers || [],
      activeNetSettlements: view.activeNetSettlements || [],
      transactionExpenseProjection: view.transactionExpenseProjection || null,
      settledPaidByPerson: view.settledPaidByPerson || [],
      settledReceivedByPerson: view.settledReceivedByPerson || []
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

  async function loadSettlementHistory(carId, pageSize) {
    const snapshot = await requireDb()
      .collection("cars")
      .doc(carId)
      .collection("accountingSettlements")
      .orderBy("updatedAt", "desc")
      .limit(pageSize || 20)
      .get();

    return snapshot.docs.map(doc => ({ settlementId: doc.id, ...doc.data() }));
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
      const [snapshot, carSnapshot] = await Promise.all([
        transaction.get(viewRef),
        transaction.get(root)
      ]);
      const view = snapshot.data() || {};
      const from = String(input.fromPersonId || "");
      const to = String(input.toPersonId || "");
      const amount = Number(input.amount) || 0;
      const managerClaim = input.action === "manager_claim";
      const delegatedClaim = input.action === "delegated_claim";
      const receiverSettle = input.action === "receiver_settle";
      if (delegatedClaim) {
        if (!carSnapshot.exists) throw new Error("activity_not_found");
        window.JLYDelegatedPayment.requireActivityMember(input.actorPersonId, activityMemberIds(carSnapshot.data()));
      }
      const allowed = receiverSettle ? input.actorPersonId === to || (
        input.actorPersonId === input.managerPersonId && !input.targetUsesSystem
      ) : input.actorPersonId === from || (delegatedClaim && input.actorPersonId !== from && input.actorPersonId !== to) || (
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

      const delegatedApi = window.JLYDelegatedPayment;
      const record = delegatedClaim && delegatedApi
        ? delegatedApi.createClaim({ settlementId:id, activityId:carId, debtorPersonId:from, paidBy:input.actorPersonId, receiverPersonId:to, amount, reimbursementRequired:input.reimbursementRequired === true })
        : {
        settlementId: id,
        activityId: carId,
        carId,
        fromPersonId: from,
        toPersonId: to,
        amount,
        status: receiverSettle ? "settled" : "payment_claimed",
        paymentClaimedBy: receiverSettle ? from : input.actorPersonId,
        paymentClaimedFor: managerClaim ? from : "",
        claimAuthority: receiverSettle ? "receiver_recorded" : managerClaim ? "manager_for_offline_member" : "self",
        paymentClaimedAt: now,
        confirmedBy: receiverSettle ? input.actorPersonId : "",
        confirmedFor: receiverSettle && input.actorPersonId !== to ? to : "",
        confirmationAuthority: receiverSettle ? input.actorPersonId === to ? "receiver" : "manager_for_offline_member" : "",
        confirmedAt: receiverSettle ? now : "",
        createdAt: now,
        updatedAt: now,
        history: [{
          action: receiverSettle ? "settled" : "payment_claimed",
          actorPersonId: input.actorPersonId,
          forPersonId: managerClaim ? from : "",
          authority: receiverSettle ? input.actorPersonId === to ? "receiver" : "manager_for_offline_member" : managerClaim ? "manager_for_offline_member" : "self",
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
      if (!receiverSettle) transaction.set(actionRef, pending, { merge: false });
      transaction.set(viewRef, invalidateSummary(view, {
        activeNetSettlements: receiverSettle ? (view.activeNetSettlements || []) : [...(view.activeNetSettlements || []), record],
        pendingCounts: receiverSettle ? view.pendingCounts : adjustCounts(view.pendingCounts, [], [pending])
      }, now), { merge: false });
    });
  }

  async function createDelegatedRequest(carId, input) {
    const db=requireDb(),root=db.collection("cars").doc(carId),now=new Date().toISOString();
    const id=`delegate-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const request=window.JLYDelegatedPayment.createRequest({...input,requestId:id,activityId:carId},now);
    const ref=root.collection("accountingDelegatedPayments").doc(id),actionRef=root.collection("accountingPendingActions").doc(`delegate_acceptance-${id}`);
    await ensureActivityView(root);
    await db.runTransaction(async transaction=>{
      const [viewSnapshot,carSnapshot]=await Promise.all([transaction.get(root.collection("accountingViews").doc(viewName)),transaction.get(root)]);
      const view=viewSnapshot.data()||{};
      if(!carSnapshot.exists)throw new Error("activity_not_found");
      const memberIds=activityMemberIds(carSnapshot.data());
      window.JLYDelegatedPayment.requireActivityMember(request.requestedBy,memberIds);
      window.JLYDelegatedPayment.requireActivityMember(request.delegatePersonId,memberIds);
      if(netTransferAmount(view.settlementTransfers||view.obligationsByPair,request.debtorPersonId,request.receiverPersonId)<request.amount)throw new Error("net_settlement_amount_changed");
      transaction.set(ref,request,{merge:false});
      transaction.set(actionRef,{pendingActionId:`delegate_acceptance-${id}`,actionType:"delegated_payment_acceptance",responsiblePersonId:request.delegatePersonId,requestId:id,transactionId:`delegated:${id}`,activityId:carId,carId,status:"pending",createdAt:now,updatedAt:now,completedAt:"",debtorPersonId:request.debtorPersonId,receiverPersonId:request.receiverPersonId,amount:request.amount,reimbursementRequired:request.reimbursementRequired,history:[{status:"pending",actorPersonId:request.requestedBy,at:now}]},{merge:false});
      transaction.set(root.collection("accountingViews").doc(viewName),{schemaVersion:0,updatedAt:now},{merge:true});
    });
    return request;
  }

  async function transitionDelegatedRequest(carId, requestId, action, actorPersonId) {
    const db=requireDb(),root=db.collection("cars").doc(carId),now=new Date().toISOString();
    const ref=root.collection("accountingDelegatedPayments").doc(requestId),pendingRef=root.collection("accountingPendingActions").doc(`delegate_acceptance-${requestId}`);
    await ensureActivityView(root);
    await db.runTransaction(async transaction=>{
      const [requestSnapshot,pendingSnapshot,viewSnapshot,carSnapshot]=await Promise.all([transaction.get(ref),transaction.get(pendingRef),transaction.get(root.collection("accountingViews").doc(viewName)),transaction.get(root)]);
      if(!requestSnapshot.exists)throw new Error("delegated_payment_request_not_found");
      if(!carSnapshot.exists)throw new Error("activity_not_found");
      window.JLYDelegatedPayment.requireActivityMember(actorPersonId,activityMemberIds(carSnapshot.data()));
      const next=window.JLYDelegatedPayment.transitionRequest(requestSnapshot.data(),action,actorPersonId,now);
      const view=viewSnapshot.data()||{};
      if(action==="accept"&&netTransferAmount(view.settlementTransfers||view.obligationsByPair,next.debtorPersonId,next.receiverPersonId)<next.amount)throw new Error("net_settlement_amount_changed");
      transaction.set(ref,next,{merge:false});
      if(pendingSnapshot.exists)transaction.set(pendingRef,{...pendingSnapshot.data(),status:"completed",completedAt:now,updatedAt:now,history:[...(pendingSnapshot.data().history||[]),{status:"completed",action,actorPersonId,at:now}]},{merge:false});
      if(action==="accept"){
        transaction.set(root.collection("accountingPendingActions").doc(`delegate_payment-${requestId}`),{pendingActionId:`delegate_payment-${requestId}`,actionType:"delegated_payment_due",responsiblePersonId:next.delegatePersonId,delegatePersonId:next.delegatePersonId,requestId,transactionId:`delegated:${requestId}`,activityId:carId,carId,status:"pending",createdAt:now,updatedAt:now,completedAt:"",debtorPersonId:next.debtorPersonId,receiverPersonId:next.receiverPersonId,amount:next.amount,history:[{status:"accepted",actorPersonId,at:now}]},{merge:false});
      }
      transaction.set(root.collection("accountingViews").doc(viewName),{schemaVersion:0,updatedAt:now},{merge:true});
    });
  }

  async function claimAcceptedDelegatedRequest(carId, requestId, actorPersonId, requestedAmount) {
    const db=requireDb(),root=db.collection("cars").doc(carId),now=new Date().toISOString();
    const requestRef=root.collection("accountingDelegatedPayments").doc(requestId),pendingRef=root.collection("accountingPendingActions").doc(`delegate_payment-${requestId}`),viewRef=root.collection("accountingViews").doc(viewName);
    await ensureActivityView(root);
    await db.runTransaction(async transaction=>{
      const [requestSnapshot,pendingSnapshot,viewSnapshot,carSnapshot]=await Promise.all([transaction.get(requestRef),transaction.get(pendingRef),transaction.get(viewRef),transaction.get(root)]);
      if(!requestSnapshot.exists)throw new Error("delegated_payment_request_not_found");
      if(!carSnapshot.exists)throw new Error("activity_not_found");
      window.JLYDelegatedPayment.requireActivityMember(actorPersonId,activityMemberIds(carSnapshot.data()));
      const request=requestSnapshot.data();
      if(request.status!=="accepted"||actorPersonId!==request.delegatePersonId)throw new Error("delegated_payment_request_action_not_allowed");
      const amount=Math.round(Number(requestedAmount)||0);
      if(amount<=0||amount>Number(request.amount||0))throw new Error("delegated_payment_amount_invalid");
      const view=viewSnapshot.data()||{};
      if(netTransferAmount(view.settlementTransfers||view.obligationsByPair,request.debtorPersonId,request.receiverPersonId)<amount)throw new Error("net_settlement_amount_changed");
      const settlementId=`net-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const claim=window.JLYDelegatedPayment.createClaim({settlementId,activityId:carId,debtorPersonId:request.debtorPersonId,paidBy:actorPersonId,receiverPersonId:request.receiverPersonId,amount,delegatedRequestId:requestId,reimbursementRequired:false},now);
      transaction.set(root.collection("accountingSettlements").doc(settlementId),claim,{merge:false});
      transaction.set(requestRef,{...request,status:"payment_claimed",claimedAmount:amount,settlementId,paymentClaimedAt:now,updatedAt:now,history:[...(request.history||[]),{action:"payment_claimed",actorPersonId,amount,at:now}]},{merge:false});
      if(pendingSnapshot.exists)transaction.set(pendingRef,{...pendingSnapshot.data(),status:"completed",completedAt:now,updatedAt:now,history:[...(pendingSnapshot.data().history||[]),{status:"completed",actorPersonId,at:now}]},{merge:false});
      transaction.set(root.collection("accountingPendingActions").doc(`net_confirmation-${settlementId}`),{pendingActionId:`net_confirmation-${settlementId}`,actionType:"payment_confirmation",responsiblePersonId:request.receiverPersonId,settlementId,requestId,transactionId:`delegated:${requestId}`,activityId:carId,carId,status:"pending",createdAt:now,updatedAt:now,completedAt:"",history:[{status:"pending",actorPersonId,at:now}]},{merge:false});
      transaction.set(viewRef,{schemaVersion:0,updatedAt:now},{merge:true});
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
        if (actorPersonId !== (record.paymentClaimedBy || record.fromPersonId)) throw new Error("net_settlement_not_allowed");
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
    loadSettlementHistory,
    createQuickTransaction,
    completeSplit,
    saveSettlement,
    claimNetSettlement,
    transitionNetSettlement,
    createDelegatedRequest,
    transitionDelegatedRequest,
    claimAcceptedDelegatedRequest,
    activityMemberIds
  };
})();
