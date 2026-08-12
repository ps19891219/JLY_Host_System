"use strict";

const crypto = require("crypto");
const COOKIE_NAME = "jly_member_session";

function key(value) {
  return String(value || process.env.LINE_CHANNEL_SECRET || "").trim();
}

function createMemberSession(data, secretValue) {
  const secret = key(secretValue);
  if (!secret) throw new Error("member_session_secret_missing");
  const payload = Buffer.from(JSON.stringify({
    profileId: String(data.profileId || "").trim(),
    identityId: String(data.identityId || "").trim(),
    lineUserId: String(data.lineUserId || "").trim(),
    displayName: String(data.displayName || "").trim(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyMemberSession(token, secretValue) {
  const secret = key(secretValue);
  const [payload, received] = String(token || "").split(".");
  if (!secret || !payload || !received) return { valid: false };
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false };
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.profileId || !data.lineUserId || Number(data.expiresAt) <= Date.now()) return { valid: false };
    return { valid: true, data };
  } catch (_error) { return { valid: false }; }
}

function readCookie(req) {
  const cookies = String(req && req.headers && req.headers.cookie || "").split(";");
  for (const item of cookies) {
    const [name, ...value] = item.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(value.join("="));
  }
  return "";
}

function cookieHeader(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`;
}

module.exports = { COOKIE_NAME, createMemberSession, verifyMemberSession, readCookie, cookieHeader };
