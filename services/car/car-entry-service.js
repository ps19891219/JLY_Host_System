"use strict";

const { getFirestore } = require("../firebase/admin");
const { identityIds } = require("./car-view-access");

function text(value) { return String(value == null ? "" : value).trim(); }
function lower(value) { return text(value).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }
function applicationId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isSyntheticLineId(value) {
  return /^line:/i.test(text(value));
}

function formalProfileId(session) {
  const value = text(session && session.profileId);
  if (!value || session && session.provisional === true || isSyntheticLineId(value)) return "";
  return value;
}

function sessionIds(session) {
  return new Set([
    formalProfileId(session),
    session && session.identityId
  ].map(text).filter(Boolean));
}

function displayName(value) {
  const source = value && typeof value === "object" ? value : {};
  return text(source.displayName || source.playerName || source.name || source.nickname || source.staffName || source.dmName);
}

function sameIdentity(value, session) {
  const ids = sessionIds(session);
  return ids.size > 0 && identityIds(value).some(id => ids.has(id));
}

function sameLineIdentity(value, session) {
  const expected = text(session && session.lineUserId);
  return Boolean(expected && text(value && value.lineUserId) === expected);
}

function matchesViewer(value, session) {
  if (sameLineIdentity(value, session) || sameIdentity(value, session)) return true;
  if (text(session && session.lineUserId) || session && session.provisional === true) return false;
  const viewerName = lower(session && session.displayName);
  return Boolean(viewerName && lower(displayName(value)) === viewerName);
}

function active(value) {
  const status = lower(value && value.status);
  return !["cancelled", "canceled", "已取消", "取消", "rejected", "拒絕"].includes(status);
}

function pending(value) {
  const status = lower(value && value.status);
  return !status || ["pending", "待審核", "等待審核", "待確認"].includes(status);
}

function requireSession(session) {
  const lineUserId = text(session && session.lineUserId);
  if (!lineUserId) {
    const error = new Error("identity_required");
    error.code = "identity_required";
    throw error;
  }
  return session;
}

function baseIdentity(session) {
  requireSession(session);
  const profileId = formalProfileId(session);
  return {
    memberId: profileId,
    profileId,
    identityId: profileId ? text(session && session.identityId) : "",
    lineUserId: text(session && session.lineUserId),
    lineDisplayName: text(session && session.displayName),
    claimantDisplayName: text(session && session.displayName),
    provisionalIdentity: !profileId,
    displayName: text(session && session.displayName)
  };
}

function assertPlayerAvailable(car, session) {
  const players = Array.isArray(car.players) ? car.players : [];
  const applications = Array.isArray(car.applications) ? car.applications : [];
  if (players.some(item => active(item) && (sameIdentity(item, session) || sameLineIdentity(item, session)))) {
    const error = new Error("already_player"); error.code = "already_player"; throw error;
  }
  if (applications.some(item => pending(item) && matchesViewer(item, session))) {
    const error = new Error("player_application_pending"); error.code = "player_application_pending"; throw error;
  }
}

function assertDmAvailable(car, session) {
  const staff = Array.isArray(car.staffSlots) ? car.staffSlots : [];
  const applications = Array.isArray(car.dmApplications) ? car.dmApplications : [];
  if (staff.some(item => active(item) && (sameIdentity(item, session) || sameLineIdentity(item, session)))) {
    const error = new Error("already_staff"); error.code = "already_staff"; throw error;
  }
  if (applications.some(item => pending(item) && matchesViewer(item, session))) {
    const error = new Error("dm_application_pending"); error.code = "dm_application_pending"; throw error;
  }
}

function playerCapacity(car) {
  const value = Number(car && (car.totalPeople || car.capacity || 0));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function activePlayerCount(car) {
  return (Array.isArray(car && car.players) ? car.players : []).filter(active).length;
}

function assertNewPlayerCapacity(car) {
  const capacity = playerCapacity(car);
  if (capacity > 0 && activePlayerCount(car) >= capacity) {
    const error = new Error("player_capacity_full"); error.code = "player_capacity_full"; throw error;
  }
}

function hasAvailableStaffSlot(car) {
  const slots = Array.isArray(car && car.staffSlots) ? car.staffSlots.filter(active) : [];
  if (!slots.length) return true;
  return slots.some(slot => !displayName(slot));
}

function assertNewDmCapacity(car) {
  if (!hasAvailableStaffSlot(car)) {
    const error = new Error("dm_capacity_full"); error.code = "dm_capacity_full"; throw error;
  }
}

function rosterId(value) {
  const source = value && typeof value === "object" ? value : {};
  return text(source.playerId || source.id || source.profileId || source.memberId);
}

function hasDifferentLineBinding(value, session) {
  const bound = text(value && value.lineUserId);
  const claimant = text(session && session.lineUserId);
  return Boolean(bound && claimant && bound !== claimant);
}

function findClaimablePlayer(car, targetPlayerId, session) {
  const id = text(targetPlayerId);
  if (!id) return null;
  return (Array.isArray(car.players) ? car.players : []).find(function (player) {
    return active(player) && rosterId(player) === id && Boolean(displayName(player)) &&
      !hasDifferentLineBinding(player, session);
  }) || null;
}

function findClaimableStaffSlot(car, targetStaffId, session) {
  const id = text(targetStaffId);
  if (!id) return null;
  return (Array.isArray(car.staffSlots) ? car.staffSlots : []).find(function (slot) {
    return active(slot) && text(slot && (slot.id || slot.slotId)) === id && Boolean(displayName(slot)) &&
      !hasDifferentLineBinding(slot, session);
  }) || null;
}

function claimPersonId(value) {
  const source = value && typeof value === "object" ? value : {};
  const nested = source.player && typeof source.player === "object" ? source.player : {};
  return [
    source.personId, source.memberId, source.profileId, source.playerId,
    nested.personId, nested.memberId, nested.profileId, nested.playerId, nested.id
  ].map(text).find(id => id && !isSyntheticLineId(id)) || "";
}

async function submitCarEntry(input, session, dependencies = {}) {
  const carId = text(input && input.carId);
  const type = lower(input && input.type);
  if (!carId) {
    const error = new Error("car_id_required"); error.code = "car_id_required"; throw error;
  }
  if (!["player", "dm"].includes(type)) {
    const error = new Error("entry_type_invalid"); error.code = "entry_type_invalid"; throw error;
  }

  const identity = baseIdentity(session);
  const db = dependencies.db || getFirestore();
  const carRef = db.collection("cars").doc(carId);
  let result = null;

  await db.runTransaction(async function (transaction) {
    const snap = await transaction.get(carRef);
    if (!snap.exists) {
      const error = new Error("car_not_found"); error.code = "car_not_found"; throw error;
    }
    const car = { id: snap.id, ...snap.data() };
    const timestamp = nowIso();

    if (type === "player") {
      assertPlayerAvailable(car, session);
      const target = findClaimablePlayer(car, input.targetPlayerId, session);
      if (text(input.targetPlayerId) && !target) {
        const error = new Error("player_claim_unavailable"); error.code = "player_claim_unavailable"; throw error;
      }
      if (!target) assertNewPlayerCapacity(car);
      const position = text(input.position || input.role || target && (target.position || target.roleChoice) || "不限") || "不限";
      const applications = Array.isArray(car.applications) ? car.applications.map(item => ({ ...item })) : [];
      const id = applicationId("player_app");
      const targetName = target ? displayName(target) : "";
      applications.push({
        id,
        ...identity,
        name: targetName || identity.displayName,
        playerName: targetName || identity.displayName,
        role: position,
        position,
        isCrossPlay: input.isCrossPlay === true,
        status: "pending",
        source: "car_view_identity_claim",
        claimType: target ? "existing_person" : "new_person",
        targetPlayerId: target ? rosterId(target) : "",
        targetPlayerName: targetName,
        targetPersonId: target ? claimPersonId(target) : "",
        requestedActivityRole: "player",
        createdAt: timestamp,
        updatedAt: timestamp
      });
      transaction.update(carRef, { applications, updatedAt: timestamp });
      result = { id, status: "pending", type: "player", claimType: target ? "existing_person" : "new_person" };
      return;
    }

    assertDmAvailable(car, session);
    const target = findClaimableStaffSlot(car, input.targetStaffId, session);
    if (text(input.targetStaffId) && !target) {
      const error = new Error("staff_slot_unavailable"); error.code = "staff_slot_unavailable"; throw error;
    }
    if (!target) assertNewDmCapacity(car);
    const applications = Array.isArray(car.dmApplications) ? car.dmApplications.map(item => ({ ...item })) : [];
    const id = applicationId("dm_app");
    const targetName = target ? displayName(target) : "";
    applications.push({
      id,
      ...identity,
      name: targetName || identity.displayName,
      status: "pending",
      source: "car_view_identity_claim",
      claimType: target ? "existing_slot" : "new_person",
      targetStaffId: target ? text(target.id || target.slotId) : "",
      targetStaffName: targetName,
      targetStaffLabel: target ? text(target.label || target.roleLabel || target.title) : "",
      targetPersonId: target ? claimPersonId(target) : "",
      requestedActivityRole: "dm",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    transaction.update(carRef, { dmApplications: applications, updatedAt: timestamp });
    result = { id, status: "pending", type: "dm", claimType: target ? "existing_slot" : "new_person" };
  });

  return result;
}

module.exports = {
  submitCarEntry,
  matchesViewer,
  assertPlayerAvailable,
  assertDmAvailable,
  assertNewPlayerCapacity,
  assertNewDmCapacity,
  findClaimablePlayer,
  findClaimableStaffSlot,
  isSyntheticLineId,
  formalProfileId
};