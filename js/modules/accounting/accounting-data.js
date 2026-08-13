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
    return { personId, identityIds, displayName: text(item.displayName || item.playerName || item.name || item.nickname || nested.displayName || nested.playerName || nested.name || nested.nickname) || "未命名成員", roles: [role] };
  }
  function collectActivityMembers(car) {
    const source = car || {}, map = new Map();
    function add(item) { if (!item) return; const previous = map.get(item.personId); if (previous) { previous.roles = unique([...previous.roles, ...item.roles]); previous.identityIds = unique([...previous.identityIds, ...item.identityIds]); } else map.set(item.personId, item); }
    add(person({ personId: source.ownerId, displayName: source.ownerName || "車團主揪" }, "owner"));
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
  return { collectActivityMembers, getCurrentPersonId, getCurrentIdentity, resolveCurrentActivityMember, buildQuickTransaction, buildEqualSplits, buildCustomSplits };
});
