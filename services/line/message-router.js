/*
JLY Host System

Module:
LINE Message Router V1.2

Responsibilities:

1. Decide whether a LINE text message should be handled
2. Keep normal group conversation silent
3. Respond only when the user explicitly calls JLY Assistant
4. Return a normalized handling result
5. Handle Rich Menu and group quick menu commands

V1 triggers:
- 小助手
- JLY 小助手
- jly 小助手

V1.1 Rich Menu commands:
- JLY 記帳
- JLY 車團資訊
- JLY 使用說明

V1.2 group quick menu command:
- JLY 提醒

V1 does NOT:
- Read Firebase
- Bind group to car
- Check permissions
- Handle accounting
- Handle reminders
*/

"use strict";

const {
  parseAccountingCommand
} = require(
  "./accounting-command"
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
// Rich Menu Entry Commands
// ============================================================

function routeMenuCommand(text) {
  const normalized =
    normalizeForMatch(
      text
    ).replace(
      /\s+/g,
      ""
    );

  switch (normalized) {
    case "jly記帳":
      return {
        handled: true,
        action:
          "assistant_accounting_menu",
        replyText:
          "💰 群組記帳\n" +
          "下一步請輸入：JLY 支出 金額 說明\n" +
          "例如：JLY 支出 350 聚餐飲料"
      };

    case "jly提醒":
      return {
        handled: true,
        action:
          "assistant_reminder_menu",
        replyText:
          "⏰ 群組提醒入口已開啟。\n" +
          "提醒內容與時間設定將在下一階段加入。"
      };

    case "jly車團資訊":
      return {
        handled: true,
        action:
          "assistant_car_info_menu",
        replyText:
          "🚐 車團資訊入口已開啟。\n" +
          "車團查詢內容將在下一階段加入。"
      };

    case "jly使用說明":
      return {
        handled: true,
        action:
          "assistant_help_menu",
        replyText:
          "❓ JLY 小助手功能入口\n" +
          "你可以使用下方選單進入記帳或車團資訊。"
      };

    default:
      return null;
  }
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

  const accountingResult =
    parseAccountingCommand(
      normalizedText
    );

  if (accountingResult) {
    if (!accountingResult.valid) {
      return {
        handled: true,
        action: "accounting_invalid",
        replyText:
          "記帳格式不正確。\n" +
          "請輸入：JLY 支出 金額 說明\n" +
          "例如：JLY 支出 350 聚餐飲料"
      };
    }

    return {
      handled: true,
      action: "accounting_create",
      replyText: "",
      accounting:
        accountingResult.command
    };
  }

  const menuResult =
    routeMenuCommand(
      normalizedText
    );

  if (menuResult) {
    return menuResult;
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
  isAssistantCalled,
  routeMenuCommand
};
