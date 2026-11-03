"use strict";

const {getAdminApp} = require("../services/firebase/admin");
const {listWelcomeGroups, listWelcomeChanges} = require("../services/line/group-welcome-admin-read");

function respond(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(data));
}

async function authorize(req, dependencies = {}) {
  const header = String(req.headers && req.headers.authorization || "");
  const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(header);
  if (!match) return false;
  const app = (dependencies.getAdminApp || getAdminApp)();
  const decoded = await app.auth().verifyIdToken(match[1], true);
  // Explicit server-side Firebase custom claim only. Never trust a client role or groupId.
  return decoded && decoded.admin === true;
}

async function handler(req, res, dependencies = {}) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return respond(res, 405, {error: "method_not_allowed"});
  }
  let authorized = false;
  try { authorized = await authorize(req, dependencies); } catch (_) {}
  if (!authorized) return respond(res, 403, {error: "admin_required"});
  try {
    const url = new URL(req.url, "https://localhost");
    const groupId = String(url.searchParams.get("groupId") || "").trim();
    const cursor = String(url.searchParams.get("cursor") || "").trim();
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    if ((groupId && (!/^[-A-Za-z0-9_]{1,200}$/.test(groupId))) || (cursor && !/^[-A-Za-z0-9_]{1,200}$/.test(cursor))) {
      return respond(res, 400, {error: "invalid_query_parameter"});
    }
    if (groupId) {
      const data = await (dependencies.listWelcomeChanges || listWelcomeChanges)(groupId, limit, cursor);
      return respond(res, 200, data);
    }
    const data = await (dependencies.listWelcomeGroups || listWelcomeGroups)(limit, cursor);
    return respond(res, 200, data);
  } catch (error) {
    if (error.message === "group_id_required" || error.message === "invalid_audit_cursor") {
      return respond(res, 400, {error: error.message});
    }
    console.error("Welcome admin read failed", error);
    return respond(res, 500, {error: "internal_error"});
  }
}

module.exports = handler;
module.exports.authorize = authorize;
