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
  parseAccountingCommand,
  parseAccountingQuery,
  parseAccountingMutation,
  parseGroupBindingCommand
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
    case "jly車團帳務":
      return {
        handled: true,
        action: "assistant_accounting_card",
        replyText: "開啟車團帳務選單"
      };

    case "jly記帳":
      return {
        handled: true,
        action:
          "assistant_accounting_menu",
        replyText:
          "💰 群組記帳\n" +
          "新增：JLY 支出 350 聚餐飲料\n" +
          "查詢：JLY 今日帳目／JLY 本月帳目\n" +
          "管理：JLY 最近帳目"
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

    case "jly成員座位":
      return {
        handled: true,
        action: "assistant_member_menu",
        replyText: "👥 成員與座位功能將在下一階段加入。"
      };

    case "jly最新通知":
      return {
        handled: true,
        action: "assistant_notice_menu",
        replyText: "📣 目前沒有新的車團通知。"
      };

    case "jly新增分帳":
      return {
        handled: true,
        action: "assistant_split_create",
        replyText: "➕ 新增分帳頁面將在下一階段加入。"
      };

    case "jly我的分帳":
      return {
        handled: true,
        action: "assistant_my_balance",
        replyText: "👤 個人應收／應付頁面將在下一階段加入。"
      };

    case "jly我的帳目":
      return {
        handled: true,
        action: "assistant_my_entries",
        replyText: "✏️ 我的帳目頁面將在下一階段加入。"
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
          "❓ 使用說明\n" +
          "點選「車團帳務」，即可新增此劇本的帳目。"
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

  const bindingCommand =
    parseGroupBindingCommand(normalizedText);

  if (bindingCommand) {
    return {
      handled: true,
      action: "group_car_bind",
      replyText: "",
      bindingCommand
    };
  }

  const accountingMutation =
    parseAccountingMutation(normalizedText);

  if (accountingMutation) {
    if (!accountingMutation.valid) {
      return {
        handled: true,
        action: "accounting_mutation_invalid",
        replyText:
          "帳目修改格式不正確。\n" +
          "例如：JLY 修改帳目 ABCD1234 支出 400 新說明"
      };
    }

    return {
      handled: true,
      action: "accounting_mutation",
      replyText: "",
      accountingMutation:
        accountingMutation.mutation
    };
  }

  const accountingQuery =
    parseAccountingQuery(
      normalizedText
    );

  if (accountingQuery) {
    return {
      handled: true,
      action: "accounting_query",
      replyText: "",
      accountingQuery
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
