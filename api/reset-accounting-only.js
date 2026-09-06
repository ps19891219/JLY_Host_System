"use strict";

const { getFirestore } = require("../services/firebase/admin");
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

async function collectOwnedCars(db, ids) {
  const cars = new Map();
  for (const id of ids) {
    const snapshot = await db.collection("cars").where("ownerId", "==", id).get();
    snapshot.docs.forEach(doc => cars.set(doc.id, doc.ref));
  }
  return [...cars.values()];
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    send(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (body.confirm !== "RESET_ACCOUNTING_ONLY") {
      send(res, 400, { ok: false, error: "confirmation_required" });
      return;
    }

    const session = await verifyMemberSession(readCookie(req, "jly_member_session"));
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
    let accountingCollectionsCleared = 0;
    let accountingDocumentsDeleted = 0;

    for (const carRef of cars) {
      const collections = await carRef.listCollections();
      const accountingCollections = collections.filter(collection => /^accounting/i.test(collection.id));
      for (const collection of accountingCollections) {
        accountingDocumentsDeleted += await deleteCollection(collection);
        accountingCollectionsCleared += 1;
      }
    }

    send(res, 200, {
      ok: true,
      resetScope: "owned_cars_accounting_only",
      carsChecked: cars.length,
      accountingCollectionsCleared,
      accountingDocumentsDeleted
    });
  } catch (error) {
    console.error("accounting-only reset failed", error);
    send(res, 500, {
      ok: false,
      error: error && error.message ? error.message : "accounting_reset_failed"
    });
  }
};
