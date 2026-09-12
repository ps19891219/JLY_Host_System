/*
JLY Host System

Module:
LINE Messaging Webhook V1.3

Responsibilities:
1. Receive webhook events from LINE Messaging API
2. Verify LINE webhook signature
3. Parse webhook events
4. Route verified events to services/line/event-router.js
5. Prioritize memberJoined welcome replies through a fast path
6. Process membership health only for the affected LINE group
7. Return HTTP 200 after successful processing

Environment Variable:
LINE_MESSAGING_CHANNEL_SECRET
*/

"use strict";

const crypto = require("crypto");
const { routeEvents } = require("../services/line/event-router");
const { sendMemberJoinedWelcome } = require("../services/line/member-welcome-fastpath");
const {
  processMembershipEvents
} = require("../services/line/group-membership-event-service");

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!rawBody || !signature || !channelSecret) return false;
  const expectedSignature = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function processVerifiedEvents(events, dependencies = {}) {
  const route = dependencies.routeEvents || routeEvents;
  const welcome = dependencies.sendMemberJoinedWelcome || sendMemberJoinedWelcome;
  const processMembership = dependencies.processMembershipEvents || processMembershipEvents;
  const eventList = Array.isArray(events) ? events : [];
  const routeResults = [];

  /*
   * memberJoined replies use a dedicated fast path. They only need the group
   * binding and can fall back to a generic card if car metadata is slow. This
   * keeps LINE reply-token work ahead of all secondary routing/bookkeeping.
   */
  for (const event of eventList) {
    if (event && event.type === "memberJoined") {
      routeResults.push(await welcome(event));
      continue;
    }

    const routed = await route([event]);
    if (Array.isArray(routed)) routeResults.push(...routed);
  }

  const membershipResults = await processMembership(eventList);

  return { routeResults, membershipResults };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { success: false, error: "method_not_allowed" });
  }

  const channelSecret = String(
    process.env.LINE_MESSAGING_CHANNEL_SECRET || ""
  ).trim();
  if (!channelSecret) {
    console.error("LINE Messaging Channel Secret is missing.");
    return sendJson(res, 500, {
      success: false,
      error: "line_messaging_environment_missing"
    });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = String(req.headers["x-line-signature"] || "").trim();
    if (!signature) {
      console.error("LINE webhook signature is missing.");
      return sendJson(res, 401, { success: false, error: "line_signature_missing" });
    }
    if (!verifyLineSignature(rawBody, signature, channelSecret)) {
      console.error("LINE webhook signature verification failed.");
      return sendJson(res, 401, { success: false, error: "line_signature_invalid" });
    }

    let body = {};
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch (error) {
      console.error("LINE webhook JSON parse failed.", error);
      return sendJson(res, 400, { success: false, error: "invalid_json" });
    }

    const events = Array.isArray(body.events) ? body.events : [];
    const { routeResults, membershipResults } = await processVerifiedEvents(events);

    console.log("LINE webhook verified.", {
      eventCount: events.length,
      routes: routeResults.map(result => result.route),
      membership: membershipResults.map(result => result.reason)
    });

    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error("LINE webhook server error.", error);
    return sendJson(res, 500, { success: false, error: "line_webhook_server_error" });
  }
}

module.exports = handler;
module.exports.processVerifiedEvents = processVerifiedEvents;
module.exports.verifyLineSignature = verifyLineSignature;
