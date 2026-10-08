"use strict";

// Single known preTrip reminder document transaction. No new Reminder model.
const { getFirestore } = require("./admin");
const {
  getReminderRef,
  normalizeTargetIds,
  MAX_REMINDER_TARGETS
} = require("./reminder-repository");

function text(value) { return String(value == null ? "" : value).trim(); }

async function addPreTripReminderOwnerTarget(carId, lineUserId, deps = {}) {
  const id = text(carId);
  const userId = text(lineUserId);
  if (!id || !userId) return { included: false, reason: "invalid_reference" };
  const db = deps.db || getFirestore();
  const ref = deps.ref || getReminderRef(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { included: false, reason: "reminder_not_found" };
    const reminder = snapshot.data() || {};
    if (reminder.enabled !== true) return { included: false, reason: "reminder_disabled" };
    if (["sent","sending","cancelled","canceled"].includes(text(reminder.status))) {
      return { included: false, reason: "reminder_already_processing" };
    }
    const targets = normalizeTargetIds(reminder.targetLineUserIds);
    if (targets.includes(userId)) {
      return { included: true, alreadyIncluded: true, totalCount: targets.length };
    }
    if (targets.length >= MAX_REMINDER_TARGETS) {
      return { included: false, reason: "target_limit_reached", totalCount: targets.length };
    }
    const now = new Date().toISOString();
    transaction.set(ref, {
      targetLineUserIds: [...targets, userId],
      targetUpdatedAt: now,
      updatedAt: now
    }, { merge: true });
    return { included: true, alreadyIncluded: false, totalCount: targets.length + 1 };
  });
}

module.exports = { addPreTripReminderOwnerTarget };
