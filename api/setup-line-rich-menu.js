/*
JLY Host System

Protected one-time Vercel endpoint for applying the
JLY Assistant Rich Menu from a mobile browser.

Required environment variables:
- LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
- JLY_RICH_MENU_SETUP_SECRET
- JLY_RICH_MENU_SETUP_ENABLED=true
*/

"use strict";

const crypto = require("node:crypto");

const {
  applyRichMenu
} = require(
  "../scripts/setup-line-rich-menu"
);

function normalizeText(value) {
  return String(
    value || ""
  ).trim();
}

function sendJson(
  res,
  statusCode,
  data
) {
  res.statusCode = statusCode;
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );
  res.setHeader(
    "Cache-Control",
    "no-store"
  );
  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );
  res.end(
    JSON.stringify(data)
  );
}

function secretsMatch(
  received,
  expected
) {
  const receivedBuffer = Buffer.from(
    normalizeText(received),
    "utf8"
  );
  const expectedBuffer = Buffer.from(
    normalizeText(expected),
    "utf8"
  );

  if (
    receivedBuffer.length === 0 ||
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

function getRequestBody(req) {
  if (
    req.body &&
    typeof req.body === "object"
  ) {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_error) {
      return {};
    }
  }

  return {};
}

function createHandler(dependencies = {}) {
  const applyMenu =
    dependencies.applyRichMenu ||
    applyRichMenu;

  return async function handler(
    req,
    res
  ) {
    if (req.method !== "POST") {
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

    const setupEnabled =
      normalizeText(
        process.env
          .JLY_RICH_MENU_SETUP_ENABLED
      ).toLowerCase() === "true";

    if (!setupEnabled) {
      return sendJson(
        res,
        403,
        {
          success: false,
          error:
            "setup_disabled"
        }
      );
    }

    const expectedSecret =
      normalizeText(
        process.env
          .JLY_RICH_MENU_SETUP_SECRET
      );

    const lineToken =
      normalizeText(
        process.env
          .LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
      );

    if (
      !expectedSecret ||
      !lineToken
    ) {
      console.error(
        "LINE Rich Menu setup environment is incomplete."
      );
      return sendJson(
        res,
        500,
        {
          success: false,
          error:
            "setup_environment_missing"
        }
      );
    }

    const body =
      getRequestBody(req);

    if (
      !secretsMatch(
        body.secret,
        expectedSecret
      )
    ) {
      return sendJson(
        res,
        401,
        {
          success: false,
          error:
            "setup_unauthorized"
        }
      );
    }

    try {
      const richMenuId =
        await applyMenu(
          lineToken
        );

      return sendJson(
        res,
        200,
        {
          success: true,
          richMenuId,
          next:
            "Disable JLY_RICH_MENU_SETUP_ENABLED in Vercel."
        }
      );
    } catch (error) {
      console.error(
        "LINE Rich Menu deployment failed.",
        error
      );
      return sendJson(
        res,
        502,
        {
          success: false,
          error:
            "line_rich_menu_apply_failed"
        }
      );
    }
  };
}

module.exports = createHandler();
module.exports.createHandler =
  createHandler;
module.exports.secretsMatch =
  secretsMatch;
