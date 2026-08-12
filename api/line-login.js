"use strict";

const { getFirestore } = require("../services/firebase/admin");

function text(value) {
  return String(value || "").trim();
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (_error) { return {}; }
  }
  return {};
}

async function exchangeAuthorizationCode(code) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: text(process.env.LINE_REDIRECT_URI),
    client_id: text(process.env.LINE_CHANNEL_ID),
    client_secret: text(process.env.LINE_CHANNEL_SECRET)
  });
  const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    const error = new Error("line_token_exchange_failed");
    error.statusCode = 401;
    throw error;
  }
  return data.access_token;
}

async function fetchLineProfile(accessToken) {
  const response = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profile = await response.json();
  if (!response.ok || !profile.userId) {
    const error = new Error("line_profile_failed");
    error.statusCode = 401;
    throw error;
  }
  return profile;
}

async function linkPlayerProfile(profileId, identityId, lineProfile) {
  const db = getFirestore();
  const profileRef = db.collection("players").doc(profileId);
  const [target, duplicate] = await Promise.all([
    profileRef.get(),
    db.collection("players")
      .where("lineUserId", "==", lineProfile.userId)
      .limit(1)
      .get()
  ]);
  if (!target.exists) {
    const error = new Error("member_not_found");
    error.statusCode = 404;
    throw error;
  }
  const targetData = target.data() || {};
  if (
    targetData.identityId &&
    text(targetData.identityId) !== identityId
  ) {
    const error = new Error("member_identity_mismatch");
    error.statusCode = 403;
    throw error;
  }
  if (!duplicate.empty && duplicate.docs[0].id !== profileId) {
    const error = new Error("line_already_linked");
    error.statusCode = 409;
    throw error;
  }
  await profileRef.set({
    lineUserId: lineProfile.userId,
    lineDisplayName: text(lineProfile.displayName),
    linePictureUrl: text(lineProfile.pictureUrl),
    isLineLinked: true,
    lineLinkedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, { merge: true });
  return { profileId, linked: true };
}

function createHandler(dependencies = {}) {
  const exchange = dependencies.exchangeAuthorizationCode || exchangeAuthorizationCode;
  const getProfile = dependencies.fetchLineProfile || fetchLineProfile;
  const link = dependencies.linkPlayerProfile || linkPlayerProfile;

  return async function handler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { success: false, error: "method_not_allowed" });
    }
    const body = requestBody(req);
    const code = text(body.code);
    const profileId = text(body.playerProfileId);
    const identityId = text(body.identityId);
    if (!code || !profileId || !identityId) {
      return sendJson(res, 400, { success: false, error: "member_link_data_missing" });
    }
    if (
      !dependencies.exchangeAuthorizationCode &&
      (!text(process.env.LINE_CHANNEL_ID) ||
        !text(process.env.LINE_CHANNEL_SECRET) ||
        !text(process.env.LINE_REDIRECT_URI))
    ) {
      return sendJson(res, 500, { success: false, error: "line_login_environment_missing" });
    }
    try {
      const accessToken = await exchange(code);
      const lineUser = await getProfile(accessToken);
      const linkResult = await link(profileId, identityId, lineUser);
      return sendJson(res, 200, {
        success: true,
        lineUser: {
          userId: lineUser.userId,
          displayName: text(lineUser.displayName),
          pictureUrl: text(lineUser.pictureUrl)
        },
        memberLink: linkResult
      });
    } catch (error) {
      console.error("LINE member link failed.", error);
      return sendJson(res, error.statusCode || 500, {
        success: false,
        error: error.message || "line_member_link_failed"
      });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.linkPlayerProfile = linkPlayerProfile;
