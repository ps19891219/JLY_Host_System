"use strict";

const { getCarById } = require("../services/firebase/line-accounting-authorization-repository");
const { getFirestore } = require("../services/firebase/admin");
const { readCookie, verifyMemberSession } = require("../services/line/member-session");

function text(value) { return String(value == null ? "" : value).trim(); }
function send(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}
function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(String(req.body || "{}")); } catch (_error) { return {}; }
}
function safeMatching(car) {
  const matching = car && car.matching && typeof car.matching === "object" ? car.matching : null;
  if (!matching) return null;
  return {
    status: text(matching.status),
    candidateSlots: Array.isArray(matching.candidateSlots) ? matching.candidateSlots : [],
    updatedAt: matching.updatedAt || null
  };
}
function responseIdFor(lineUserId) {
  return "line-" + text(lineUserId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

module.exports = async function handler(req, res) {
  if (!req || !["GET", "POST"].includes(req.method)) return send(res, 405, { success: false, error: "method_not_allowed" });
  const input = req.method === "POST" ? body(req) : (req.query || {});
  const carId = text(input.id || input.carId);
  if (!carId) return send(res, 400, { success: false, error: "car_id_required" });

  try {
    const car = await getCarById(carId);
    if (!car) return send(res, 404, { success: false, error: "car_not_found" });
    const matching = safeMatching(car);
    if (!matching) return send(res, 404, { success: false, error: "matching_not_found" });

    const verified = verifyMemberSession(readCookie(req));
    const session = verified.valid ? verified.data : null;
    const lineUserId = text(session && session.lineUserId);
    const displayName = text(session && session.displayName);
    const responseId = lineUserId ? responseIdFor(lineUserId) : "";
    const responses = car.matching && car.matching.responses && typeof car.matching.responses === "object" ? car.matching.responses : {};
    const existing = responseId ? (responses[responseId] || null) : null;

    if (req.method === "GET") {
      return send(res, 200, {
        success: true,
        authenticated: !!lineUserId,
        viewer: lineUserId ? { lineUserId, displayName } : null,
        car: { id: carId, scriptName: text(car.scriptName || car.name || "未命名劇本") },
        matching,
        response: existing
      });
    }

    if (!lineUserId) return send(res, 401, { success: false, error: "identity_required" });
    if (matching.status !== "published") return send(res, 409, { success: false, error: "matching_not_published" });

    const allowedIds = new Set(matching.candidateSlots.filter(slot => slot && slot.enabled !== false).map(slot => text(slot.id)).filter(Boolean));
    const slotIds = Array.isArray(input.slotIds) ? [...new Set(input.slotIds.map(text).filter(id => allowedIds.has(id)))] : [];
    const availabilityMode = text(input.availabilityMode) === "exclude" ? "exclude" : "available";
    const timestamp = new Date().toISOString();
    const old = existing || {};
    const response = {
      id: responseId,
      participantType: "line_user",
      participantKey: `line:${lineUserId}`,
      participantId: text(session.identityId || session.profileId || lineUserId),
      participantName: displayName || "LINE 使用者",
      displayName: displayName || "LINE 使用者",
      name: displayName || "LINE 使用者",
      lineUserId,
      slotIds,
      availabilityMode,
      status: "submitted",
      source: "public_matching_line",
      createdAt: old.createdAt || timestamp,
      updatedAt: timestamp
    };
    const db = getFirestore();
    await db.collection("cars").doc(carId).set({
      matching: {
        responses: { ...responses, [responseId]: response },
        updatedAt: timestamp
      },
      updatedAt: timestamp
    }, { merge: true });
    return send(res, 200, { success: true, response });
  } catch (error) {
    console.error("公開媒合讀寫失敗", error);
    return send(res, 500, { success: false, error: "matching_vote_failed" });
  }
};