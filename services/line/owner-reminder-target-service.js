"use strict";

// Reuse formal LINE Identity and owner IDs. Never scan Person or Players.
const { findPlayerByLineUserId } = require("../firebase/line-accounting-authorization-repository");
const { getFirestore } = require("../firebase/admin");
const { isCarOwner } = require("./group-car-binding-service");
const { addPreTripReminderOwnerTarget } = require("../firebase/reminder-owner-target-repository");

function text(value) { return String(value == null ? "" : value).trim(); }

async function readPlayerByExactId(id, deps = {}) {
  const db = deps.db || getFirestore();
  const snapshot = await db.collection("players").doc(id).get();
  return snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
}

function linkedOwner(profile, car) {
  return Boolean(profile && text(profile.lineUserId) && isCarOwner(profile, car));
}

async function resolveVerifiedOwnerLineUserId(car, context = {}, deps = {}) {
  if (!car || typeof car !== "object") return { verified: false, reason: "car_missing" };
  const actorLineId = text(context && context.source && context.source.userId);
  const findByLine = deps.findPlayerByLineUserId || findPlayerByLineUserId;
  const readById = deps.readPlayerByExactId || readPlayerByExactId;

  if (actorLineId) {
    const actor = await findByLine(actorLineId);
    if (linkedOwner(actor, car) && text(actor.lineUserId) === actorLineId) {
      return { verified: true, lineUserId: actorLineId, source: "verified_sender" };
    }
  }

  const ids = Array.from(new Set([
    text(car.ownerId), text(car.ownerPersonId), text(car.ownerProfileId)
  ].filter(id => id && !id.toLowerCase().startsWith("line:")))).slice(0,3);
  const ownerLineIds = new Set();
  for (const id of ids) {
    const row = await readById(id, deps);
    if (linkedOwner(row, car)) ownerLineIds.add(text(row.lineUserId));
  }
  if (ownerLineIds.size > 1) return { verified: false, reason: "owner_identity_conflict" };
  if (ownerLineIds.size === 1) {
    return { verified: true, lineUserId: [...ownerLineIds][0], source: "known_owner_id" };
  }
  return { verified: false, reason: "owner_line_identity_unverified" };
}

async function syncOwnerReminderTarget(carId, car, context, deps = {}) {
  const id = text(carId);
  if (!id || !car || (text(car.id) && text(car.id) !== id)) {
    return { included: false, reason: "car_mismatch" };
  }
  const owner = await resolveVerifiedOwnerLineUserId(car, context, deps);
  if (!owner.verified) return { included: false, reason: owner.reason };
  const append = deps.addPreTripReminderOwnerTarget || addPreTripReminderOwnerTarget;
  const outcome = await append(id, owner.lineUserId);
  return { ...outcome, ownerIdentityVerified: true, identitySource: owner.source };
}

module.exports = { readPlayerByExactId, resolveVerifiedOwnerLineUserId, syncOwnerReminderTarget };
