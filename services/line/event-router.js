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
*/

"use strict";

const {
  sendReplyMessage,
  sendTextReply
} = require(
  "./line-reply"
);

const {
  buildGroupAssistantCard,
  buildAccountingMenuCard
} = require("./group-assistant-card");
const {
  buildMemberWelcomeCard
} = require("./member-welcome-card");
const { getCarById } = require("../firebase/line-accounting-authorization-repository");
const {
  createGroupAssistantToken,
  getPublicBaseUrl
} = require("./group-assistant-link");

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
const {
  prepareGroupPairing,
  confirmGroupPairing,
  cancelGroupPairing
} = require("./group-car-pairing-service");
const { prepareQuickAccounting, saveResolvedQuickAccounting } = require("./quick-accounting-service");
const { buildStoreInfo, buildTimeInfo, buildPeopleInfo } = require("./car-info-slices");
const {
  getReminderStatus,
  enableGroupPreTripReminder,
  captureGroupReminderTargets
} = require("./reminder-service");
const {
  detectGroupCar
} = require("./group-auto-binding-service");
const {
  addMentionedRosterMembers
} = require("./group-roster-service");

function normalizeText(value) {
  return String(
    value || ""
  ).trim();
}

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

function normalizeMessage(event) {
  const message =
    event &&
    event.message &&
    typeof event.message === "object"
      ? event.message
      : {};

  const mentions =
    message &&
    message.mention &&
    Array.isArray(
      message.mention.mentionees
    )
      ? message.mention.mentionees
          .map(function (mention) {
            const source =
              mention &&
              typeof mention === "object"
                ? mention
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
              isSelf:
                source.isSelf === true,
              index:
                Number(source.index || 0),
              length:
                Number(source.length || 0)
            };
          })
      : [];

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
        : "",

    mentions
  };
}

function normalizePostback(event) {
  const source =
    event &&
    event.postback &&
    typeof event.postback === "object"
      ? event.postback
      : {};

  return {
    data:
      normalizeText(
        source.data
      )
  };
}

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
      ),

    postback:
      normalizePostback(
        event
      ),

    joinedMembers:
      Array.isArray(
        event &&
        event.joined &&
        event.joined.members
      )
        ? event.joined.members
            .map(function (member) {
              return {
                type: normalizeText(member && member.type),
                userId: normalizeText(member && member.userId)
              };
            })
            .filter(function (member) {
              return Boolean(member.userId);
            })
        : []
  };
}

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
  const preparePairing = dependencies.prepareGroupPairing || prepareGroupPairing;
  const confirmPairing = dependencies.confirmGroupPairing || confirmGroupPairing;
  const cancelPairing = dependencies.cancelGroupPairing || cancelGroupPairing;
  const readCar = dependencies.getCarById || getCarById;
  const createAssistantToken = dependencies.createGroupAssistantToken || createGroupAssistantToken;
  const readPublicBaseUrl = dependencies.getPublicBaseUrl || getPublicBaseUrl;
  const prepareQuickEntry = dependencies.prepareQuickAccounting || prepareQuickAccounting;
  const saveResolvedQuickEntry = dependencies.saveResolvedQuickAccounting || saveResolvedQuickAccounting;
  const readReminderStatus =
    dependencies.getReminderStatus ||
    getReminderStatus;
  const enableReminder =
    dependencies.enableGroupPreTripReminder ||
    enableGroupPreTripReminder;

  const captureReminderTargets =
    dependencies.captureGroupReminderTargets ||
    captureGroupReminderTargets;

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

  const messageResult =
    routeTextMessage(
      context.message.text
    );

  const hasReminderMentions =
    context.source.type === "group" &&
    Array.isArray(context.message.mentions) &&
    context.message.mentions.some(
      function (mention) {
        return (
          mention &&
          mention.type === "user" &&
          mention.isSelf !== true
        );
      }
    );

  if (
    !messageResult.handled &&
    !hasReminderMentions
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

  if (
    messageResult.action ===
      "assistant_roster_add"
  ) {
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
        "新增車友只能在 LINE 車群內使用。"
      );
      return {
        handled: true,
        route: "assistant_roster_group_required",
        context,
        groupBinding
      };
    }

    if (!context.accountingCarId) {
      await replyWithText(
        context.replyToken,
        "請先將這個 LINE 群組綁定 JLY 車團，再使用新增 DM／男位／女位。"
      );
      return {
        handled: true,
        route: "assistant_roster_binding_required",
        context,
        groupBinding
      };
    }

    const rosterResult =
      await addMentionedRosterMembers(
        context,
        messageResult.rosterCommand &&
          messageResult.rosterCommand.role,
        dependencies
      );

    const rosterFailure = {
      mentions_required:
        "請在指令後直接 @ 要新增的車友，例如：新增男位 @小明 @阿哲",
      line_identity_unlinked:
        "發出這個指令的人尚未完成 JLY LINE 身分連結，暫時不能修改車團名單。",
      owner_or_manager_required:
        "只有這台車的主揪／管理者可以從 LINE 群組新增人員。",
      role_invalid:
        "請使用「新增DM」、「新增男位」或「新增女位」。",
      car_not_found:
        "找不到這台 JLY 車團。",
      binding_required:
        "請先將這個 LINE 群組綁定 JLY 車團。"
    };

    if (!rosterResult.changed) {
      if (
        rosterResult.reason ===
          "no_roster_change"
      ) {
        await replyWithText(
          context.replyToken,
          "這批車友已經在本場名單裡，不需要重複新增。"
        );
      } else {
        await replyWithText(
          context.replyToken,
          rosterFailure[rosterResult.reason] ||
            "這次新增沒有完成，請稍後再試。"
        );
      }

      return {
        handled: true,
        route: "assistant_roster_add_failed",
        context,
        groupBinding,
        rosterResult
      };
    }

    const label =
      messageResult.rosterCommand &&
      messageResult.rosterCommand.label
        ? messageResult.rosterCommand.label
        : "人員";
    const lines = [
      "✅ " + label + "登記完成",
      "",
      "已加入：" +
        String(
          Number(
            rosterResult.addedCount || 0
          )
        ) +
        " 人"
    ];

    if (
      Number(
        rosterResult.seatedCount || 0
      ) > 0
    ) {
      lines.push(
        "已自動入座：" +
          String(
            Number(
              rosterResult.seatedCount
            )
          ) +
          " 人"
      );
    }

    if (
      Number(
        rosterResult.alreadyExistsCount || 0
      ) > 0
    ) {
      lines.push(
        "原本已在名單：" +
          String(
            Number(
              rosterResult.alreadyExistsCount
            )
          ) +
          " 人"
      );
    }

    if (
      Number(
        rosterResult.pendingIdentityCount || 0
      ) > 0
    ) {
      lines.push(
        "待認領：" +
          String(
            Number(
              rosterResult.pendingIdentityCount
            )
          ) +
          " 人",
        "",
        "待認領的車友只保留本場 LINE 關聯，不會另外建立重複 Person。"
      );
    }

    await replyWithText(
      context.replyToken,
      lines.join("\n")
    );

    return {
      handled: true,
      route: "assistant_roster_added",
      context,
      groupBinding,
      rosterResult
    };
  }

  if (
    !messageResult.handled &&
    hasReminderMentions
  ) {
    if (
      !context.replyToken ||
      !context.accountingCarId
    ) {
      return {
        handled: false,
        route: "ignore_normal_chat",
        context,
        groupBinding
      };
    }

    const targetResult =
      await captureReminderTargets(
        context.accountingCarId,
        context.message.mentions,
        dependencies
      );

    if (
      targetResult.captured === true
    ) {
      const lines = [
        "✅ 已記住這台車的提醒名單！",
        "",
        "這次新增：" +
          String(
            Number(
              targetResult.addedCount || 0
            )
          ) +
          " 人",
        "目前名單：" +
          String(
            Number(
              targetResult.totalCount || 0
            )
          ) +
          " 人"
      ];

      if (
        Number(
          targetResult.unavailableCount || 0
        ) > 0
      ) {
        lines.push(
          "",
          "另有 " +
            String(
              Number(
                targetResult.unavailableCount
              )
            ) +
            " 位因 LINE 未提供 userId，這次無法加入。"
        );
      }

      lines.push(
        "",
        "行前提醒時，JLY 小助手會在群組直接標記這些車友。"
      );

      await replyWithText(
        context.replyToken,
        lines.join("\n")
      );

      return {
        handled: true,
        route:
          "assistant_reminder_targets_captured",
        context,
        groupBinding,
        targetResult
      };
    }

    if (
      targetResult.reason ===
        "mention_all_not_supported"
    ) {
      await replyWithText(
        context.replyToken,
        "請直接 @ 個別車友，不要使用 @All，這樣 JLY 才能建立正確的提醒名單。"
      );

      return {
        handled: true,
        route:
          "assistant_reminder_targets_all_unsupported",
        context,
        groupBinding,
        targetResult
      };
    }

    if (
      targetResult.reason ===
        "mention_user_id_unavailable"
    ) {
      await replyWithText(
        context.replyToken,
        "我有看到標記，但 LINE 這次沒有提供可用的 userId。可以改標記其他車友，或請對方先與官方帳號互動後再試一次。"
      );

      return {
        handled: true,
        route:
          "assistant_reminder_targets_unavailable",
        context,
        groupBinding,
        targetResult
      };
    }

    return {
      handled: false,
      route:
        "ignore_normal_chat",
      context,
      groupBinding,
      targetResult
    };
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

    const command = messageResult.bindingCommand;
    if (command.action === "prepare") {
      const prepared = await preparePairing(context, command.pairingCode);
      const failureMessages = {
        group_required: "車團綁定只能在 LINE 群組內執行。",
        pairing_not_found: "找不到這組配對碼，請回到車團頁面重新產生。",
        pairing_expired: "這組配對碼已超過 10 分鐘，請重新產生。",
        pairing_unavailable: "這組配對碼已使用或已取消，請重新產生。",
        pairing_not_authorized: "這組配對碼不是由車團管理端授權產生，請回到車團頁面重新產生。",
        line_identity_unlinked: "請先完成 LINE 與 JLY Member 身分連結。",
        car_not_found: "找不到這個 JLY 車團。",
        owner_required: "這組配對碼未通過車團權限驗證，請回到車團頁面重新產生。"
      };
      if (!prepared.prepared) {
        await replyWithText(context.replyToken, failureMessages[prepared.reason] || "車團配對失敗，請稍後再試。");
        return { handled: true, route: "group_car_pairing_failed", context, pairingResult: prepared };
      }
      const dateLine = prepared.car.date ? `\n日期：${prepared.car.date}` : "";
      await replyWithMessages(context.replyToken, [{
        type: "text",
        text: `準備綁定車團：\n《${prepared.car.label}》${dateLine}\n\n請確認是否要綁定到目前這個 LINE 群組。`,
        quickReply: {
          items: [
            { type: "action", action: { type: "message", label: "確認綁定", text: `JLY 確認綁定 ${prepared.code}` } },
            { type: "action", action: { type: "message", label: "取消", text: `JLY 取消綁定 ${prepared.code}` } }
          ]
        }
      }]);
      return { handled: true, route: "group_car_pairing_prepared", context, pairingResult: prepared };
    }
    if (command.action === "cancel") {
      const cancelled = await cancelPairing(context, command.pairingCode);
      await replyWithText(context.replyToken, cancelled.cancelled ? "已取消這次車團綁定。" : "無法取消：配對碼已失效或不屬於這個群組。" );
      return { handled: true, route: cancelled.cancelled ? "group_car_pairing_cancelled" : "group_car_pairing_cancel_failed", context };
    }
    const bindResult = command.action === "confirm"
      ? await confirmPairing(context, command.pairingCode)
      : await bindCarGroup(context, command.carId);
    const failureMessages = {
      group_required: "車團綁定只能在 LINE 群組內執行。",
      line_identity_unlinked: "請先完成 LINE 與 JLY Member 身分連結。",
      car_not_found: "找不到這個 JLY 車團。",
      owner_required: "舊式直接綁定僅限車團建立主揪；請改由車團頁面產生配對碼。",
      binding_conflict: "這個 LINE 群組已綁定其他車團，為避免帳目混在一起，目前不會覆蓋。",
      pairing_not_found: "找不到這組配對碼，請重新產生。",
      pairing_expired: "這組配對碼已超過 10 分鐘，請重新產生。",
      pairing_not_authorized: "這組配對碼不是由車團管理端授權產生，請重新產生。",
      pairing_confirmation_mismatch: "只能由在這個群組開始配對的同一位使用者確認。"
    };

    let bindingReply = failureMessages[bindResult.reason] ||
      "車團綁定失敗，請稍後再試。";
    if (bindResult.bound) {
      const carLabel = normalizeText(bindResult.car && bindResult.car.label) || "JLY 車團";
      bindingReply =
        `✅ 已成功綁定《${carLabel}》\n\n` +
        "群組成員現在就可以使用下方入口報名／認領。\n" +
        "之後輸入「JLY 小助手」仍可開啟這台車的專屬功能選單。";

      await replyWithMessages(context.replyToken, [
        { type: "text", text: bindingReply },
        buildMemberWelcomeCard(bindResult.car || {}, {
          baseUrl: readPublicBaseUrl(),
          carId: bindResult.car && bindResult.car.id
        })
      ]);
    } else {
      await replyWithText(context.replyToken, bindingReply);
    }

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

  if (
    messageResult.action ===
    "assistant_reminder_enable"
  ) {
    if (!context.replyToken) {
      return {
        handled: false,
        route:
          "message_missing_reply_token",
        context,
        groupBinding
      };
    }

    if (
      context.source.type !== "group" ||
      !context.source.groupId ||
      !context.accountingCarId
    ) {
      await replyWithText(
        context.replyToken,
        "請先將這個 LINE 群組綁定 JLY 車團。"
      );

      return {
        handled: true,
        route:
          "assistant_reminder_binding_required",
        context,
        groupBinding
      };
    }

    let car = null;

    try {
      car =
        await readCar(
          context.accountingCarId
        );
    } catch (error) {
      console.error(
        "LINE reminder car lookup failed.",
        error
      );
    }

    if (!car) {
      await replyWithText(
        context.replyToken,
        "找不到這台 JLY 車團。"
      );

      return {
        handled: true,
        route:
          "assistant_reminder_car_not_found",
        context,
        groupBinding
      };
    }

    const reminderResult =
      await enableReminder(
        context.accountingCarId,
        car,
        dependencies
      );

    if (!reminderResult.enabled) {
      await replyWithText(
        context.replyToken,
        reminderResult.reason ===
          "car_date_required"
          ? "⚠️ 車團尚未設定日期，無法開啟行前通知。"
          : "行前通知開啟失敗，請稍後再試。"
      );

      return {
        handled: true,
        route:
          "assistant_reminder_enable_failed",
        context,
        groupBinding,
        reminderResult
      };
    }

    const existingTargetCount =
      Array.isArray(
        reminderResult &&
        reminderResult.reminder &&
        reminderResult.reminder
          .targetLineUserIds
      )
        ? reminderResult.reminder
            .targetLineUserIds.length
        : 0;

    const reminderLines = [
      reminderResult.alreadyEnabled
        ? "✅ 已重新開啟提醒名單設定"
        : "✅ 已開啟行前通知",
      "",
      "請直接 @ 需要提醒的車友。",
      "可以一次標記多人，JLY 會把這一批加入這台車的提醒名單。"
    ];

    if (existingTargetCount > 0) {
      reminderLines.push(
        "",
        "目前提醒名單：" +
          String(existingTargetCount) +
          " 人"
      );
    }

    if (
      reminderResult.reason ===
        "scheduled_time_passed"
    ) {
      reminderLines.push(
        "",
        "⚠️ 預設提醒時間已經過，請到車團頁面確認新的提醒時間。"
      );
    }

    await replyWithText(
      context.replyToken,
      reminderLines.join("\n")
    );

    return {
      handled: true,
      route:
        reminderResult.alreadyEnabled
          ? "assistant_reminder_already_enabled"
          : "assistant_reminder_enabled",
      context,
      groupBinding,
      reminderResult
    };
  }

  if (["assistant_store_info","assistant_time_info","assistant_people_info"].includes(messageResult.action)) {
    if (!context.replyToken) return { handled: false, route: "message_missing_reply_token", context, groupBinding };
    if (!context.accountingCarId) { await replyWithText(context.replyToken, "請先將這個 LINE 群組綁定 JLY 車團。");return { handled: true, route: "assistant_info_binding_required", context, groupBinding }; }
    const car = await readCar(context.accountingCarId),builders={assistant_store_info:buildStoreInfo,assistant_time_info:buildTimeInfo,assistant_people_info:buildPeopleInfo};
    await replyWithText(context.replyToken,builders[messageResult.action](car||{}));
    return { handled: true, route: messageResult.action, context, groupBinding };
  }

  if (messageResult.action === "accounting_quick_create") {
    if (!context.replyToken) return { handled: false, route: "message_missing_reply_token", context, groupBinding };
    if (context.source.type !== "group" || !context.source.groupId || !context.accountingCarId) {
      await replyWithText(context.replyToken, "請先在已綁定車團的 LINE 群組使用快速記帳。");
      return { handled: true, route: "accounting_binding_required", context, groupBinding };
    }
    const authority = await resolveAuthority(context, groupBinding);
    context.accountingActorMemberId = authority.playerId || "";
    context.accountingActorDisplayName = authority.playerDisplayName || "";
    const car = await readCar(context.accountingCarId);
    const prepared = await prepareQuickEntry(context, messageResult.accounting, car || {}, authority);
    if (prepared.reason === "payer_resolved") {
      const result = await saveResolvedQuickEntry(context, messageResult.accounting, prepared.payer, car || {}, authority);
      await replyWithText(
        context.replyToken,
        "✅ 已正式記帳\n" +
          `項目：${messageResult.accounting.title}\n` +
          `金額：$${messageResult.accounting.amount.toLocaleString("zh-TW")}\n` +
          `付款人：${prepared.payer.displayName || "本人"}\n` +
          "狀態：🟡 待分帳"
      );
      return { handled: true, route: "accounting_quick_created", context, groupBinding, accountingResult: result };
    }
    if (prepared.saved) {
      await replyWithText(
        context.replyToken,
        "🟡 已暫存，等待確認付款人\n" +
          `項目：${messageResult.accounting.title}\n` +
          `金額：$${messageResult.accounting.amount.toLocaleString("zh-TW")}\n` +
          "請由主揪到車團帳務的「待確認」處理。"
      );
      return { handled: true, route: "accounting_quick_pending", context, groupBinding, pendingResult: prepared };
    }
    await replyWithText(context.replyToken, prepared.reason === "identity_required" ? "請先完成 LINE 與 JLY Member 身分連結。" : "一般成員只能登記自己付款；請由主揪代為處理其他付款人。");
    return { handled: true, route: "accounting_quick_denied", context, groupBinding, pendingResult: prepared };
  }

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
    const entryCode = getEntryCode(
      accountingResult.entry && (
        accountingResult.entry.id ||
        accountingResult.entry.messageId
      )
    );

    await replyWithText(
      context.replyToken,
      "✅ 記帳成功\n" +
      `${typeLabel}：$${messageResult.accounting.amount.toLocaleString("zh-TW")}\n` +
      `說明：${messageResult.accounting.description}\n` +
      `帳目編號：${entryCode}`
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

      if (!authority.canViewAudit) {
        await replyWithText(
          context.replyToken,
          "完整帳目異動紀錄僅供系統管理者查詢。如有帳務問題，請聯絡系統管理者協助調閱。"
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
          lines.push("");
          lines.push(...buildAuditDetailLines(
            log,
            actorLabel,
            operationLabels
          ));
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

  if (
    messageResult.action === "assistant_called" &&
    context.source.type === "group"
  ) {
    let car = null;
    let reminderStatus = null;
    if (context.accountingCarId) {
      try {
        car = await readCar(context.accountingCarId);
        reminderStatus =
          await readReminderStatus(
            context.accountingCarId,
            car,
            dependencies
          );
      } catch (error) {
        console.error("LINE assistant car/reminder lookup failed.", error);
      }
    }
    const token = context.accountingCarId
      ? createAssistantToken({
          groupId: context.source.groupId,
          carId: context.accountingCarId
        })
      : "";
    await replyWithMessages(
      context.replyToken,
      [buildGroupAssistantCard(car, {
        token,
        baseUrl: readPublicBaseUrl(),
        carId: context.accountingCarId,
        reminder:
          reminderStatus &&
          reminderStatus.reminder
            ? reminderStatus.reminder
            : null
      })]
    );
  } else if (
    messageResult.action === "assistant_accounting_card" &&
    context.source.type === "group"
  ) {
    let car = null;
    if (context.accountingCarId) {
      try { car = await readCar(context.accountingCarId); } catch (error) {
        console.error("LINE accounting card car lookup failed.", error);
      }
    }
    const token=context.accountingCarId?createAssistantToken({groupId:context.source.groupId,carId:context.accountingCarId}):"";
    await replyWithMessages(context.replyToken, [buildAccountingMenuCard(car,{token,baseUrl:readPublicBaseUrl()})]);
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

async function handleMemberJoinedEvent(
  context,
  dependencies = {}
) {
  const resolveBinding =
    dependencies.resolveGroupBinding ||
    resolveGroupBinding;

  const readCar =
    dependencies.getCarById ||
    getCarById;

  const replyWithMessages =
    dependencies.sendReplyMessage ||
    sendReplyMessage;

  const readPublicBaseUrl =
    dependencies.getPublicBaseUrl ||
    getPublicBaseUrl;

  if (
    context.source.type !== "group" ||
    !context.source.groupId ||
    !context.replyToken
  ) {
    return {
      handled: false,
      route: "member_joined_unsupported_source",
      context
    };
  }

  let groupBinding = null;

  try {
    groupBinding =
      await resolveBinding(
        context.source.groupId
      );
  } catch (error) {
    console.error(
      "LINE member welcome binding lookup failed.",
      error
    );

    return {
      handled: false,
      route: "member_joined_binding_error",
      context
    };
  }

  if (
    !groupBinding ||
    groupBinding.bound !== true ||
    !groupBinding.binding ||
    !groupBinding.binding.carId
  ) {
    return {
      handled: false,
      route: "member_joined_unbound_group",
      context,
      groupBinding
    };
  }

  const carId =
    normalizeText(
      groupBinding.binding.carId
    );

  let car = null;

  try {
    car = await readCar(carId);
  } catch (error) {
    console.error(
      "LINE member welcome car lookup failed.",
      error
    );
  }

  if (!car) {
    return {
      handled: false,
      route: "member_joined_car_not_found",
      context,
      groupBinding
    };
  }

  await replyWithMessages(
    context.replyToken,
    [
      buildMemberWelcomeCard(
        car,
        {
          baseUrl:
            readPublicBaseUrl(),
          carId
        }
      )
    ]
  );

  return {
    handled: true,
    route: "member_joined_welcome",
    context,
    groupBinding,
    carId
  };
}

function shortenActorId(value) {
  const id = normalizeText(value);
  if (id.length <= 12) {
    return id || "未知使用者";
  }
  return `${id.slice(0, 5)}…${id.slice(-4)}`;
}

function formatAuditTime(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "時間不明";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatAuditEntry(entry) {
  if (!entry || typeof entry !== "object") return "內容不明";
  const typeLabel = entry.type === "income" ? "收入" : "支出";
  const amount = Number(entry.amount || 0).toLocaleString("zh-TW");
  const description = normalizeText(entry.description) || "未填說明";
  return `${typeLabel} $${amount} ${description}`;
}

function buildAuditDetailLines(log, actorLabel, operationLabels) {
  const lines = [
    `${formatAuditTime(log.createdAt)}｜${operationLabels[log.operation] || log.operation}｜${actorLabel}`,
    `帳目：${getEntryCode(log.entryId)}`
  ];
  if (log.operation === "update") {
    lines.push(`原本：${formatAuditEntry(log.before)}`);
    lines.push(`改為：${formatAuditEntry(log.after)}`);
  } else {
    lines.push(`內容：${formatAuditEntry(log.after || log.before)}`);
  }
  return lines;
}

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

    case "memberJoined":
      return handleMemberJoinedEvent(
        context,
        dependencies
      );

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

module.exports = {
  routeEvent,
  routeEvents,
  createEventContext
};
