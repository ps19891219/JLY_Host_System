"use strict";

const crypto = require("node:crypto");

function text(value) {
  return String(value || "").trim();
}

function encode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

function createLoginState(data, secret, now = Date.now()) {
  if (!text(secret)) {
    throw new Error("line_login_state_secret_missing");
  }
  const payload = encode(JSON.stringify({
    nonce: crypto.randomBytes(18).toString("base64url"),
    issuedAt: now,
    playerProfileId: text(data && data.playerProfileId),
    identityId: text(data && data.identityId),
    returnPath: text(data && data.returnPath) || "/index.html"
  }));
  return `${payload}.${sign(payload, secret)}`;
}

function verifyLoginState(state, secret, now = Date.now()) {
  const parts = text(state).split(".");
  if (parts.length !== 2 || !text(secret)) {
    return { valid: false, reason: "line_login_state_invalid" };
  }
  const expected = Buffer.from(sign(parts[0], secret));
  const received = Buffer.from(parts[1]);
  if (
    expected.length !== received.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return { valid: false, reason: "line_login_state_invalid" };
  }
  try {
    const data = JSON.parse(decode(parts[0]));
    const age = now - Number(data.issuedAt || 0);
    if (age < 0 || age > 10 * 60 * 1000) {
      return { valid: false, reason: "line_login_state_expired" };
    }
    return { valid: true, data };
  } catch (_error) {
    return { valid: false, reason: "line_login_state_invalid" };
  }
}

module.exports = {
  createLoginState,
  verifyLoginState
};
