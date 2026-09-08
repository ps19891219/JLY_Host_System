"use strict";

const {
  getCarById
} = require("../firebase/line-accounting-authorization-repository");
const {
  getPairingCode,
  updatePairingCode
} = require("../firebase/line-group-pairing-repository");
const { bindGroupToCar } = require("./group-car-binding-service");

function expired(pairing, now = Date.now()) {
  return !pairing || Date.parse(pairing.expiresAt || "") <= now;
}

function carLabel(car) {
  return String(
    car && (car.scriptName || car.title || car.name || car.id) || "未命名車團"
  ).trim();
}

function hasAuthorizedPairing(pairing) {
  return Boolean(
    pairing &&
    pairing.authorizationType === "car_owner_session" &&
    String(pairing.authorizedByPersonId || "").trim()
  );
}

async function prepareGroupPairing(context, code, dependencies = {}) {
  if (!context || context.source.type !== "group") {
    return { prepared: false, reason: "group_required" };
  }
  const getPairing = dependencies.getPairingCode || getPairingCode;
  const getCar = dependencies.getCarById || getCarById;
  const updatePairing = dependencies.updatePairingCode || updatePairingCode;
  const pairing = await getPairing(code);
  if (!pairing) return { prepared: false, reason: "pairing_not_found" };
  if (expired(pairing)) return { prepared: false, reason: "pairing_expired" };
  if (pairing.status !== "pending") {
    return { prepared: false, reason: "pairing_unavailable" };
  }

  // Authorization belongs to the short-lived pairing code, which was minted
  // from the car management side after verifying the car owner session.
  // The LINE group participant who pastes the code is only executing that
  // already-authorized pairing and need not be the car owner/group creator.
  if (!hasAuthorizedPairing(pairing)) {
    return { prepared: false, reason: "pairing_not_authorized" };
  }

  const car = await getCar(pairing.carId);
  if (!car) return { prepared: false, reason: "car_not_found" };

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
  if (!hasAuthorizedPairing(pairing)) {
    return { bound: false, reason: "pairing_not_authorized" };
  }
  if (
    pairing.status !== "awaiting_confirmation" ||
    pairing.groupId !== context.source.groupId ||
    pairing.requestedBy !== context.source.userId
  ) {
    return { bound: false, reason: "pairing_confirmation_mismatch" };
  }

  const result = await bind(context, pairing.carId, {
    ...dependencies,
    authorizedPairing: true,
    pairingAuthorization: pairing
  });
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
  hasAuthorizedPairing,
  prepareGroupPairing,
  confirmGroupPairing,
  cancelGroupPairing
};
