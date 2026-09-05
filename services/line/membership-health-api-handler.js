"use strict";

const { getFirestore } = require("../firebase/admin");
const { readCookie, verifyMemberSession } = require("./member-session");
const { initializeMembershipSnapshot, verifyMembershipSnapshot, isCarExpired } = require("./group-membership-health-service");
const { getSnapshot } = require("../firebase/line-group-membership-repository");

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function text(value) { return String(value == null ? "" : value).trim(); }
function activePlayerCount(car) {
  return (Array.isArray(car && car.players) ? car.players : []).filter(player => {
    const status = text(player && player.status).toLowerCase();
    return !["已取消", "取消", "cancelled", "canceled"].includes(status);
  }).length;
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (_) { return {}; }
}
function identityIds(session) {
  const data = session && session.data ? session.data : {};
  return new Set([data.profileId, data.identityId].map(text).filter(Boolean));
}
function owns(car, ids) { return ids.has(text(car && car.ownerId)); }

async function handleMembershipHealth(req, res, suppliedPayload) {
  try {
    const session = verifyMemberSession(readCookie(req));
    const ids = identityIds(session);
    if (!session.valid || ids.size === 0) return send(res, 401, { success: false, error: "login_required" });
    const payload = suppliedPayload || await readBody(req);
    const action = text(payload.action);
    const db = getFirestore();

    if (action === "verify") {
      const carId = text(payload.carId), groupId = text(payload.groupId);
      const carDoc = await db.collection("cars").doc(carId).get();
      if (!carDoc.exists) return send(res, 404, { success: false, error: "car_not_found" });
      const car = { id: carDoc.id, ...carDoc.data() };
      if (!owns(car, ids)) return send(res, 403, { success: false, error: "owner_required" });
      const result = await verifyMembershipSnapshot({ groupId, carId, verifiedBy: text(session.data.profileId || session.data.identityId), playerCount: activePlayerCount(car) });
      return send(res, 200, { success: true, result });
    }

    if (action === "initialize") {
      const carId = text(payload.carId), groupId = text(payload.groupId);
      const carDoc = await db.collection("cars").doc(carId).get();
      if (!carDoc.exists) return send(res, 404, { success: false, error: "car_not_found" });
      const car = { id: carDoc.id, ...carDoc.data() };
      if (!owns(car, ids)) return send(res, 403, { success: false, error: "owner_required" });
      if (isCarExpired(car)) return send(res, 200, { success: true, result: { initialized: false, reason: "car_expired" } });
      const result = await initializeMembershipSnapshot({ groupId, carId, car });
      return send(res, 200, { success: true, result });
    }

    if (action === "catchup") {
      const requested = Math.max(1, Math.min(20, Number(payload.limit) || 10));
      const bindings = await db.collection("lineGroupBindings").where("status", "==", "active").limit(50).get();
      const results = [];
      const diagnostics = { activeBindingsScanned: bindings.size, missingBindingIds: 0, existingSnapshots: 0, missingCars: 0, notOwnedByCurrentIdentity: 0, expiredCars: 0, initializationFailed: 0, initialized: 0 };
      const samples = [];
      for (const doc of bindings.docs) {
        if (results.length >= requested) break;
        const binding = { id: doc.id, ...doc.data() };
        const carId = text(binding.carId), groupId = text(binding.groupId || doc.id);
        if (!carId || !groupId) { diagnostics.missingBindingIds += 1; continue; }
        const existing = await getSnapshot(groupId);
        if (existing && ["verified", "needs_review"].includes(text(existing.status))) { diagnostics.existingSnapshots += 1; continue; }
        const carDoc = await db.collection("cars").doc(carId).get();
        if (!carDoc.exists) { diagnostics.missingCars += 1; continue; }
        const car = { id: carDoc.id, ...carDoc.data() };
        if (!owns(car, ids)) { diagnostics.notOwnedByCurrentIdentity += 1; if (samples.length < 5) samples.push({ carId, reason: "owner_identity_mismatch" }); continue; }
        if (isCarExpired(car)) { diagnostics.expiredCars += 1; continue; }
        try {
          const result = await initializeMembershipSnapshot({ groupId, carId, car });
          const initialized = result.initialized === true;
          if (initialized) diagnostics.initialized += 1;
          results.push({ carId, groupId, initialized, reason: result.reason });
        } catch (error) {
          diagnostics.initializationFailed += 1;
          if (samples.length < 5) samples.push({ carId, reason: "initialization_failed", message: text(error && error.message).slice(0, 120) });
          results.push({ carId, groupId, initialized: false, reason: "initialization_failed" });
        }
      }
      return send(res, 200, { success: true, processed: results.length, results, diagnostics, samples });
    }

    return send(res, 400, { success: false, error: "unsupported_action" });
  } catch (error) {
    console.error("LINE membership health API failed.", error);
    return send(res, 500, { success: false, error: "line_membership_health_failed" });
  }
}

module.exports = { handleMembershipHealth, activePlayerCount };