"use strict";

const { getFirestore } = require("../services/firebase/admin");
const { verifyMemberSession, getSessionIdentityIds } = require("../services/line/member-session");
const { initializeMembershipSnapshot, verifyMembershipSnapshot, isCarExpired } = require("../services/line/group-membership-health-service");
const { getSnapshot } = require("../services/firebase/line-group-membership-repository");

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function text(value) { return String(value == null ? "" : value).trim(); }
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (_) { return {}; }
}
function owns(car, identityIds) { return identityIds.has(text(car && car.ownerId)); }

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { success: false, error: "method_not_allowed" });
  }
  try {
    const session = verifyMemberSession(req.headers.cookie || "");
    const identityIds = getSessionIdentityIds(session);
    if (!session || identityIds.size === 0) return send(res, 401, { success: false, error: "login_required" });
    const payload = await body(req);
    const action = text(payload.action);
    const db = getFirestore();

    if (action === "verify") {
      const carId = text(payload.carId), groupId = text(payload.groupId);
      const carDoc = await db.collection("cars").doc(carId).get();
      if (!carDoc.exists) return send(res, 404, { success: false, error: "car_not_found" });
      const car = { id: carDoc.id, ...carDoc.data() };
      if (!owns(car, identityIds)) return send(res, 403, { success: false, error: "owner_required" });
      const result = await verifyMembershipSnapshot({ groupId, carId, verifiedBy: text(session.playerId || session.identityId) });
      return send(res, 200, { success: true, result });
    }

    if (action === "initialize") {
      const carId = text(payload.carId), groupId = text(payload.groupId);
      const carDoc = await db.collection("cars").doc(carId).get();
      if (!carDoc.exists) return send(res, 404, { success: false, error: "car_not_found" });
      const car = { id: carDoc.id, ...carDoc.data() };
      if (!owns(car, identityIds)) return send(res, 403, { success: false, error: "owner_required" });
      if (isCarExpired(car)) return send(res, 200, { success: true, result: { initialized: false, reason: "car_expired" } });
      const result = await initializeMembershipSnapshot({ groupId, carId, car });
      return send(res, 200, { success: true, result });
    }

    if (action === "catchup") {
      const requested = Math.max(1, Math.min(20, Number(payload.limit) || 10));
      const bindings = await db.collection("lineGroupBindings").where("status", "==", "active").limit(50).get();
      const results = [];
      for (const doc of bindings.docs) {
        if (results.length >= requested) break;
        const binding = { id: doc.id, ...doc.data() };
        const carId = text(binding.carId), groupId = text(binding.groupId || doc.id);
        if (!carId || !groupId) continue;
        const existing = await getSnapshot(groupId);
        if (existing && ["verified", "needs_review"].includes(text(existing.status))) continue;
        const carDoc = await db.collection("cars").doc(carId).get();
        if (!carDoc.exists) continue;
        const car = { id: carDoc.id, ...carDoc.data() };
        if (!owns(car, identityIds) || isCarExpired(car)) continue;
        try {
          const result = await initializeMembershipSnapshot({ groupId, carId, car });
          results.push({ carId, groupId, initialized: result.initialized === true, reason: result.reason });
        } catch (error) {
          results.push({ carId, groupId, initialized: false, reason: "initialization_failed" });
        }
      }
      return send(res, 200, { success: true, processed: results.length, results });
    }

    return send(res, 400, { success: false, error: "unsupported_action" });
  } catch (error) {
    console.error("LINE membership health API failed.", error);
    return send(res, 500, { success: false, error: "line_membership_health_failed" });
  }
};
