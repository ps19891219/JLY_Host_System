(function () {
  "use strict";
  function requireDb() { if (!window.db) throw new Error("accounting_database_unavailable"); return window.db; }
  async function loadDashboard(carId) {
    const root = requireDb().collection("cars").doc(carId);
    const [transactions, actions] = await Promise.all([
      root.collection("accountingEntries").orderBy("createdAt", "desc").limit(20).get(),
      root.collection("accountingPendingActions").where("status", "==", "pending").get()
    ]);
    return {
      transactions: transactions.docs.map(doc => ({ transactionId: doc.id, ...doc.data() })).filter(item => item.status !== "deleted"),
      pendingActions: actions.docs.map(doc => ({ pendingActionId: doc.id, ...doc.data() }))
    };
  }
  async function createQuickTransaction(data, managerPersonId) {
    const db = requireDb(), root = db.collection("cars").doc(data.carId);
    const transactionRef = root.collection("accountingEntries").doc(data.transactionId);
    const actionId = `pending_split-${data.transactionId}-${managerPersonId || data.createdBy}`;
    const actionRef = root.collection("accountingPendingActions").doc(actionId);
    await db.runTransaction(async transaction => {
      const existing = await transaction.get(transactionRef);
      if (existing.exists) throw new Error("transaction_already_exists");
      transaction.set(transactionRef, { ...data, pendingActionIds: [actionId] }, { merge: false });
      transaction.set(actionRef, {
        pendingActionId: actionId, actionType: "pending_split", responsiblePersonId: managerPersonId || data.createdBy,
        transactionId: data.transactionId, splitId: "", activityId: data.activityId, carId: data.carId,
        status: "pending", createdAt: data.createdAt, updatedAt: data.updatedAt, completedAt: "",
        history: [{ status: "pending", at: data.createdAt }]
      }, { merge: false });
    });
    return data;
  }
  window.JLYAccountingRepository = { loadDashboard, createQuickTransaction };
})();
