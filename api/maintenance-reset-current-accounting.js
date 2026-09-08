"use strict";

const { getFirestore } = require("../services/firebase/admin");
const {
  listPlayersForIdentityResolution
} = require("../services/firebase/line-accounting-authorization-repository");
const {
  buildIdentityComponent,
  getCarOwnerIds
} = require("../services/line/group-car-binding-service");
const { readCookie, verifyMemberSession } = require("../services/line/member-session");

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function text(value) {
  return String(value == null ? "" : value).trim();
}

function addFormalId(target, value) {
  const safe = text(value);
  if (!safe || safe.toLowerCase().startsWith("line:")) return;
  target.add(safe);
}

function sessionIds(session) {
  const ids = new Set();
  addFormalId(ids, session && session.profileId);
  addFormalId(ids, session && session.identityId);
  addFormalId(ids, session && session.personId);
  return ids;
}

function parseBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch (_error) { return {}; }
  }
  return req.body || {};
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(gameDate))) return "";
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
  const update = { sendTime: "09:00", timezone: "Asia/Taipei", updatedAt: now };
  if (reminder.enabled === true && text(reminder.status) !== "sent") {
    const scheduledAt = calculateNineAmReminder(car.gameDate || car.date, reminder.offsetDays);
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

async function resolveOwnerIds(session) {
  const ids = sessionIds(session);
  const lineUserId = text(session && session.lineUserId);
  if (!lineUserId) return { ids, conflict: false };

  const players = await listPlayersForIdentityResolution();
  const component = buildIdentityComponent(players, lineUserId);
  if (component.rows.length && !component.valid) {
    return { ids: new Set(), conflict: true, conflicts: component.conflicts };
  }
  if (component.valid) {
    component.ids.forEach(id => addFormalId(ids, id));
  }
  return { ids, conflict: false };
}

async function collectOwnedCars(db, ids) {
  const snapshot = await db.collection("cars").get();
  return snapshot.docs
    .map(doc => ({ ref: doc.ref, data: doc.data() || {} }))
    .filter(car => [...getCarOwnerIds(car.data)].some(ownerId => ids.has(ownerId)));
}

async function clearAccounting(cars) {
  let accountingDocumentsDeleted = 0;
  let accountingCollectionsCleared = 0;
  for (const car of cars) {
    const collections = await car.ref.listCollections();
    const accountingCollections = collections.filter(collection => /^accounting/i.test(collection.id));
    for (const collection of accountingCollections) {
      const deleted = await deleteCollection(collection);
      accountingDocumentsDeleted += deleted;
      accountingCollectionsCleared += 1;
    }
  }
  return { accountingDocumentsDeleted, accountingCollectionsCleared };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    send(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const verified = verifyMemberSession(readCookie(req));
    if (!verified.valid) {
      send(res, 401, { ok: false, error: "member_session_required" });
      return;
    }

    const session = verified.data;
    const resolved = await resolveOwnerIds(session);
    if (resolved.conflict) {
      send(res, 409, {
        ok: false,
        error: "owner_identity_conflict",
        conflictFields: resolved.conflicts.map(item => item.field)
      });
      return;
    }
    if (!resolved.ids.size) {
      send(res, 403, { ok: false, error: "member_identity_required" });
      return;
    }

    const body = parseBody(req);
    const accountingOnly = body.mode === "accounting_only";
    if (accountingOnly && body.confirm !== "RESET_ACCOUNTING_ONLY") {
      send(res, 400, { ok: false, error: "confirmation_required" });
      return;
    }

    const db = getFirestore();
    const cars = await collectOwnedCars(db, resolved.ids);
    const accountingResult = await clearAccounting(cars);

    if (accountingOnly) {
      send(res, 200, {
        ok: true,
        resetScope: "owned_cars_accounting_only",
        carsChecked: cars.length,
        accountingCollectionsCleared: accountingResult.accountingCollectionsCleared,
        accountingDocumentsDeleted: accountingResult.accountingDocumentsDeleted,
        remindersMigrated: 0
      });
      return;
    }

    let remindersMigrated = 0;
    for (const car of cars) {
      if (await migrateReminder(car.ref, car.data)) remindersMigrated += 1;
    }

    send(res, 200, {
      ok: true,
      carsChecked: cars.length,
      accountingCollectionsCleared: accountingResult.accountingCollectionsCleared,
      accountingDocumentsDeleted: accountingResult.accountingDocumentsDeleted,
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

module.exports.sessionIds = sessionIds;
module.exports.resolveOwnerIds = resolveOwnerIds;
module.exports.collectOwnedCars = collectOwnedCars;
