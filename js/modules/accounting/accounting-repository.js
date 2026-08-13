(function () {
  "use strict";
  function requireDb() { if (!window.db) throw new Error("accounting_database_unavailable"); return window.db; }
  const viewName="activityCurrent";
  function actionCounts(actions){const result={total:0,pendingSplit:0,paymentDue:0,paymentConfirmation:0};for(const action of(actions||[])){if(!action||action.status!=="pending")continue;result.total++;if(action.actionType==="pending_split")result.pendingSplit++;else if(action.actionType==="payment_confirmation")result.paymentConfirmation++;else result.paymentDue++;}return result;}
  function balanceMap(transactions){const balances=new Map(),add=(id,value)=>{if(!id||!value)return;balances.set(id,(balances.get(id)||0)+value);};for(const entry of(transactions||[])){if(!entry||entry.status==="deleted"||entry.splitStatus!=="completed")continue;for(const split of(entry.splits||[])){const amount=Number(split.amount)||0;if(!amount||split.personId===entry.paidBy||split.settlementStatus==="settled")continue;add(split.personId,-amount);add(entry.paidBy,amount);}}return [...balances].map(([personId,balance])=>({personId,balance})).filter(item=>item.balance);}
  function buildView(transactions,actions,now){const active=(transactions||[]).filter(item=>item&&item.status!=="deleted").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return{schemaVersion:1,recentTransactions:active.slice(0,5),balanceByPerson:balanceMap(active),pendingCounts:actionCounts(actions),updatedAt:now||new Date().toISOString()};}
  async function ensureActivityView(root){const ref=root.collection("accountingViews").doc(viewName),snapshot=await ref.get();if(snapshot.exists)return snapshot.data();const [entries,actions]=await Promise.all([root.collection("accountingEntries").get(),root.collection("accountingPendingActions").where("status","==","pending").get()]);const view=buildView(entries.docs.map(doc=>({transactionId:doc.id,...doc.data()})),actions.docs.map(doc=>({pendingActionId:doc.id,...doc.data()})));await ref.set(view,{merge:false});return view;}
  async function loadDashboard(carId,currentPersonId) {
    const root = requireDb().collection("cars").doc(carId);
    const view=await ensureActivityView(root);
    let actionQuery=root.collection("accountingPendingActions").where("status","==","pending");
    if(currentPersonId)actionQuery=actionQuery.where("responsiblePersonId","==",currentPersonId);
    const actions=await actionQuery.get();
    return {
      transactions: view.recentTransactions||[], pendingActions: actions.docs.map(doc=>({pendingActionId:doc.id,...doc.data()})),
      pendingCounts:view.pendingCounts||actionCounts([]),balanceByPerson:view.balanceByPerson||[]
    };
  }
  function replaceRecent(view,entry){const recent=(view.recentTransactions||[]).filter(item=>item.transactionId!==entry.transactionId&&item.status!=="deleted");if(entry.status!=="deleted")recent.push(entry);recent.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return recent.slice(0,5);}
  function adjustBalances(items,entry,factor){const map=new Map((items||[]).map(item=>[item.personId,Number(item.balance)||0])),add=(id,value)=>{if(id&&value)map.set(id,(map.get(id)||0)+value);};if(entry&&entry.status!=="deleted"&&entry.splitStatus==="completed")for(const split of(entry.splits||[])){const amount=Number(split.amount)||0;if(!amount||split.personId===entry.paidBy||split.settlementStatus==="settled")continue;add(split.personId,-factor*amount);add(entry.paidBy,factor*amount);}return[...map].map(([personId,balance])=>({personId,balance})).filter(item=>item.balance);}
  function adjustCounts(counts,oldActions,nextActions){const all=[...(oldActions||[]).map(action=>({...action,_factor:-1})),...(nextActions||[]).map(action=>({...action,_factor:1}))],result={total:Number(counts&&counts.total)||0,pendingSplit:Number(counts&&counts.pendingSplit)||0,paymentDue:Number(counts&&counts.paymentDue)||0,paymentConfirmation:Number(counts&&counts.paymentConfirmation)||0};for(const action of all){if(action.status&&action.status!=="pending")continue;result.total+=action._factor;if(action.actionType==="pending_split")result.pendingSplit+=action._factor;else if(action.actionType==="payment_confirmation")result.paymentConfirmation+=action._factor;else result.paymentDue+=action._factor;}Object.keys(result).forEach(key=>result[key]=Math.max(0,result[key]));return result;}
  async function createQuickTransaction(data, managerPersonId) {
    const db = requireDb(), root = db.collection("cars").doc(data.carId);
    const transactionRef = root.collection("accountingEntries").doc(data.transactionId);
    const actionId = `pending_split-${data.transactionId}-${managerPersonId || data.createdBy}`;
    const actionRef = root.collection("accountingPendingActions").doc(actionId);
    await ensureActivityView(root);
    await db.runTransaction(async transaction => {
      const viewRef=root.collection("accountingViews").doc(viewName),[existing,viewSnapshot]=await Promise.all([transaction.get(transactionRef),transaction.get(viewRef)]);
      if (existing.exists) throw new Error("transaction_already_exists");
      transaction.set(transactionRef, { ...data, pendingActionIds: [actionId] }, { merge: false });
      transaction.set(actionRef, {
        pendingActionId: actionId, actionType: "pending_split", responsiblePersonId: managerPersonId || data.createdBy,
        transactionId: data.transactionId, splitId: "", activityId: data.activityId, carId: data.carId,
        status: "pending", createdAt: data.createdAt, updatedAt: data.updatedAt, completedAt: "",
        history: [{ status: "pending", at: data.createdAt }]
      }, { merge: false });
      const action={actionType:"pending_split",status:"pending"},view=viewSnapshot.data()||{};
      transaction.set(viewRef,{...view,recentTransactions:replaceRecent(view,data),pendingCounts:adjustCounts(view.pendingCounts,[],[action]),updatedAt:data.updatedAt},{merge:false});
    });
    return data;
  }
  async function completeSplit(carId, transactionId, splits, actorPersonId, managerPersonId) {
    const db=requireDb(),root=db.collection("cars").doc(carId),entryRef=root.collection("accountingEntries").doc(transactionId),actions=root.collection("accountingPendingActions"),now=new Date().toISOString();
    await ensureActivityView(root);await db.runTransaction(async transaction=>{
      const viewRef=root.collection("accountingViews").doc(viewName),[entrySnapshot,viewSnapshot]=await Promise.all([transaction.get(entryRef),transaction.get(viewRef)]);if(!entrySnapshot.exists)throw new Error("transaction_not_found");
      const entry={transactionId:entrySnapshot.id,...entrySnapshot.data()};
      if(actorPersonId!==entry.createdBy&&actorPersonId!==entry.paidBy&&actorPersonId!==managerPersonId)throw new Error("split_permission_denied");
      const oldIds=Array.isArray(entry.pendingActionIds)?entry.pendingActionIds:[];
      const oldSnapshots=await Promise.all(oldIds.map(id=>transaction.get(actions.doc(id))));
      oldSnapshots.forEach((snapshot,index)=>{if(snapshot.exists){const old=snapshot.data();transaction.set(actions.doc(oldIds[index]),{...old,status:"completed",completedAt:now,updatedAt:now,history:[...(old.history||[]),{status:"completed",at:now,actorPersonId}]},{merge:false});}});
      const pendingIds=[];
      for(const split of splits){if(split.settlementStatus==="settled")continue;const id=`payment_due-${transactionId}-${split.personId}`;pendingIds.push(id);transaction.set(actions.doc(id),{pendingActionId:id,actionType:"payment_due",responsiblePersonId:split.personId,transactionId,splitId:split.splitId,activityId:entry.activityId||carId,carId,status:"pending",createdAt:now,updatedAt:now,completedAt:"",history:[{status:"pending",at:now}]},{merge:false});}
      const nextEntry={...entry,splits,shares:splits,participants:splits.map(split=>split.personId),splitStatus:"completed",settlementStatus:pendingIds.length?"payment_due":"settled",pendingActionIds:pendingIds,updatedAt:now},oldActions=oldSnapshots.filter(item=>item.exists).map(item=>item.data()),nextActions=splits.filter(split=>split.settlementStatus!=="settled").map(split=>({actionType:"payment_due",status:"pending"})),view=viewSnapshot.data()||{};
      transaction.set(entryRef,nextEntry,{merge:false});transaction.set(viewRef,{...view,recentTransactions:replaceRecent(view,nextEntry),balanceByPerson:adjustBalances(adjustBalances(view.balanceByPerson,entry,-1),nextEntry,1),pendingCounts:adjustCounts(view.pendingCounts,oldActions,nextActions),updatedAt:now},{merge:false});
    });
  }
  async function saveSettlement(carId, transactionId, splitId, nextSplit, actorPersonId) {
    const db=requireDb(),root=db.collection("cars").doc(carId),entryRef=root.collection("accountingEntries").doc(transactionId),actions=root.collection("accountingPendingActions"),now=new Date().toISOString();
    await ensureActivityView(root);await db.runTransaction(async transaction=>{
      const viewRef=root.collection("accountingViews").doc(viewName),[entrySnapshot,viewSnapshot]=await Promise.all([transaction.get(entryRef),transaction.get(viewRef)]);if(!entrySnapshot.exists)throw new Error("transaction_not_found");
      const entry={transactionId:entrySnapshot.id,...entrySnapshot.data()},splits=(entry.splits||[]).map(split=>split.splitId===splitId?nextSplit:split);
      if(!splits.some(split=>split.splitId===splitId))throw new Error("split_not_found");
      const oldIds=Array.isArray(entry.pendingActionIds)?entry.pendingActionIds:[],oldSnapshots=await Promise.all(oldIds.map(id=>transaction.get(actions.doc(id))));
      const nextActions=[];
      for(const split of splits){if(split.personId===entry.paidBy||split.settlementStatus==="settled")continue;const type=split.settlementStatus==="payment_claimed"?"payment_confirmation":split.settlementStatus==="settlement_rejected"?"settlement_rejected":"payment_due",responsible=type==="payment_confirmation"?entry.paidBy:split.personId,id=`${type}-${transactionId}-${split.splitId}`;nextActions.push({pendingActionId:id,actionType:type,responsiblePersonId:responsible,transactionId,splitId:split.splitId,activityId:entry.activityId||carId,carId,status:"pending",createdAt:now,updatedAt:now,completedAt:"",history:[{status:"pending",at:now,actorPersonId}]});}
      const nextIds=new Set(nextActions.map(item=>item.pendingActionId));
      oldSnapshots.forEach((snapshot,index)=>{if(snapshot.exists&&!nextIds.has(oldIds[index])){const old=snapshot.data();transaction.set(actions.doc(oldIds[index]),{...old,status:"completed",completedAt:now,updatedAt:now,history:[...(old.history||[]),{status:"completed",at:now,actorPersonId}]},{merge:false});}});
      nextActions.forEach(action=>transaction.set(actions.doc(action.pendingActionId),action,{merge:true}));
      const pendingActionIds=nextActions.map(action=>action.pendingActionId),settlementStatus=splits.length&&splits.every(split=>split.settlementStatus==="settled")?"settled":"pending";
      const nextEntry={...entry,splits,shares:splits,settlementStatus,pendingActionIds,updatedAt:now},oldActions=oldSnapshots.filter(item=>item.exists).map(item=>item.data()),view=viewSnapshot.data()||{};
      transaction.set(entryRef,nextEntry,{merge:false});transaction.set(viewRef,{...view,recentTransactions:replaceRecent(view,nextEntry),balanceByPerson:adjustBalances(adjustBalances(view.balanceByPerson,entry,-1),nextEntry,1),pendingCounts:adjustCounts(view.pendingCounts,oldActions,nextActions),updatedAt:now},{merge:false});
    });
  }
  async function loadTransactionPage(carId,pageSize,lastDocument){let query=requireDb().collection("cars").doc(carId).collection("accountingEntries").orderBy("createdAt","desc").limit(pageSize||10);if(lastDocument)query=query.startAfter(lastDocument);const snapshot=await query.get();return{transactions:snapshot.docs.map(doc=>({transactionId:doc.id,...doc.data()})).filter(item=>item.status!=="deleted"),lastDocument:snapshot.docs[snapshot.docs.length-1]||null,hasMore:snapshot.docs.length===(pageSize||10)};}
  window.JLYAccountingRepository = { loadDashboard, loadTransactionPage, createQuickTransaction, completeSplit, saveSettlement };
})();
