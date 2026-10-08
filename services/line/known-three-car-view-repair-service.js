"use strict";

const { getFirestore } = require("../firebase/admin");
const { buildCarDetailView } = require("../firebase/car-prepared-view-write-through");
const { getIdentityIds } = require("./group-car-binding-service");

const KNOWN_CAR_IDS = Object.freeze([
  "vSfmdHC7okcHKiGyJAaM",
  "h9xHEXaDs8jCXb6hl4Ih",
  "O7dgQYnWux16tLtgH4iM"
]);
// Same pre-existing System Admin Profile ID from js/core/identity.js.
// This grant is scoped to the exact three IDs above, not general Car write access.
const LEGACY_SYSTEM_ADMIN_PROFILE_ID = "f89pkJbkmFLu4ZOw2fXh";
const text = v => String(v == null ? "" : v).trim();
const marker = v => v && typeof v.toMillis === "function"
  ? String(v.toMillis()) : String(v == null ? "" : v);

function sameView(view, car) {
  const projected = view && view.car;
  return Boolean(projected &&
    text(view.carId) === text(car.id) &&
    text(projected.id) === text(car.id) &&
    text(projected.scriptName) === text(car.scriptName) &&
    text(projected.gameDate) === text(car.gameDate) &&
    text(projected.gameTime) === text(car.gameTime) &&
    text(view.ownerId) === text(car.ownerId) &&
    marker(view.sourceUpdatedAt) === marker(car.updatedAt));
}

async function verifyFormalActor(session, db) {
  const profileId = text(session && session.profileId);
  const lineUserId = text(session && session.lineUserId);
  if (!profileId || !lineUserId || profileId.toLowerCase().startsWith("line:") ||
      session.provisional === true) {
    return { authorized: false, reason: "formal_line_identity_required" };
  }
  const snap = await db.collection("players").doc(profileId).get();
  if (!snap.exists) return { authorized: false, reason: "formal_profile_missing" };
  const profile = { ...snap.data(), id: snap.id };
  if (text(profile.lineUserId) !== lineUserId ||
      (text(session.identityId) && text(profile.identityId) &&
       text(session.identityId) !== text(profile.identityId))) {
    return { authorized: false, reason: "formal_line_identity_mismatch" };
  }
  const ids = getIdentityIds(profile);
  ids.add(profileId);
  return { authorized: true, ids, systemAdmin: ids.has(LEGACY_SYSTEM_ADMIN_PROFILE_ID) };
}

async function repairOneKnownCar(id, actor, db) {
  const carRef = db.collection("cars").doc(id);
  const viewRef = db.collection("carDetailViews").doc(id);
  const outcome = await db.runTransaction(async transaction => {
    const coreSnapshot = await transaction.get(carRef);
    if (!coreSnapshot.exists) return { carId: id, status: "failed", reason: "car_not_found" };
    const car = { ...coreSnapshot.data(), id: coreSnapshot.id };
    const ownerId = text(car.ownerId);
    const creatorIds = [ownerId, text(car.createdByPersonId)].filter(Boolean);
    if (!actor.systemAdmin && !creatorIds.some(x => actor.ids.has(x))) {
      return { carId: id, status: "failed", reason: "creator_identity_mismatch" };
    }
    if (!text(car.scriptName) || !text(car.gameDate) || !text(car.gameTime)) {
      return { carId: id, status: "failed", reason: "core_date_time_incomplete" };
    }
    const existing = await transaction.get(viewRef);
    if (existing.exists && sameView(existing.data(), car)) {
      return { carId: id, status: "current", gameDate: text(car.gameDate), gameTime: text(car.gameTime) };
    }
    transaction.set(viewRef, buildCarDetailView(car), { merge: false });
    return { carId: id, status: "repaired", gameDate: text(car.gameDate), gameTime: text(car.gameTime) };
  });
  if (outcome.status === "repaired") {
    const [coreSnap, viewSnap] = await Promise.all([carRef.get(), viewRef.get()]);
    const current = coreSnap.exists && { ...coreSnap.data(), id: coreSnap.id };
    if (!viewSnap.exists || !current || !sameView(viewSnap.data(), current)) {
      return { carId: id, status: "failed", reason: "post_write_verification_failed" };
    }
  }
  return outcome;
}

async function repairThreeKnownCarViews(session, opts = {}) {
  const db = opts.db || getFirestore();
  const actor = await verifyFormalActor(session, db);
  if (!actor.authorized) return { authorized: false, reason: actor.reason };
  const results = [];
  for (const id of KNOWN_CAR_IDS) {
    try {
      results.push(await repairOneKnownCar(id, actor, db));
    } catch (error) {
      console.error("Bounded Car Detail View repair failed", { carId: id, code: error && error.code });
      results.push({ carId: id, status: "failed", reason: "bounded_repair_failed" });
    }
  }
  return { authorized: true, results };
}

module.exports = { KNOWN_CAR_IDS, verifyFormalActor, sameView, repairOneKnownCar, repairThreeKnownCarViews };
