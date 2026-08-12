"use strict";

const crypto = require("crypto");

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function secret(value) {
  return String(value || process.env.LINE_CHANNEL_SECRET || "").trim();
}

function createGroupAssistantToken(data, secretValue) {
  const key = secret(secretValue);
  if (!key) throw new Error("group_assistant_secret_missing");
  const payload = encode({
    groupId: String(data && data.groupId || "").trim(),
    carId: String(data && data.carId || "").trim(),
    issuedAt: new Date().toISOString()
  });
  const signature = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyGroupAssistantToken(token, secretValue) {
  const key = secret(secretValue);
  const [payload, received] = String(token || "").split(".");
  if (!key || !payload || !received) return { valid: false, reason: "invalid_token" };
  const expected = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "invalid_signature" };
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.groupId || !data.carId) return { valid: false, reason: "invalid_payload" };
    return { valid: true, data };
  } catch (_error) {
    return { valid: false, reason: "invalid_payload" };
  }
}

function getPublicBaseUrl() {
  const configured = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const vercelHost = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  return vercelHost ? `https://${vercelHost}` : "https://jly-host-system-eeso.vercel.app";
}

module.exports = { createGroupAssistantToken, verifyGroupAssistantToken, getPublicBaseUrl };
