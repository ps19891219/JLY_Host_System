/*
JLY Host System

Module:
LINE Message Router V1

Responsibilities:

1. Decide whether a LINE text message should be handled
2. Keep normal group conversation silent
3. Respond only when the user explicitly calls JLY Assistant
4. Return a normalized handling result

V1 triggers:
- 小助手
- JLY 小助手
- jly 小助手

V1 does NOT:
- Read Firebase
- Bind group to car
- Check permissions
- Handle accounting
- Handle reminders
*/

"use strict";

// ============================================================
// Normalize Text
// ============================================================

function normalizeText(value) {
  return String(
    value || ""
  ).trim();
}

// ============================================================
// Normalize For Command Matching
// ============================================================

function normalizeForMatch(value) {
  return normalizeText(
    value
  ).toLowerCase();
}

// ============================================================
// Detect Assistant Call
// ============================================================

function isAssistantCalled(text) {
  const normalized =
    normalizeForMatch(
      text
    );

  if (!normalized) {
    return false;
  }

  return (
    normalized.includes(
      "小助手"
    ) ||
    normalized.includes(
      "jly小助手"
    ) ||
    normalized.includes(
      "jly 小助手"
    )
  );
}

// ============================================================
// Build V1 Reply
// ============================================================

function buildAssistantReply(text) {
  const normalized =
    normalizeText(
      text
    );

  if (!normalized) {
    return "";
  }

  return (
    "我在這裡 🤖\n" +
    "JLY 小助手目前已經上線囉。"
  );
}

// ============================================================
// Route Text Message
// ============================================================

function routeTextMessage(text) {
  const normalizedText =
    normalizeText(
      text
    );

  if (!normalizedText) {
    return {
      handled: false,
      action:
        "ignore_empty",
      replyText: ""
    };
  }

  if (
    !isAssistantCalled(
      normalizedText
    )
  ) {
    return {
      handled: false,
      action:
        "ignore_normal_chat",
      replyText: ""
    };
  }

  return {
    handled: true,
    action:
      "assistant_called",
    replyText:
      buildAssistantReply(
        normalizedText
      )
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  routeTextMessage,
  isAssistantCalled
};