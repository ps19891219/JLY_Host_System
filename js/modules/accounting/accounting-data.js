(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JLYAccountingData = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const text = value => String(value == null ? "" : value).trim();
  function person(source, role) {
    const item = source && typeof source === "object" ? source : {};
    const nested = item.memberSnapshot || item.member || item.player || {};
    const personId = text(item.personId || item.memberId || item.playerId || item.profileId || item.id || nested.personId || nested.memberId || nested.playerId || nested.profileId || nested.id);
    if (!personId) return null;
    return { personId, displayName: text(item.displayName || item.playerName || item.name || item.nickname || nested.displayName || nested.playerName || nested.name || nested.nickname) || "未命名成員", roles: [role] };
  }
  function collectActivityMembers(car) {
    const source = car || {}, map = new Map();
    function add(item) { if (!item) return; const previous = map.get(item.personId); if (previous) previous.roles = [...new Set([...previous.roles, ...item.roles])]; else map.set(item.personId, item); }
    add(person({ personId: source.ownerId, displayName: source.ownerName || source.organizerName || source.organizer }, "owner"));
    (Array.isArray(source.players) ? source.players : []).filter(item => item && item.status !== "已取消" && item.status !== "cancelled").forEach(item => add(person(item, "player")));
    (Array.isArray(source.staffSlots) ? source.staffSlots : []).forEach(item => add(person(item, "staff")));
    return [...map.values()];
  }
  function getCurrentPersonId(storage) {
    return text(storage && (storage.getItem("currentPlayerProfileId") || storage.getItem("currentPlayerId")));
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
  return { collectActivityMembers, getCurrentPersonId, buildQuickTransaction };
});
