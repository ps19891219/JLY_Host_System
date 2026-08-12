"use strict";

const { createLoginState } = require("../services/line/login-state");

function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (_error) { return {}; }
  }
  return {};
}

function send(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function safeReturnPath(value) {
  const path = String(value || "").trim();
  return path.startsWith("/") && !path.startsWith("//")
    ? path
    : "/index.html";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { success: false, error: "method_not_allowed" });
  }
  const secret = String(process.env.LINE_CHANNEL_SECRET || "").trim();
  if (!secret) {
    return send(res, 500, { success: false, error: "line_login_environment_missing" });
  }
  const input = body(req);
  const state = createLoginState({
    playerProfileId: input.playerProfileId,
    identityId: input.identityId,
    returnPath: safeReturnPath(input.returnPath)
  }, secret);
  return send(res, 200, { success: true, state });
};
