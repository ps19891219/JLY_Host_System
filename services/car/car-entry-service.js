"use strict";

const { getFirestore } = require("../firebase/admin");
const { identityIds } = require("./car-view-access");

function text(value) { return String(value == null ? "" : value).trim(); }
function lower(value) { return text(value).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }

function sessionIds(session) {
  return new Set([session && session.profileId, session && session.identityId].map(text).filter(Boolean));
}

function displayName(value) {
  const source = value && typeof value === "object" ? value : {};
  return text(source.displayName || source.playerName || source.name || source.nickname || source.staffName || source.dmName);
}

function matchesViewer(value, session) {
  const ids = sessionIds(session);
  if (ids.size && identityIds(value).some(id => ids.has(id))) return true;
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
  const profileId = text(session && session.profileId);
  if (!profileId) {
    const error = new Error("identity_required");
    error.code = "identity_required";
    throw error;
  }
  return profileId;
}

function baseIdentity(session) {
  const profileId = requireSession(session);
  return {
    memberId: profileId,
    profileId,
    identityId: text(session && session.identityId),
    lineUserId: text(session && session.lineUserId),
    displayName: text(session && session.displayName)
  };
}

function assertPlayerAvailable(car, session) {
  const players = Array.isArray(car.players) ? car.players : [];
  const applications = Array.isArray(car.applications) ? car.applications : [];
  if (players.some(item => active(item) && matchesViewer(item, session))) {
    const error = new Error("already_player"); error.code = "already_player"; throw error;
  }
  if (applications.some(item => pending(item) && matchesViewer(item, session))) {
    const error = new Error("player_application_pending"); error.code = "player_application_pending"; throw error;
  }
}

function assertDmAvailable(car, session) {
  const staff = Array.isArray(car.staffSlots) ? car.staffSlots : [];
  const applications = Array.isArray(car.dmApplications) ? car.dmApplications : [];
  if (staff.some(item => active(item) && matchesViewer(item, session))) {
    const error = new Error("already_staff"); error.code = "already_staff"; throw error;
  }
  if (applications.some(item => pending(item) && matchesViewer(item, session))) {
    const error = new Error("dm_application_pending"); error.code = "dm_application_pending"; throw error;
  }
}

function findClaimableStaffSlot(car, targetStaffId) {
  const id = text(targetStaffId);
  if (!id) return null;
  return (Array.isArray(car.staffSlots) ? car.staffSlots : []).find(function (slot) {
    return text(slot && (slot.id || slot.slotId)) === id &&
      !text(slot && (slot.memberId || slot.profileId || slot.identityId)) &&
      Boolean(displayName(slot));
  }) || null;
}

async function submitCarEntry(input, session, dependencies = {}) {
  const carId = text(input && input.carId);
  const type = lower(input && input.type);
  if (!carId) {
    const error = new Error("car_id_required"); error.code = "car_id_required"; throw error;
  }
  if (!['player', 'dm'].includes(type)) {
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
      const position = text(input.position || input.role || "不限") || "不限";
      const applications = Array.isArray(car.applications) ? car.applications.map(item => ({ ...item })) : [];
      applications.push({
        ...identity,
        name: identity.displayName,
        playerName: identity.displayName,
        role: position,
        position,
        isCrossPlay: input.isCrossPlay === true,
        status: "pending",
        source: "car_view",
        createdAt: timestamp,
        updatedAt: timestamp
      });
      transaction.update(carRef, { applications, updatedAt: timestamp });
      result = { status: "pending", type: "player" };
      return;
    }

    assertDmAvailable(car, session);
    const target = findClaimableStaffSlot(car, input.targetStaffId);
    if (text(input.targetStaffId) && !target) {
      const error = new Error("staff_slot_unavailable"); error.code = "staff_slot_unavailable"; throw error;
    }
    const applications = Array.isArray(car.dmApplications) ? car.dmApplications.map(item => ({ ...item })) : [];
    applications.push({
      ...identity,
      name: identity.displayName,
      status: "pending",
      source: "car_view",
      claimType: target ? "existing_slot" : "new",
      targetStaffId: target ? text(target.id || target.slotId) : "",
      targetStaffName: target ? displayName(target) : "",
      targetStaffLabel: target ? text(target.label || target.roleLabel || target.title) : "",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    transaction.update(carRef, { dmApplications: applications, updatedAt: timestamp });
    result = { status: "pending", type: "dm" };
  });

  return result;
}

module.exports = { submitCarEntry, matchesViewer, assertPlayerAvailable, assertDmAvailable, findClaimableStaffSlot };
