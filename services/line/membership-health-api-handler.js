"use strict";

const { getFirestore } = require("../firebase/admin");
const {
  listPlayersForIdentityResolution
} = require("../firebase/line-accounting-authorization-repository");
const { readCookie, verifyMemberSession } = require("./member-session");
const {
  initializeMembershipSnapshot,
  refreshMembershipSnapshot,
  verifyMembershipSnapshot,
  isCarExpired
} = require("./group-membership-health-service");
const { getSnapshot } = require("../firebase/line-group-membership-repository");
const { getGroupSummary } = require("./group-membership-client");
const {
  buildIdentityComponent,
  identityIdsOwnCar
} = require("./group-car-binding-service");

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function text(value) { return String(value == null ? "" : value).trim(); }
function safeErrorCode(error) {
  return text(error && (error.code || error.details || error.name)).replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80);
}
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
async function authorizedIdentityIds(session) {
  const ids = identityIds(session);
  const data = session && session.data ? session.data : {};
  const lineUserId = text(data.lineUserId);
  if (!lineUserId) return ids;
  try {
    const players = await listPlayersForIdentityResolution();
    const component = buildIdentityComponent(players, lineUserId);
    if (component.valid) component.ids.forEach(id => ids.add(id));
  } catch (error) {
    console.warn("LINE membership owner identity expansion skipped.", error);
  }
  return ids;
}
function owns(car, ids) { return identityIdsOwnCar(ids, car); }
function diagnosticSample(binding, carId, groupId, reason) {
  return {
    carId,
    groupId,
    reason,
    boundAt: binding.boundAt || binding.updatedAt || binding.createdAt || null
  };
}
async function enrichDiagnosticSample(sample) {
  if (!sample.groupId) return { ...sample, groupName: "", groupSummaryStatus: "unavailable" };
  try {
    const summary = await getGroupSummary(sample.groupId);
    return { ...sample, groupName: text(summary && summary.groupName), groupSummaryStatus: "available" };
  } catch (_) {
    return { ...sample, groupName: "", groupSummaryStatus: "unavailable" };
  }
}
async function pushDiagnosticSample(samples, binding, carId, groupId, reason, extra = {}) {
  if (samples.length >= 10) return;
  const sample = await enrichDiagnosticSample({ ...diagnosticSample(binding, carId, groupId, reason), ...extra });
  samples.push(sample);
}
async function listOwnedBindings(db, ids, limit) {
  const bindings = await db.collection("lineGroupBindings").where("status", "==", "active").limit(50).get();
  const rows = [];
  for (const doc of bindings.docs) {
    if (rows.length >= limit) break;
    const binding = { id: doc.id, ...doc.data() };
    const carId = text(binding.carId), groupId = text(binding.groupId || doc.id);
    if (!carId || !groupId) {
      rows.push({ binding, carId, groupId, error: "missing_binding_ids" });
      continue;
    }
    const carDoc = await db.collection("cars").doc(carId).get();
    if (!carDoc.exists) {
      rows.push({ binding, carId, groupId, error: "car_not_found" });
      continue;
    }
    const car = { id: carDoc.id, ...carDoc.data() };
    if (!owns(car, ids)) {
      rows.push({ binding, carId, groupId, car, error: "owner_identity_mismatch" });
      continue;
    }
    if (isCarExpired(car)) {
      rows.push({ binding, carId, groupId, car, error: "car_expired" });
      continue;
    }
    rows.push({ binding, carId, groupId, car, error: "" });
  }
  return { scanned: bindings.size, rows };
}

async function handleMembershipHealth(req, res, suppliedPayload) {
  try {
    const session = verifyMemberSession(readCookie(req));
    if (!session.valid) return send(res, 401, { success: false, error: "login_required" });
    const ids = await authorizedIdentityIds(session);
    if (ids.size === 0) return send(res, 401, { success: false, error: "login_required" });
    const payload = suppliedPayload || await readBody(req);
    const action = text(payload.action);
    const db = getFirestore();

    if (action === "verify") {
      const carId = text(payload.carId), groupId = text(payload.groupId);
      let carDoc;
      try {
        carDoc = await db.collection("cars").doc(carId).get();
      } catch (error) {
        console.error("LINE membership verify car read failed.", error);
        return send(res, 500, { success: false, error: "verify_car_read_failed", stage: "car_read", detailCode: safeErrorCode(error) });
      }
      if (!carDoc.exists) return send(res, 404, { success: false, error: "car_not_found" });
      const car = { id: carDoc.id, ...carDoc.data() };
      if (!owns(car, ids)) return send(res, 403, { success: false, error: "owner_required" });
      let previous;
      try {
        previous = await getSnapshot(groupId);
      } catch (error) {
        console.error("LINE membership verify snapshot read failed.", error);
        return send(res, 500, { success: false, error: "verify_snapshot_read_failed", stage: "snapshot_read", detailCode: safeErrorCode(error) });
      }
      if (!previous || text(previous.carId) !== carId) {
        return send(res, 409, { success: false, error: "snapshot_not_found", stage: "snapshot_read" });
      }
      let result;
      try {
        result = await verifyMembershipSnapshot({ groupId, carId, verifiedBy: text(session.data.profileId || session.data.identityId), playerCount: activePlayerCount(car) });
      } catch (error) {
        console.error("LINE membership verify snapshot write failed.", error);
        return send(res, 500, { success: false, error: "verify_snapshot_write_failed", stage: "snapshot_write", detailCode: safeErrorCode(error) });
      }
      if (!result || result.verified !== true) {
        return send(res, 409, { success: false, error: result && result.reason || "verify_failed", stage: "snapshot_write", result });
      }
      return send(res, 200, { success: true, result, stage: "verified" });
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

    if (action === "refresh") {
      const requested = Math.max(1, Math.min(20, Number(payload.limit) || 10));
      const owned = await listOwnedBindings(db, ids, requested);
      const diagnostics = {
        activeBindingsScanned: owned.scanned,
        refreshed: 0,
        changed: 0,
        unchanged: 0,
        failed: 0,
        missingBindingIds: 0,
        missingCars: 0,
        notOwnedByCurrentIdentity: 0,
        expiredCars: 0
      };
      const results = [];
      const samples = [];
      for (const row of owned.rows) {
        const { binding, carId, groupId, car, error } = row;
        if (error) {
          if (error === "missing_binding_ids") diagnostics.missingBindingIds += 1;
          else if (error === "car_not_found") diagnostics.missingCars += 1;
          else if (error === "owner_identity_mismatch") diagnostics.notOwnedByCurrentIdentity += 1;
          else if (error === "car_expired") diagnostics.expiredCars += 1;
          await pushDiagnosticSample(samples, binding, carId, groupId, error);
          continue;
        }
        try {
          const result = await refreshMembershipSnapshot({ groupId, carId, car, playerCount: activePlayerCount(car) });
          if (result.refreshed) diagnostics.refreshed += 1;
          if (result.changed) diagnostics.changed += 1;
          else diagnostics.unchanged += 1;
          results.push({ carId, groupId, refreshed: result.refreshed, changed: result.changed, reason: result.reason, joined: result.joined || [], left: result.left || [] });
        } catch (error2) {
          diagnostics.failed += 1;
          await pushDiagnosticSample(samples, binding, carId, groupId, "refresh_failed", { message: text(error2 && error2.message).slice(0, 120) });
          results.push({ carId, groupId, refreshed: false, changed: false, reason: "refresh_failed" });
        }
      }
      return send(res, 200, { success: true, processed: results.length, results, diagnostics, samples });
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
        if (!carId || !groupId) {
          diagnostics.missingBindingIds += 1;
          await pushDiagnosticSample(samples, binding, carId, groupId, "missing_binding_ids");
          continue;
        }
        const existing = await getSnapshot(groupId);
        if (existing && ["verified", "needs_review"].includes(text(existing.status))) { diagnostics.existingSnapshots += 1; continue; }
        const carDoc = await db.collection("cars").doc(carId).get();
        if (!carDoc.exists) {
          diagnostics.missingCars += 1;
          await pushDiagnosticSample(samples, binding, carId, groupId, "car_not_found");
          continue;
        }
        const car = { id: carDoc.id, ...carDoc.data() };
        if (!owns(car, ids)) {
          diagnostics.notOwnedByCurrentIdentity += 1;
          await pushDiagnosticSample(samples, binding, carId, groupId, "owner_identity_mismatch");
          continue;
        }
        if (isCarExpired(car)) {
          diagnostics.expiredCars += 1;
          await pushDiagnosticSample(samples, binding, carId, groupId, "car_expired");
          continue;
        }
        try {
          const result = await initializeMembershipSnapshot({ groupId, carId, car });
          const initialized = result.initialized === true;
          if (initialized) diagnostics.initialized += 1;
          results.push({ carId, groupId, initialized, reason: result.reason });
        } catch (error) {
          diagnostics.initializationFailed += 1;
          await pushDiagnosticSample(samples, binding, carId, groupId, "initialization_failed", { message: text(error && error.message).slice(0, 120) });
          results.push({ carId, groupId, initialized: false, reason: "initialization_failed" });
        }
      }
      return send(res, 200, { success: true, processed: results.length, results, diagnostics, samples });
    }

    return send(res, 400, { success: false, error: "unsupported_action" });
  } catch (error) {
    console.error("LINE membership health API failed.", error);
    return send(res, 500, { success: false, error: "line_membership_health_failed", stage: "unknown", detailCode: safeErrorCode(error) });
  }
}

module.exports = { handleMembershipHealth, activePlayerCount, identityIds, authorizedIdentityIds, owns, safeErrorCode, listOwnedBindings };
