"use strict";

const { getFirestore } = require("./admin");

const COLLECTION_NAME = "lineGroupMembershipSnapshots";

function text(value) {
  return String(value == null ? "" : value).trim();
}

function getCollection(db) {
  return (db || getFirestore()).collection(COLLECTION_NAME);
}

async function getSnapshot(groupId, dependencies = {}) {
  const id = text(groupId);
  if (!id) return null;
  const snapshot = await getCollection(dependencies.db).doc(id).get();
  return snapshot.exists ? { id: snapshot.id, ...(snapshot.data() || {}) } : null;
}

async function saveSnapshot(groupId, data, dependencies = {}) {
  const id = text(groupId);
  if (!id) throw new Error("line_group_id_required");
  const stored = { ...(data || {}), groupId: id };
  await getCollection(dependencies.db).doc(id).set(stored, { merge: true });
  return stored;
}

async function savePendingAction(carId, action, dependencies = {}) {
  const id = text(carId);
  if (!id) throw new Error("car_id_required");
  const db = dependencies.db || getFirestore();
  const actionId = text(action && action.pendingActionId) || "line_membership_review";
  await db.collection("cars").doc(id)
    .collection("pendingActions").doc(actionId)
    .set(action, { merge: true });
  return action;
}

async function completePendingAction(carId, actionId, completedAt, dependencies = {}) {
  const id = text(carId);
  if (!id) return null;
  const db = dependencies.db || getFirestore();
  const ref = db.collection("cars").doc(id)
    .collection("pendingActions").doc(text(actionId) || "line_membership_review");
  await ref.set({ status: "completed", completedAt, updatedAt: completedAt }, { merge: true });
  return { status: "completed", completedAt };
}

module.exports = {
  COLLECTION_NAME,
  getSnapshot,
  saveSnapshot,
  savePendingAction,
  completePendingAction
};
