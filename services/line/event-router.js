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
  recordGroupAccounting,
  queryGroupAccounting,
  mutateGroupAccounting
} = require(
  "./group-accounting-service"
);

const {
  resolveAccountingAuthority,
  canMutateEntry
} = require(
  "./accounting-authorization-service"
);

const {
  getEntryCode,
  listGroupAccountingAuditLogs
} = require(
  "../firebase/line-group-accounting-repository"
);

const {
  listCarAccountingAuditLogs
} = require(
  "../firebase/car-accounting-repository"
);

const {
  getActorNamesByLineUserIds
} = require(
  "../firebase/line-accounting-authorization-repository"
);

const {
  bindGroupToCar
} = require(
  "./group-car-binding-service"
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

  const queryAccounting =
    dependencies.queryGroupAccounting ||
    queryGroupAccounting;

  const mutateAccounting =
    dependencies.mutateGroupAccounting ||
    mutateGroupAccounting;

  const resolveAuthority =
    dependencies.resolveAccountingAuthority ||
    resolveAccountingAuthority;

  const listAuditLogs =
    dependencies.listGroupAccountingAuditLogs ||
    listGroupAccountingAuditLogs;

  const bindCarGroup =
    dependencies.bindGroupToCar ||
    bindGroupToCar;

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

  if (groupBinding && groupBinding.bound) {
    context.accountingCarId =
      groupBinding.binding.carId;
  }

  if (messageResult.action === "group_car_bind") {
    if (!context.replyToken) {
      return {
        handled: false,
        route: "message_missing_reply_token",
        context,
        groupBinding
      };
    }

    const bindResult = await bindCarGroup(
      context,
      messageResult.bindingCommand.carId
    );
    const failureMessages = {
      group_required: "車團綁定只能在 LINE 群組內執行。",
      line_identity_unlinked: "請先完成 LINE 與 JLY Member 身分連結。",
      car_not_found: "找不到這個 JLY 車團。",
      owner_required: "只有這個車團的建立主揪可以綁定群組。",
      binding_conflict: "這個 LINE 群組已綁定其他車團，為避免帳目混在一起，目前不會覆蓋。"
    };

    await replyWithText(
      context.replyToken,
      bindResult.bound
        ? "✅ 已綁定 JLY 車團\n" +
          `既有群組帳目已遷移 ${bindResult.migration.migrated} 筆。`
        : failureMessages[bindResult.reason] ||
          "車團綁定失敗，請稍後再試。"
    );

    return {
      handled: true,
      route: bindResult.bound
        ? "group_car_bound"
        : "group_car_bind_failed",
      context,
      groupBinding,
      bindResult
    };
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

    const creatorAuthority = await resolveAuthority(
      context,
      groupBinding
    );
    context.accountingActorMemberId = creatorAuthority.playerId || "";
    context.accountingActorDisplayName =
      creatorAuthority.playerDisplayName || "";

    const accountingResult =
      await recordAccounting(
        context,
        messageResult.accounting
      );

    if (!accountingResult.saved) {
      await replyWithText(
        context.replyToken,
        "這個 LINE 群組尚未綁定 JLY 車團，暫時不能建立正式帳目。"
      );

      return {
        handled: true,
        route: "accounting_binding_required",
        context,
        groupBinding,
        accountingResult
      };
    }

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

  if (messageResult.action === "accounting_query") {
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
        "群組帳本只能在 LINE 群組內查詢。"
      );

      return {
        handled: true,
        route: "accounting_group_required",
        context,
        groupBinding
      };
    }

    if (messageResult.accountingQuery.scope === "audit") {
      const authority = await resolveAuthority(
        context,
        groupBinding
      );

      if (!authority.canManageAll) {
        await replyWithText(
          context.replyToken,
          "只有已驗證的主揪或系統管理者可以查看帳目異動紀錄。"
        );

        return {
          handled: true,
          route: "accounting_audit_denied",
          context,
          groupBinding
        };
      }

      const auditReader = context.accountingCarId
        ? (dependencies.listCarAccountingAuditLogs ||
          listCarAccountingAuditLogs)
        : listAuditLogs;
      const auditLogs = await auditReader(
        context.accountingCarId || context.source.groupId,
        10
      );
      const actorNameReader =
        dependencies.getActorNamesByLineUserIds ||
        getActorNamesByLineUserIds;
      const actorNames = await actorNameReader(
        auditLogs.map(log => log.actorUserId)
      );

      const operationLabels = {
        create: "新增",
        update: "修改",
        delete: "刪除"
      };

      const lines = ["🧾 最近帳目異動紀錄"];

      if (auditLogs.length === 0) {
        lines.push("目前沒有異動紀錄。");
      } else {
        for (const log of auditLogs) {
          const actorLabel =
            log.actorDisplayName ||
            actorNames[log.actorUserId] ||
            shortenActorId(log.actorUserId);
          lines.push(
            `[${getEntryCode(log.entryId)}] ` +
            `${operationLabels[log.operation] || log.operation} ` +
            `操作者：${actorLabel}`
          );
        }
      }

      await replyWithText(
        context.replyToken,
        lines.join("\n")
      );

      return {
        handled: true,
        route: "accounting_audit",
        context,
        groupBinding,
        auditLogs
      };
    }

    const queryResult = await queryAccounting(
      context,
      messageResult.accountingQuery.scope
    );

    const scopeLabels = {
      today: "今日帳目",
      month: "本月帳目",
      all: "帳本餘額",
      recent: "最近帳目"
    };

    const label =
      scopeLabels[
        messageResult.accountingQuery.scope
      ];

    if (!queryResult.found) {
      await replyWithText(
        context.replyToken,
        `📒 ${label}\n目前沒有帳目。`
      );
    } else {
      const summary = queryResult.summary;
      const lines = [`📒 ${label}`];

      if (messageResult.accountingQuery.scope !== "recent") {
        lines.push(
          `收入：$${summary.income.toLocaleString("zh-TW")}`,
          `支出：$${summary.expense.toLocaleString("zh-TW")}`,
          `結餘：$${summary.balance.toLocaleString("zh-TW")}`
        );
      }

      if (messageResult.accountingQuery.scope !== "all") {
        lines.push("最近帳目：");

        for (const entry of queryResult.entries.slice(0, 10)) {
          const symbol =
            entry.type === "income" ? "+" : "-";

          lines.push(
            `[${getEntryCode(entry.id)}] ${symbol}$${Number(entry.amount).toLocaleString("zh-TW")} ${entry.description}`
          );
        }

        if (queryResult.entries.length > 10) {
          lines.push(
            `⋯另有 ${queryResult.entries.length - 10} 筆`
          );
        }
      }

      await replyWithText(
        context.replyToken,
        lines.join("\n")
      );
    }

    return {
      handled: true,
      route: "accounting_query",
      context,
      groupBinding,
      accountingQueryResult: queryResult
    };
  }

  if (messageResult.action === "accounting_mutation") {
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
        "群組帳目只能在原 LINE 群組內管理。"
      );

      return {
        handled: true,
        route: "accounting_group_required",
        context,
        groupBinding
      };
    }

    const authority = await resolveAuthority(
      context,
      groupBinding
    );

    const mutationResult = await mutateAccounting(
      context,
      messageResult.accountingMutation,
      authority,
      { canMutateEntry }
    );

    const replyByReason = {
      entry_not_found:
        "找不到這筆帳目，請先輸入 JLY 最近帳目確認編號。",
      permission_denied:
        "你只能修改或刪除自己建立的帳目。主揪與管理者需先完成 LINE 身分連結。",
      entry_unavailable:
        "這筆帳目已刪除或無法修改。"
    };

    if (!mutationResult.changed) {
      await replyWithText(
        context.replyToken,
        replyByReason[mutationResult.reason] ||
          "帳目異動失敗，請稍後再試。"
      );
    } else {
      const operationLabel =
        messageResult.accountingMutation.operation === "delete"
          ? "刪除"
          : "修改";

      await replyWithText(
        context.replyToken,
        `✅ 帳目已${operationLabel}\n` +
        `編號：${mutationResult.entryCode}\n` +
        "異動紀錄已保存。"
      );
    }

    return {
      handled: true,
      route: "accounting_mutation",
      context,
      groupBinding,
      accountingMutationResult: mutationResult
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

function shortenActorId(value) {
  const id = normalizeText(value);
  if (id.length <= 12) {
    return id || "未知使用者";
  }
  return `${id.slice(0, 5)}…${id.slice(-4)}`;
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
