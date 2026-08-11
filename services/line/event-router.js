/*
JLY Host System

Module:
LINE Event Router V1.1

Responsibilities:

1. Receive verified LINE webhook events
2. Identify event type
3. Extract basic source information
4. Route event to the correct handler
5. Reply to text messages for connection testing

V1.1 does NOT:
- Write Firebase
- Modify Player Profile
- Bind Car / Group
- Handle business commands
*/

"use strict";

const {
  sendTextReply
} = require(
  "./line-reply"
);

// ============================================================
// Normalize Text
// ============================================================

function normalizeText(value) {
  return String(
    value || ""
  ).trim();
}

// ============================================================
// Normalize Source
// ============================================================

function normalizeSource(event) {
  const source =
    event &&
    event.source &&
    typeof event.source === "object"
      ? event.source
      : {};

  return {
    type:
      normalizeText(
        source.type
      ),

    userId:
      normalizeText(
        source.userId
      ),

    groupId:
      normalizeText(
        source.groupId
      ),

    roomId:
      normalizeText(
        source.roomId
      )
  };
}

// ============================================================
// Normalize Message
// ============================================================

function normalizeMessage(event) {
  const message =
    event &&
    event.message &&
    typeof event.message === "object"
      ? event.message
      : {};

  return {
    id:
      normalizeText(
        message.id
      ),

    type:
      normalizeText(
        message.type
      ),

    text:
      message.type === "text"
        ? normalizeText(
            message.text
          )
        : ""
  };
}

// ============================================================
// Basic Event Data
// ============================================================

function createEventContext(event) {
  const eventType =
    normalizeText(
      event &&
      event.type
    );

  return {
    type:
      eventType,

    timestamp:
      Number(
        event &&
        event.timestamp
      ) || null,

    replyToken:
      normalizeText(
        event &&
        event.replyToken
      ),

    source:
      normalizeSource(
        event
      ),

    message:
      normalizeMessage(
        event
      )
  };
}

// ============================================================
// Log Event
// ============================================================

function logEvent(context) {
  console.log(
    "LINE Event:",
    {
      type:
        context.type,

      sourceType:
        context.source.type,

      userId:
        context.source.userId,

      groupId:
        context.source.groupId,

      roomId:
        context.source.roomId,

      messageType:
        context.message.type,

      text:
        context.message.text
    }
  );
}

// ============================================================
// Handle Message Event
// ============================================================

async function handleMessageEvent(
  context
) {
  if (
    context.message.type !== "text"
  ) {
    return {
      handled: true,
      route:
        "message_non_text",
      context
    };
  }

  if (!context.replyToken) {
    console.warn(
      "LINE message event has no replyToken."
    );

    return {
      handled: false,
      route:
        "message_missing_reply_token",
      context
    };
  }

  await sendTextReply(
    context.replyToken,
    "JLY 小助手收到囉 🤖"
  );

  console.log(
    "LINE reply sent.",
    {
      sourceType:
        context.source.type,

      messageType:
        context.message.type
    }
  );

  return {
    handled: true,
    route:
      "message_reply_test",
    context
  };
}

// ============================================================
// Route Single Event
// ============================================================

async function routeEvent(event) {
  const context =
    createEventContext(
      event
    );

  logEvent(
    context
  );

  switch (
    context.type
  ) {
    case "message":
      return handleMessageEvent(
        context
      );

    case "join":
      return {
        handled: true,
        route:
          "join",
        context
      };

    case "leave":
      return {
        handled: true,
        route:
          "leave",
        context
      };

    case "follow":
      return {
        handled: true,
        route:
          "follow",
        context
      };

    case "unfollow":
      return {
        handled: true,
        route:
          "unfollow",
        context
      };

    default:
      return {
        handled: false,
        route:
          "unknown",
        context
      };
  }
}

// ============================================================
// Route Event List
// ============================================================

async function routeEvents(events) {
  const eventList =
    Array.isArray(events)
      ? events
      : [];

  const results = [];

  for (
    const event
    of eventList
  ) {
    const result =
      await routeEvent(
        event
      );

    results.push(
      result
    );
  }

  return results;
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  routeEvent,
  routeEvents,
  createEventContext
};