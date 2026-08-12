"use strict";

const {
  findPlayerByLineUserId,
  getCarById
} = require("../firebase/line-accounting-authorization-repository");
const {
  getPairingCode,
  updatePairingCode
} = require("../firebase/line-group-pairing-repository");
const { bindGroupToCar } = require("./group-car-binding-service");
const { getIdentityIds } = require("./group-car-binding-service");

function expired(pairing, now = Date.now()) {
  return !pairing || Date.parse(pairing.expiresAt || "") <= now;
}

function carLabel(car) {
  return String(
    car && (car.scriptName || car.title || car.name || car.id) || "未命名車團"
  ).trim();
}

async function prepareGroupPairing(context, code, dependencies = {}) {
  if (!context || context.source.type !== "group") {
    return { prepared: false, reason: "group_required" };
  }
  const getPairing = dependencies.getPairingCode || getPairingCode;
  const findPlayer = dependencies.findPlayerByLineUserId || findPlayerByLineUserId;
  const getCar = dependencies.getCarById || getCarById;
  const updatePairing = dependencies.updatePairingCode || updatePairingCode;
  const pairing = await getPairing(code);
  if (!pairing) return { prepared: false, reason: "pairing_not_found" };
  if (expired(pairing)) return { prepared: false, reason: "pairing_expired" };
  if (pairing.status !== "pending") {
    return { prepared: false, reason: "pairing_unavailable" };
  }
  const player = await findPlayer(context.source.userId);
  if (!player) return { prepared: false, reason: "line_identity_unlinked" };
  const car = await getCar(pairing.carId);
  if (!car) return { prepared: false, reason: "car_not_found" };
  if (!getIdentityIds(player).has(String(car.ownerId || ""))) {
    return { prepared: false, reason: "owner_required" };
  }
  await updatePairing(code, {
    status: "awaiting_confirmation",
    groupId: context.source.groupId,
    requestedBy: context.source.userId
  });
  return {
    prepared: true,
    code: String(code).toUpperCase(),
    car: { id: car.id, label: carLabel(car), date: car.date || car.startDate || "" }
  };
}

async function confirmGroupPairing(context, code, dependencies = {}) {
  if (!context || context.source.type !== "group") {
    return { bound: false, reason: "group_required" };
  }
  const getPairing = dependencies.getPairingCode || getPairingCode;
  const updatePairing = dependencies.updatePairingCode || updatePairingCode;
  const bind = dependencies.bindGroupToCar || bindGroupToCar;
  const pairing = await getPairing(code);
  if (!pairing) return { bound: false, reason: "pairing_not_found" };
  if (expired(pairing)) return { bound: false, reason: "pairing_expired" };
  if (
    pairing.status !== "awaiting_confirmation" ||
    pairing.groupId !== context.source.groupId ||
    pairing.requestedBy !== context.source.userId
  ) {
    return { bound: false, reason: "pairing_confirmation_mismatch" };
  }
  const result = await bind(context, pairing.carId);
  if (result.bound) {
    await updatePairing(code, {
      status: "used",
      usedAt: new Date().toISOString(),
      usedBy: context.source.userId
    });
  }
  return result;
}

async function cancelGroupPairing(context, code, dependencies = {}) {
  const getPairing = dependencies.getPairingCode || getPairingCode;
  const updatePairing = dependencies.updatePairingCode || updatePairingCode;
  const pairing = await getPairing(code);
  if (!pairing || pairing.status !== "awaiting_confirmation") {
    return { cancelled: false, reason: "pairing_unavailable" };
  }
  if (
    pairing.groupId !== context.source.groupId ||
    pairing.requestedBy !== context.source.userId
  ) {
    return { cancelled: false, reason: "pairing_confirmation_mismatch" };
  }
  await updatePairing(code, { status: "cancelled", cancelledAt: new Date().toISOString() });
  return { cancelled: true };
}

module.exports = {
  expired,
  prepareGroupPairing,
  confirmGroupPairing,
  cancelGroupPairing
};
