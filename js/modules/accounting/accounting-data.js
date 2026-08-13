(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JLYAccountingData = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const text = value => String(value == null ? "" : value).trim();
  const unique = values => [...new Set((values || []).map(text).filter(Boolean))];
  function person(source, role) {
    const item = source && typeof source === "object" ? source : {};
    const nested = item.memberSnapshot || item.member || item.player || {};
    const personId = text(item.personId || item.memberId || item.playerId || item.profileId || item.id || nested.personId || nested.memberId || nested.playerId || nested.profileId || nested.id);
    if (!personId) return null;
    const identityIds = unique([personId, item.identityId, item.memberId, item.playerId, item.profileId, item.id, ...(Array.isArray(item.linkedPlayerIds) ? item.linkedPlayerIds : []), nested.identityId, nested.memberId, nested.playerId, nested.profileId, nested.id, ...(Array.isArray(nested.linkedPlayerIds) ? nested.linkedPlayerIds : [])]);
    const usesSystem = Boolean(text(item.memberId || item.profileId || item.identityId || item.lineUserId || nested.memberId || nested.profileId || nested.identityId || nested.lineUserId));
    return { personId, identityIds, displayName: text(item.displayName || item.playerName || item.name || item.nickname || nested.displayName || nested.playerName || nested.name || nested.nickname) || "未命名成員", roles: [role], usesSystem };
  }
  function collectActivityMembers(car) {
    const source = car || {}, map = new Map();
    function add(item) { if (!item) return; const previous = map.get(item.personId); if (previous) { previous.roles = unique([...previous.roles, ...item.roles]); previous.identityIds = unique([...previous.identityIds, ...item.identityIds]); previous.usesSystem=previous.usesSystem||item.usesSystem; } else map.set(item.personId, item); }
    add(person({ personId: source.ownerId, memberId: source.ownerMemberId, identityId: source.ownerId, displayName: source.ownerName || "車團主揪" }, "owner"));
    (Array.isArray(source.players) ? source.players : []).filter(item => item && item.status !== "已取消" && item.status !== "cancelled").forEach(item => add(person(item, "player")));
    (Array.isArray(source.staffSlots) ? source.staffSlots : []).forEach(item => add(person(item, "staff")));
    return [...map.values()];
  }
  function getCurrentPersonId(storage) {
    return text(storage && (storage.getItem("currentPlayerProfileId") || storage.getItem("currentPlayerId")));
  }
  function getCurrentIdentity(storage, identityApi) {
    let linked = [];
    try { linked = JSON.parse(storage && storage.getItem("linkedPlayerIds") || "[]"); } catch (_) { linked = []; }
    const ids = identityApi && typeof identityApi.getAllPlayerIdentityIds === "function"
      ? identityApi.getAllPlayerIdentityIds()
      : [storage && storage.getItem("currentPlayerProfileId"), storage && storage.getItem("currentPlayerId"), ...linked];
    return { identityIds: unique(ids), displayName: text(identityApi && typeof identityApi.getCurrentPlayerName === "function" ? identityApi.getCurrentPlayerName() : storage && storage.getItem("currentPlayerName")) };
  }
  function resolveCurrentActivityMember(members, identity) {
    const currentIds = new Set(identity && identity.identityIds || []);
    const member = (members || []).find(item => (item.identityIds || [item.personId]).some(id => currentIds.has(id)));
    if (!member) return null;
    return { ...member, displayName: text(identity.displayName) || member.displayName };
  }
  function buildQuickTransaction(input, now) {
    const transactionId = text(input.transactionId);
    const activityId = text(input.activityId || input.carId);
    const createdBy = text(input.createdBy), paidBy = text(input.paidBy || createdBy), title = text(input.title);
    const amount = Number(input.amount);
    if (!transactionId || !activityId || !createdBy || !paidBy || !title || !Number.isFinite(amount) || amount <= 0) throw new Error("quick_transaction_invalid");
    const timestamp = text(now) || new Date().toISOString();
    return {
      transactionId, activityId, activityType: "car", villageType: "script_village", carId: activityId,
      type: "expense", title, description: title, category: "uncategorized", amount, currency: "TWD",
      createdBy, actorMemberId: createdBy, paidBy, payerMemberId: paidBy,
      participants: [], splits: [], shares: [], splitStatus: "pending", settlementStatus: "pending",
      note: "", source: "car_detail_quick_entry", status: "active", createdAt: timestamp, updatedAt: timestamp,
      schemaVersion: 1
    };
  }
  function buildEqualSplits(participants, totalAmount, paidBy) {
    const people = Array.isArray(participants) ? participants : [];
    const total = Number(totalAmount);
    if (!people.length || !Number.isFinite(total) || total <= 0) throw new Error("split_invalid");
    const base = Math.floor(total / people.length);
    return people.map((member, index) => ({
      splitId: `split-${member.personId}`,
      personId: member.personId,
      displayName: member.displayName,
      amount: index === people.length - 1 ? total - base * (people.length - 1) : base,
      settlementStatus: member.personId === paidBy ? "settled" : "payment_due"
    }));
  }
  function buildCustomSplits(participants, amounts, totalAmount, paidBy) {
    const splits = (participants || []).map(member => ({
      splitId: `split-${member.personId}`,
      personId: member.personId,
      displayName: member.displayName,
      amount: Number(amounts && amounts[member.personId]),
      settlementStatus: member.personId === paidBy ? "settled" : "payment_due"
    }));
    const total = splits.reduce((sum, split) => sum + split.amount, 0);
    if (!splits.length || splits.some(split => !Number.isFinite(split.amount) || split.amount < 0) || total !== Number(totalAmount)) throw new Error("split_total_mismatch");
    return splits;
  }
  function transitionSettlement(split, action, actorPersonId, receiverPersonId, now, managerPersonId, targetUsesSystem) {
    const current = { ...split }, actor = text(actorPersonId), receiver = text(receiverPersonId), timestamp = text(now) || new Date().toISOString();
    if (action === "claim") {
      if (actor !== current.personId || !["payment_due", "settlement_rejected"].includes(current.settlementStatus)) throw new Error("settlement_action_not_allowed");
      return { ...current, settlementStatus: "payment_claimed", paymentClaimedBy: actor, paymentClaimedAt: timestamp, rejectedBy: "", rejectedAt: "" };
    }
    if (action === "manager_claim") {
      if (targetUsesSystem || actor !== text(managerPersonId) || !["payment_due", "settlement_rejected"].includes(current.settlementStatus)) throw new Error("settlement_action_not_allowed");
      return { ...current, settlementStatus: "payment_claimed", paymentClaimedBy: current.personId, paymentClaimedAt: timestamp, paymentRecordedBy: actor, paymentRecordSource: "manager", rejectedBy: "", rejectedAt: "" };
    }
    if (action === "receiver_settle") {
      const isReceiver=actor===receiver,isManager=actor===text(managerPersonId);
      if ((!isReceiver&&(!isManager||targetUsesSystem)) || !["payment_due", "settlement_rejected"].includes(current.settlementStatus)) throw new Error("settlement_action_not_allowed");
      return { ...current, settlementStatus: "settled", paymentClaimedBy: current.personId, paymentClaimedAt: timestamp, paymentRecordedBy: actor, paymentRecordSource: isReceiver?"receiver":"manager_override", confirmedBy: actor, confirmedAt: timestamp, confirmationAuthority:isReceiver?"receiver":"manager" };
    }
    if (action === "withdraw") {
      if (current.settlementStatus !== "payment_claimed" || current.paymentClaimedBy !== actor) throw new Error("settlement_action_not_allowed");
      return { ...current, settlementStatus: "payment_due", paymentClaimedBy: "", paymentClaimedAt: "" };
    }
    const canConfirm=actor===receiver||(actor===text(managerPersonId)&&!targetUsesSystem);
    if (!["confirm", "reject"].includes(action) || !canConfirm || current.settlementStatus !== "payment_claimed") throw new Error("settlement_action_not_allowed");
    return action === "confirm"
      ? { ...current, settlementStatus: "settled", confirmedBy: actor, confirmedAt: timestamp, confirmationAuthority:actor===receiver?"receiver":"manager" }
      : { ...current, settlementStatus: "settlement_rejected", rejectedBy: actor, rejectedAt: timestamp, rejectionAuthority:actor===receiver?"receiver":"manager", confirmedBy: "", confirmedAt: "" };
  }
  function transactionFilterState(transaction, currentPersonId) {
    const item=transaction||{},splits=Array.isArray(item.splits)?item.splits:[],mine=splits.find(split=>split.personId===currentPersonId);
    if(item.splitStatus==="pending")return "pending_split";
    if(splits.length&&splits.every(split=>split.settlementStatus==="settled"))return "settled";
    if(splits.some(split=>split.settlementStatus==="payment_claimed")&&item.paidBy===currentPersonId)return "payment_confirmation";
    if(mine&&["payment_due","settlement_rejected"].includes(mine.settlementStatus))return "payment_due";
    return "pending_other";
  }
  function filterTransactions(transactions, filter, currentPersonId) {
    const list=Array.isArray(transactions)?transactions:[];
    if(filter==="all")return list;
    if(filter==="pending")return list.filter(item=>transactionFilterState(item,currentPersonId)!=="settled");
    return list.filter(item=>transactionFilterState(item,currentPersonId)===filter);
  }
  function calculateNetSettlement(transactions) {
    const balances = new Map();
    const add = (personId, value) => {
      const id = text(personId), amount = Number(value);
      if (!id || !Number.isFinite(amount) || amount === 0) return;
      balances.set(id, (balances.get(id) || 0) + amount);
    };
    (Array.isArray(transactions) ? transactions : []).forEach(transaction => {
      if (!transaction || transaction.status === "deleted" || transaction.splitStatus !== "completed") return;
      const receiver = text(transaction.paidBy || transaction.payerMemberId);
      if (!receiver) return;
      (Array.isArray(transaction.splits) ? transaction.splits : []).forEach(split => {
        const debtor = text(split && split.personId), amount = Number(split && split.amount);
        if (!debtor || debtor === receiver || split.settlementStatus === "settled" || !Number.isFinite(amount) || amount <= 0) return;
        add(debtor, -amount);
        add(receiver, amount);
      });
    });
    const debtors = [], creditors = [];
    balances.forEach((balance, personId) => {
      const rounded = Math.round(balance);
      if (rounded < 0) debtors.push({ personId, amount: -rounded });
      if (rounded > 0) creditors.push({ personId, amount: rounded });
    });
    debtors.sort((a,b) => b.amount-a.amount || a.personId.localeCompare(b.personId));
    creditors.sort((a,b) => b.amount-a.amount || a.personId.localeCompare(b.personId));
    const transfers = [];
    let debtorIndex = 0, creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex], creditor = creditors[creditorIndex];
      const amount = Math.min(debtor.amount, creditor.amount);
      if (amount > 0) transfers.push({ fromPersonId: debtor.personId, toPersonId: creditor.personId, amount });
      debtor.amount -= amount;
      creditor.amount -= amount;
      if (debtor.amount === 0) debtorIndex += 1;
      if (creditor.amount === 0) creditorIndex += 1;
    }
    return { balances: [...balances].map(([personId,balance]) => ({ personId, balance: Math.round(balance) })).filter(item => item.balance !== 0), transfers };
  }
  function netSettlementFromBalances(items) {
    const balances = new Map();
    (Array.isArray(items) ? items : []).forEach(item=>{const id=text(item&&item.personId),balance=Math.round(Number(item&&item.balance)||0);if(id&&balance)balances.set(id,(balances.get(id)||0)+balance);});
    const debtors = [...balances].filter(([,balance]) => balance < 0).map(([personId,balance]) => ({ personId, amount: -balance })).sort((a,b)=>b.amount-a.amount);
    const creditors = [...balances].filter(([,balance]) => balance > 0).map(([personId,balance]) => ({ personId, amount: balance })).sort((a,b)=>b.amount-a.amount);
    const transfers=[];let i=0,j=0;
    while(i<debtors.length&&j<creditors.length){if(debtors[i].personId===creditors[j].personId){i++;continue;}const amount=Math.min(debtors[i].amount,creditors[j].amount);if(amount>0)transfers.push({fromPersonId:debtors[i].personId,toPersonId:creditors[j].personId,amount});debtors[i].amount-=amount;creditors[j].amount-=amount;if(!debtors[i].amount)i++;if(!creditors[j].amount)j++;}
    return { balances:[...balances].map(([personId,balance])=>({personId,balance})).filter(item=>item.balance), transfers };
  }
  function personalSettlement(netSettlement, personId) {
    const id=text(personId),transfers=(netSettlement&&netSettlement.transfers||[]).filter(item=>item.fromPersonId===id||item.toPersonId===id);
    return { transfers, payable:transfers.filter(item=>item.fromPersonId===id).reduce((sum,item)=>sum+item.amount,0), receivable:transfers.filter(item=>item.toPersonId===id).reduce((sum,item)=>sum+item.amount,0) };
  }
  function personalObligations(items,personId){const id=text(personId),list=(Array.isArray(items)?items:[]).filter(item=>item.fromPersonId===id||item.toPersonId===id);return{payable:list.filter(item=>item.fromPersonId===id),receivable:list.filter(item=>item.toPersonId===id),payableTotal:list.filter(item=>item.fromPersonId===id).reduce((sum,item)=>sum+(Number(item.amount)||0),0),receivableTotal:list.filter(item=>item.toPersonId===id).reduce((sum,item)=>sum+(Number(item.amount)||0),0)};}
  return { collectActivityMembers, getCurrentPersonId, getCurrentIdentity, resolveCurrentActivityMember, buildQuickTransaction, buildEqualSplits, buildCustomSplits, transitionSettlement, transactionFilterState, filterTransactions, calculateNetSettlement, netSettlementFromBalances, personalSettlement, personalObligations };
});
