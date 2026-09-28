"use strict";

const { getCarById } = require("../services/firebase/line-accounting-authorization-repository");
const { getFirestore } = require("../services/firebase/admin");
const { readCookie, verifyMemberSession } = require("../services/line/member-session");
const { carViewPayload } = require("../services/car/car-view-access");
const { submitCarEntry } = require("../services/car/car-entry-service");

function text(value) { return String(value == null ? "" : value).trim(); }

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(Number(value.seconds))) return Number(value.seconds) * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function temporarySharePolicy(db, shareRef, carId) {
  const ref = text(shareRef);
  if (!ref) return null;
  const snap = await db.collection("recruitPages").doc(ref).get();
  if (!snap.exists) return null;
  const page = snap.data() || {};
  const expiresAt = timestampMillis(page.expiresAt);
  const ids = Array.isArray(page.carIds) ? page.carIds.map(text) : [];
  if (text(page.status) !== "active" || text(page.scope) !== "selected" || !ids.includes(text(carId))) return null;
  if (expiresAt && Date.now() >= expiresAt) return null;
  return { showPlayers: page.showPlayers === true };
}

function hidePublicRoster(payload) {
  if (!payload || payload.access === "member" || !payload.car) return payload;
  return {
    ...payload,
    car: {
      ...payload.car,
      players: [],
      seatSlots: Array.isArray(payload.car.seatSlots)
        ? payload.car.seatSlots.map(slot => ({ ...slot, playerId: "" }))
        : []
    }
  };
}

function send(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

function requestBody(req) {
  if (req && req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(String(req && req.body || "{}")); } catch (_error) { return {}; }
}

function entryStatus(code) {
  if (code === "identity_required") return 401;
  if (code === "car_not_found") return 404;
  if ([
    "already_player", "player_application_pending", "already_staff", "dm_application_pending",
    "staff_slot_unavailable", "player_claim_unavailable", "player_capacity_full", "dm_capacity_full"
  ].includes(code)) return 409;
  if (["car_id_required", "entry_type_invalid"].includes(code)) return 400;
  return 500;
}

async function hydrateMemberSession(session, dependencies = {}) {
  if (!session || !text(session.lineUserId)) return session || null;
  const profileId = text(session.profileId);
  const needsResolution = session.provisional === true || !profileId || /^line:/i.test(profileId);
  if (!needsResolution) return session;

  const db = dependencies.db || getFirestore();
  const snapshot = await db.collection("players")
    .where("lineUserId", "==", text(session.lineUserId))
    .limit(2)
    .get();

  if (snapshot.empty || snapshot.docs.length !== 1) return session;
  const doc = snapshot.docs[0];
  const data = doc.data() || {};
  return {
    ...session,
    profileId: doc.id,
    identityId: text(data.identityId),
    displayName: text(data.displayName || data.nickname || data.playerName || session.displayName),
    provisional: false,
    resolvedFromLineIdentity: true
  };
}

function createHandler(dependencies = {}) {
  const readCar = dependencies.getCarById || getCarById;
  const verifySession = dependencies.verifyMemberSession || verifyMemberSession;
  const submit = dependencies.submitCarEntry || submitCarEntry;

  return async function handler(req, res) {
    if (!req || !["GET", "POST"].includes(req.method)) {
      return send(res, 405, { success: false, error: "method_not_allowed" });
    }

    if (req.method === "POST") {
      try {
        const verified = verifySession(readCookie(req));
        if (!verified.valid) return send(res, 401, { success: false, error: "identity_required" });
        const session = await hydrateMemberSession(verified.data, dependencies);
        const result = await submit(requestBody(req), session, dependencies);
        return send(res, 200, { success: true, result });
      } catch (error) {
        const code = String(error && (error.code || error.message) || "car_entry_failed");
        if (entryStatus(code) >= 500) console.error("車團報名寫入失敗", error);
        return send(res, entryStatus(code), { success: false, error: code });
      }
    }

    const carId = String(req.query && req.query.id || "").trim();
    if (!carId) return send(res, 400, { success: false, error: "car_id_required" });
    try {
      const car = await readCar(carId);
      if (!car) return send(res, 404, { success: false, error: "car_not_found" });
      const verified = verifySession(readCookie(req));
      const session = verified.valid ? await hydrateMemberSession(verified.data, dependencies) : null;
      let payload = carViewPayload(car, session);
      const shareRef = text(req.query && req.query.share);
      if (shareRef) {
        const db = dependencies.db || getFirestore();
        const policy = await temporarySharePolicy(db, shareRef, carId);
        if (policy && policy.showPlayers !== true) payload = hidePublicRoster(payload);
      }
      return send(res, 200, { success: true, ...payload });
    } catch (error) {
      console.error("讀取玩家車團資訊失敗", error);
      return send(res, 500, { success: false, error: "car_view_failed" });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.hydrateMemberSession = hydrateMemberSession;
module.exports.temporarySharePolicy = temporarySharePolicy;
module.exports.hidePublicRoster = hidePublicRoster;
