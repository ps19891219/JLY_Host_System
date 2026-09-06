"use strict";

const { readCookie, verifyMemberSession } = require("../services/line/member-session");
const { submitCarEntry } = require("../services/car/car-entry-service");

function send(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

function body(req) {
  if (req && req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(String(req && req.body || "{}")); } catch (_error) { return {}; }
}

function statusFor(code) {
  if (code === "identity_required") return 401;
  if (code === "car_not_found") return 404;
  if (["already_player", "player_application_pending", "already_staff", "dm_application_pending", "staff_slot_unavailable"].includes(code)) return 409;
  if (["car_id_required", "entry_type_invalid"].includes(code)) return 400;
  return 500;
}

function createHandler(dependencies = {}) {
  const verifySession = dependencies.verifyMemberSession || verifyMemberSession;
  const submit = dependencies.submitCarEntry || submitCarEntry;

  return async function handler(req, res) {
    if (req.method !== "POST") return send(res, 405, { success: false, error: "method_not_allowed" });
    try {
      const verified = verifySession(readCookie(req));
      if (!verified.valid) return send(res, 401, { success: false, error: "identity_required" });
      const result = await submit(body(req), verified.data, dependencies);
      return send(res, 200, { success: true, result });
    } catch (error) {
      const code = String(error && (error.code || error.message) || "car_entry_failed");
      if (statusFor(code) >= 500) console.error("車團報名寫入失敗", error);
      return send(res, statusFor(code), { success: false, error: code });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
