/*
JLY Host System

Module:
LINE Event Router V1.4

Responsibilities:

1. Receive verified LINE webhook events
2. Identify event type
3. Extract basic source information
4. Route event to the correct handler
5. Pass text messages to message-router
6. Reply only when message-router requests a reply
7. Resolve group binding when JLY Assistant is called in a group
8. Show a quick reply menu inside group conversations

V1.3 does NOT:
- Write Firebase
- Modify Player Profile
- Bind Car / Group
- Handle business commands
*/

"use strict";

const {
  sendReplyMessage,
  sendTextReply
} = require(
  "./line-reply"
);

const {
  buildGroupQuickMenuMessage
} = require(
  "./group-quick-menu"
);

const {
  routeTextMessage
} = require(
  "./message-router"
);

const {
  resolveGroupBinding
} = require(
  "./group-binding-service"
);

const {
  recordGroupAccounting
} = require(
  "./group-accounting-service"
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
  context,
  dependencies = {}
) {
  const replyWithText =
    dependencies.sendTextReply ||
    sendTextReply;

  const replyWithMessages =
    dependencies.sendReplyMessage ||
    sendReplyMessage;

  const resolveBinding =
    dependencies.resolveGroupBinding ||
    resolveGroupBinding;

  const recordAccounting =
    dependencies.recordGroupAccounting ||
    recordGroupAccounting;

  // ----------------------------------------------------------
  // Non-text message
  // ----------------------------------------------------------

  if (
    context.message.type !== "text"
  ) {
    return {
      handled: false,
      route:
        "message_non_text",
      context
    };
  }

  // ----------------------------------------------------------
  // Ask Message Router
  // ----------------------------------------------------------

  const messageResult =
    routeTextMessage(
      context.message.text
    );

  // ----------------------------------------------------------
  // Normal conversation
  //
  // JLY Assistant stays silent.
  // ----------------------------------------------------------

  if (
    !messageResult.handled
  ) {
    console.log(
      "LINE message ignored.",
      {
        action:
          messageResult.action,

        sourceType:
          context.source.type
      }
    );

    return {
      handled: false,
      route:
        messageResult.action,
      context
    };
  }

  // ----------------------------------------------------------
  // Resolve group binding only after the assistant is called.
  // Normal group conversation must not read Firebase.
  // ----------------------------------------------------------

  let groupBinding = null;

  if (
    context.source.type === "group" &&
    context.source.groupId
  ) {
    try {
      groupBinding =
        await resolveBinding(
          context.source.groupId
        );

      console.log(
        "LINE group binding resolved.",
        {
          bound:
            groupBinding.bound === true,

          reason:
            groupBinding.reason ||
            "unknown"
        }
      );
    } catch (error) {
      console.error(
        "LINE group binding lookup failed.",
        error
      );

      groupBinding = {
        bound: false,
        reason:
          "binding_lookup_failed",
        binding: null
      };
    }
  }

  // ----------------------------------------------------------
  // Group accounting command
  // ----------------------------------------------------------

  if (messageResult.action === "accounting_create") {
    if (!context.replyToken) {
      return {
        handled: false,
        route: "message_missing_reply_token",
        context,
        groupBinding
      };
    }

    if (
      context.source.type !== "group" ||
      !context.source.groupId
    ) {
      await replyWithText(
        context.replyToken,
        "群組記帳只能在 LINE 群組內使用。"
      );

      return {
        handled: true,
        route: "accounting_group_required",
        context,
        groupBinding
      };
    }

    const accountingResult =
      await recordAccounting(
        context,
        messageResult.accounting
      );

    const typeLabel =
      messageResult.accounting.type === "income"
        ? "收入"
        : "支出";

    await replyWithText(
      context.replyToken,
      "✅ 記帳成功\n" +
      `${typeLabel}：$${messageResult.accounting.amount.toLocaleString("zh-TW")}\n` +
      `說明：${messageResult.accounting.description}`
    );

    return {
      handled: true,
      route: "accounting_create",
      context,
      groupBinding,
      accountingResult
    };
  }

  // ----------------------------------------------------------
  // Reply requested
  // ----------------------------------------------------------

  if (
    !messageResult.replyText
  ) {
    return {
      handled: true,
      route:
        messageResult.action,
      context,
      groupBinding
    };
  }

  // ----------------------------------------------------------
  // replyToken required
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // Send LINE reply
  // ----------------------------------------------------------

  if (
    messageResult.action === "assistant_called" &&
    context.source.type === "group"
  ) {
    await replyWithMessages(
      context.replyToken,
      [
        buildGroupQuickMenuMessage()
      ]
    );
  } else {
    await replyWithText(
      context.replyToken,
      messageResult.replyText
    );
  }

  console.log(
    "LINE assistant reply sent.",
    {
      action:
        messageResult.action,

      sourceType:
        context.source.type,

      messageType:
        context.message.type
    }
  );

  return {
    handled: true,
    route:
      messageResult.action,
    context,
    groupBinding
  };
}

// ============================================================
// Route Single Event
// ============================================================

async function routeEvent(
  event,
  dependencies = {}
) {
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
        context,
        dependencies
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

async function routeEvents(
  events,
  dependencies = {}
) {
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
        event,
        dependencies
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
