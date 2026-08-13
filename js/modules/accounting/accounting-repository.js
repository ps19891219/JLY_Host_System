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
  async function completeSplit(carId, transactionId, splits, actorPersonId, managerPersonId) {
    const db=requireDb(),root=db.collection("cars").doc(carId),entryRef=root.collection("accountingEntries").doc(transactionId),actions=root.collection("accountingPendingActions"),now=new Date().toISOString();
    await db.runTransaction(async transaction=>{
      const entrySnapshot=await transaction.get(entryRef);if(!entrySnapshot.exists)throw new Error("transaction_not_found");
      const entry={transactionId:entrySnapshot.id,...entrySnapshot.data()};
      if(actorPersonId!==entry.createdBy&&actorPersonId!==entry.paidBy&&actorPersonId!==managerPersonId)throw new Error("split_permission_denied");
      const oldIds=Array.isArray(entry.pendingActionIds)?entry.pendingActionIds:[];
      const oldSnapshots=await Promise.all(oldIds.map(id=>transaction.get(actions.doc(id))));
      oldSnapshots.forEach((snapshot,index)=>{if(snapshot.exists){const old=snapshot.data();transaction.set(actions.doc(oldIds[index]),{...old,status:"completed",completedAt:now,updatedAt:now,history:[...(old.history||[]),{status:"completed",at:now,actorPersonId}]},{merge:false});}});
      const pendingIds=[];
      for(const split of splits){if(split.settlementStatus==="settled")continue;const id=`payment_due-${transactionId}-${split.personId}`;pendingIds.push(id);transaction.set(actions.doc(id),{pendingActionId:id,actionType:"payment_due",responsiblePersonId:split.personId,transactionId,splitId:split.splitId,activityId:entry.activityId||carId,carId,status:"pending",createdAt:now,updatedAt:now,completedAt:"",history:[{status:"pending",at:now}]},{merge:false});}
      transaction.set(entryRef,{...entry,splits,shares:splits,participants:splits.map(split=>split.personId),splitStatus:"completed",settlementStatus:pendingIds.length?"payment_due":"settled",pendingActionIds:pendingIds,updatedAt:now},{merge:false});
    });
  }
  async function saveSettlement(carId, transactionId, splitId, nextSplit, actorPersonId) {
    const db=requireDb(),root=db.collection("cars").doc(carId),entryRef=root.collection("accountingEntries").doc(transactionId),actions=root.collection("accountingPendingActions"),now=new Date().toISOString();
    await db.runTransaction(async transaction=>{
      const entrySnapshot=await transaction.get(entryRef);if(!entrySnapshot.exists)throw new Error("transaction_not_found");
      const entry={transactionId:entrySnapshot.id,...entrySnapshot.data()},splits=(entry.splits||[]).map(split=>split.splitId===splitId?nextSplit:split);
      if(!splits.some(split=>split.splitId===splitId))throw new Error("split_not_found");
      const oldIds=Array.isArray(entry.pendingActionIds)?entry.pendingActionIds:[],oldSnapshots=await Promise.all(oldIds.map(id=>transaction.get(actions.doc(id))));
      const nextActions=[];
      for(const split of splits){if(split.personId===entry.paidBy||split.settlementStatus==="settled")continue;const type=split.settlementStatus==="payment_claimed"?"payment_confirmation":split.settlementStatus==="settlement_rejected"?"settlement_rejected":"payment_due",responsible=type==="payment_confirmation"?entry.paidBy:split.personId,id=`${type}-${transactionId}-${split.splitId}`;nextActions.push({pendingActionId:id,actionType:type,responsiblePersonId:responsible,transactionId,splitId:split.splitId,activityId:entry.activityId||carId,carId,status:"pending",createdAt:now,updatedAt:now,completedAt:"",history:[{status:"pending",at:now,actorPersonId}]});}
      const nextIds=new Set(nextActions.map(item=>item.pendingActionId));
      oldSnapshots.forEach((snapshot,index)=>{if(snapshot.exists&&!nextIds.has(oldIds[index])){const old=snapshot.data();transaction.set(actions.doc(oldIds[index]),{...old,status:"completed",completedAt:now,updatedAt:now,history:[...(old.history||[]),{status:"completed",at:now,actorPersonId}]},{merge:false});}});
      nextActions.forEach(action=>transaction.set(actions.doc(action.pendingActionId),action,{merge:true}));
      const pendingActionIds=nextActions.map(action=>action.pendingActionId),settlementStatus=splits.length&&splits.every(split=>split.settlementStatus==="settled")?"settled":nextSplit.settlementStatus;
      transaction.set(entryRef,{...entry,splits,shares:splits,settlementStatus,pendingActionIds,updatedAt:now},{merge:false});
    });
  }
  window.JLYAccountingRepository = { loadDashboard, createQuickTransaction, completeSplit, saveSettlement };
})();
