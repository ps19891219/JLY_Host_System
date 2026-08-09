/*
JLY Host System

Module:
LINE Messaging Webhook V1.1

Responsibilities:

1. Receive webhook events from LINE Messaging API
2. Verify LINE webhook signature
3. Parse webhook events
4. Route verified events to services/line/event-router.js
5. Return HTTP 200 after successful processing

V1.1 does NOT:
- Send LINE messages
- Save groupId / userId
- Write to Firebase
- Bind Car / Group
- Modify Player Profile

Environment Variable:
LINE_MESSAGING_CHANNEL_SECRET
*/

"use strict";

const crypto = require("crypto");

const {
  routeEvents
} = require(
  "../services/line/event-router"
);

// ============================================================
// JSON Response
// ============================================================

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.end(
    JSON.stringify(data)
  );
}

// ============================================================
// Read Raw Request Body
//
// LINE signature verification must use the original request body.
// ============================================================

async function getRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks);
}

// ============================================================
// Verify LINE Signature
// ============================================================

function verifyLineSignature(
  rawBody,
  signature,
  channelSecret
) {
  if (
    !rawBody ||
    !signature ||
    !channelSecret
  ) {
    return false;
  }

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        channelSecret
      )
      .update(rawBody)
      .digest("base64");

  const receivedBuffer =
    Buffer.from(signature);

  const expectedBuffer =
    Buffer.from(
      expectedSignature
    );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

// ============================================================
// Main Handler
// ============================================================

module.exports =
async function handler(req, res) {
  // ----------------------------------------------------------
  // LINE webhook uses POST
  // ----------------------------------------------------------

  if (
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      "POST"
    );

    return sendJson(
      res,
      405,
      {
        success: false,
        error:
          "method_not_allowed"
      }
    );
  }

  // ----------------------------------------------------------
  // Environment Variable
  // ----------------------------------------------------------

  const channelSecret =
    String(
      process.env
        .LINE_MESSAGING_CHANNEL_SECRET ||
      ""
    ).trim();

  if (!channelSecret) {
    console.error(
      "LINE Messaging Channel Secret is missing."
    );

    return sendJson(
      res,
      500,
      {
        success: false,
        error:
          "line_messaging_environment_missing"
      }
    );
  }

  try {
    // ========================================================
    // STEP 1
    // Get original request body
    // ========================================================

    const rawBody =
      await getRawBody(req);

    // ========================================================
    // STEP 2
    // Get LINE signature
    // ========================================================

    const signature =
      String(
        req.headers[
          "x-line-signature"
        ] ||
        ""
      ).trim();

    if (!signature) {
      console.error(
        "LINE webhook signature is missing."
      );

      return sendJson(
        res,
        401,
        {
          success: false,
          error:
            "line_signature_missing"
        }
      );
    }

    // ========================================================
    // STEP 3
    // Verify signature
    // ========================================================

    const isValid =
      verifyLineSignature(
        rawBody,
        signature,
        channelSecret
      );

    if (!isValid) {
      console.error(
        "LINE webhook signature verification failed."
      );

      return sendJson(
        res,
        401,
        {
          success: false,
          error:
            "line_signature_invalid"
        }
      );
    }

    // ========================================================
    // STEP 4
    // Parse webhook body
    // ========================================================

    let body = {};

    try {
      body =
        JSON.parse(
          rawBody.toString(
            "utf8"
          )
        );
    } catch (error) {
      console.error(
        "LINE webhook JSON parse failed.",
        error
      );

      return sendJson(
        res,
        400,
        {
          success: false,
          error:
            "invalid_json"
        }
      );
    }

    const events =
      Array.isArray(
        body.events
      )
        ? body.events
        : [];

    // ========================================================
    // STEP 5
    // Route verified LINE events
    // ========================================================

    const routeResults =
      await routeEvents(
        events
      );

    console.log(
      "LINE webhook verified.",
      {
        eventCount:
          events.length,

        routes:
          routeResults.map(
            function (result) {
              return result.route;
            }
          )
      }
    );

    // ========================================================
    // Success
    // ========================================================

    return sendJson(
      res,
      200,
      {
        success: true
      }
    );
  } catch (error) {
    console.error(
      "LINE webhook server error.",
      error
    );

    return sendJson(
      res,
      500,
      {
        success: false,
        error:
          "line_webhook_server_error"
      }
    );
  }
};