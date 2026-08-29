"use strict";

const {
  getFirestore
} = require("../services/firebase/admin");

const {
  readCookie,
  verifyMemberSession
} = require("../services/line/member-session");

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function text(value) {
  return String(value == null ? "" : value).trim();
}

function sessionIds(session) {
  return [...new Set([
    text(session && session.profileId),
    text(session && session.identityId)
  ].filter(Boolean))];
}

async function deleteCollection(collectionRef) {
  let deleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(400).get();
    if (snapshot.empty) break;

    const db = getFirestore();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;

    if (snapshot.size < 400) break;
  }

  return deleted;
}

function calculateNineAmReminder(gameDate, offsetDays) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(gameDate))) {
    return "";
  }

  const date = new Date(`${gameDate}T09:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return "";

  const days = Number.isFinite(Number(offsetDays))
    ? Math.max(0, Math.floor(Number(offsetDays)))
    : 1;

  date.setTime(date.getTime() - days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

async function migrateReminder(carRef, car) {
  const reminderRef = carRef.collection("reminders").doc("preTrip");
  const snapshot = await reminderRef.get();

  if (!snapshot.exists) return false;

  const reminder = snapshot.data() || {};
  const now = new Date().toISOString();
  const update = {
    sendTime: "09:00",
    timezone: "Asia/Taipei",
    updatedAt: now
  };

  if (reminder.enabled === true && text(reminder.status) !== "sent") {
    const scheduledAt = calculateNineAmReminder(
      car.gameDate || car.date,
      reminder.offsetDays
    );

    update.scheduledAt = scheduledAt;

    if (scheduledAt) {
      const passed = scheduledAt <= now;
      update.status = passed ? "action_required" : "scheduled";
      update.needsHostAction = passed;
      update.rescheduleReason = passed
        ? "scheduled_time_passed_after_09_migration"
        : "default_time_migrated_to_09";
    }
  }

  await reminderRef.set(update, { merge: true });
  return true;
}

async function collectOwnedCars(db, ids) {
  const cars = new Map();

  for (const id of ids) {
    const snapshot = await db
      .collection("cars")
      .where("ownerId", "==", id)
      .get();

    snapshot.docs.forEach(doc => {
      cars.set(doc.id, {
        ref: doc.ref,
        data: doc.data() || {}
      });
    });
  }

  return [...cars.values()];
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    send(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const session = await verifyMemberSession(
      readCookie(req, "jly_member_session")
    );

    if (!session) {
      send(res, 401, { ok: false, error: "member_session_required" });
      return;
    }

    const ids = sessionIds(session);
    if (!ids.length) {
      send(res, 403, { ok: false, error: "member_identity_required" });
      return;
    }

    const db = getFirestore();
    const cars = await collectOwnedCars(db, ids);

    let accountingDocumentsDeleted = 0;
    let accountingCollectionsCleared = 0;
    let remindersMigrated = 0;

    for (const car of cars) {
      const collections = await car.ref.listCollections();
      const accountingCollections = collections.filter(collection =>
        /^accounting/i.test(collection.id)
      );

      for (const collection of accountingCollections) {
        const deleted = await deleteCollection(collection);
        accountingDocumentsDeleted += deleted;
        accountingCollectionsCleared += 1;
      }

      if (await migrateReminder(car.ref, car.data)) {
        remindersMigrated += 1;
      }
    }

    send(res, 200, {
      ok: true,
      carsChecked: cars.length,
      accountingCollectionsCleared,
      accountingDocumentsDeleted,
      remindersMigrated,
      reminderDefault: "09:00",
      timezone: "Asia/Taipei"
    });
  } catch (error) {
    console.error("maintenance reset failed", error);
    send(res, 500, {
      ok: false,
      error: error && error.message ? error.message : "maintenance_reset_failed"
    });
  }
};
