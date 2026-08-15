/*
JLY Host System

API:
POST /api/run-reminders

Purpose:
Scheduler adapter for JLY Reminder Core.

Security:
Authorization: Bearer REMINDER_DISPATCH_SECRET
*/

"use strict";

const {
  dispatchDueReminders
} = require(
  "../services/line/reminder-dispatch-service"
);


function normalizeText(value) {
  return String(
    value == null ? "" : value
  ).trim();
}


function send(
  res,
  status,
  data
) {
  res.statusCode =
    status;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.end(
    JSON.stringify(
      data
    )
  );
}


function getBearerToken(req) {
  const authorization =
    normalizeText(
      req &&
      req.headers &&
      req.headers.authorization
    );

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  return match
    ? normalizeText(
        match[1]
      )
    : "";
}


module.exports =
  async function handler(
    req,
    res
  ) {
    if (
      req.method !== "POST"
    ) {
      return send(
        res,
        405,
        {
          success: false,
          error:
            "method_not_allowed"
        }
      );
    }

    const expectedSecret =
      normalizeText(
        process.env
          .REMINDER_DISPATCH_SECRET
      );

    if (!expectedSecret) {
      console.error(
        "REMINDER_DISPATCH_SECRET is not configured."
      );

      return send(
        res,
        503,
        {
          success: false,
          error:
            "dispatcher_not_configured"
        }
      );
    }

    const receivedSecret =
      getBearerToken(
        req
      );

    if (
      !receivedSecret ||
      receivedSecret !==
        expectedSecret
    ) {
      return send(
        res,
        401,
        {
          success: false,
          error:
            "unauthorized"
        }
      );
    }

    try {
      const result =
        await dispatchDueReminders({
          limit: 30
        });

      return send(
        res,
        200,
        {
          success: true,
          ...result
        }
      );

    } catch (error) {
      console.error(
        "Reminder dispatcher failed.",
        error
      );

      return send(
        res,
        500,
        {
          success: false,
          error:
            "reminder_dispatch_failed"
        }
      );
    }
  };