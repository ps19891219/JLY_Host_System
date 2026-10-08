/*
JLY Host System

Module:
LINE Reminder Service V1.2

Responsibilities:

1. Read pre-trip reminder configuration
2. Enable a reminder from a bound LINE group
3. Calculate the default schedule from current Car gameDate
4. Keep Reminder and Activity data separated
5. Do not send scheduled Push messages
*/

"use strict";

const {
  getPreTripReminder,
  enablePreTripReminder: saveEnabledPreTripReminder,
  setPreTripReminderTargetCapture,
  addPreTripReminderTargets
} = require(
  "../firebase/reminder-repository"
);

const reminderSchedule =
  require(
    "../../shared/notification/reminder-schedule"
  );

const DEFAULT_SEND_TIME =
  reminderSchedule.DEFAULT_SEND_TIME;

const DEFAULT_OFFSET_DAYS =
  reminderSchedule.DEFAULT_OFFSET_DAYS;

const DEFAULT_CUSTOM_MESSAGE =
  "大家明天見唷～～～請準時到場❤️\n" +
  "有問題請提前回報，感謝🙏";


function normalizeText(value) {
  return String(
    value == null
      ? ""
      : value
  ).trim();
}


function getCarTitle(car) {
  return normalizeText(
    car &&
    (
      car.scriptName ||
      car.title ||
      car.name
    )
  ) || "JLY 車團";
}


function getCarDate(car) {
  return normalizeText(
    car &&
    (
      car.gameDate ||
      car.date ||
      car.startDate
    )
  );
}


function calculateScheduledAt(
  car,
  options = {}
) {
  return reminderSchedule
    .calculateScheduledAt(
      car,
      options
    );
}


function formatScheduledAt(value) {
  const source =
    normalizeText(value);

  if (!source) {
    return "";
  }

  const date =
    new Date(source);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "zh-TW",
    {
      timeZone:
        "Asia/Taipei",
      year:
        "numeric",
      month:
        "2-digit",
      day:
        "2-digit",
      hour:
        "2-digit",
      minute:
        "2-digit",
      hour12:
        false
    }
  ).format(date);
}


async function getReminderStatus(
  carId,
  car,
  dependencies = {}
) {
  const readReminder =
    dependencies.getPreTripReminder ||
    getPreTripReminder;

  const reminder =
    await readReminder(
      carId
    );

  return {
    carId:
      normalizeText(carId),

    carTitle:
      getCarTitle(car),

    configured:
      Boolean(reminder),

    enabled:
      Boolean(
        reminder &&
        reminder.enabled === true
      ),

    reminder:
      reminder || null
  };
}


async function enableGroupPreTripReminder(
  carId,
  car,
  dependencies = {}
) {
  const readReminder =
    dependencies.getPreTripReminder ||
    getPreTripReminder;

  const saveReminder =
    dependencies.enablePreTripReminder ||
    saveEnabledPreTripReminder;

  const existing =
    await readReminder(
      carId
    );

  if (
    existing &&
    existing.enabled === true
  ) {
    const openTargetCapture =
      dependencies.setPreTripReminderTargetCapture ||
      setPreTripReminderTargetCapture;

    await openTargetCapture(
      carId,
      true
    );

    return {
      enabled: true,
      alreadyEnabled: true,
      targetCaptureOpen: true,
      reminder: {
        ...existing,
        targetCaptureOpen: true
      }
    };
  }

  const scheduledAt =
    calculateScheduledAt(
      car,
      {
        offsetDays:
          DEFAULT_OFFSET_DAYS,
        sendTime:
          DEFAULT_SEND_TIME
      }
    );

  if (!scheduledAt) {
    return {
      enabled: false,
      alreadyEnabled: false,
      reason:
        "car_date_required",
      reminder: null
    };
  }

  const now =
    new Date()
      .toISOString();

  const schedulePassed =
    scheduledAt <= now;

  const saved =
    await saveReminder(
      carId,
      {
        schemaVersion: 1,
        reminderType:
          "pre_trip",
        triggerType:
          "days_before_at_time",
        offsetDays:
          DEFAULT_OFFSET_DAYS,
        sendTime:
          DEFAULT_SEND_TIME,
        timezone:
          reminderSchedule.DEFAULT_TIMEZONE,
        templateId:
          "pre_trip_default_v1",
        customMessage:
          DEFAULT_CUSTOM_MESSAGE,
        targetType:
          "line_group",
        targetLineUserIds: [],
        targetCaptureOpen: true,
        scheduledAt,
        status:
          schedulePassed
            ? "action_required"
            : "scheduled",
        openedFrom:
          "line_group"
      }
    );

  return {
    ...saved,
    reason:
      schedulePassed
        ? "scheduled_time_passed"
        : "enabled",
    scheduledAt
  };
}


function normalizeReminderMentions(
  mentions
) {
  const source =
    Array.isArray(mentions)
      ? mentions
      : [];

  const userIds = [];
  const seen = new Set();
  let unavailableCount = 0;
  let hasAllMention = false;

  for (const mention of source) {
    const item =
      mention &&
      typeof mention === "object"
        ? mention
        : {};

    if (normalizeText(item.type) === "all") {
      hasAllMention = true;
      continue;
    }

    if (
      normalizeText(item.type) !== "user" ||
      item.isSelf === true
    ) {
      continue;
    }

    const userId =
      normalizeText(
        item.userId
      );

    if (!userId) {
      unavailableCount += 1;
      continue;
    }

    if (!seen.has(userId)) {
      seen.add(userId);
      userIds.push(userId);
    }
  }

  return {
    userIds,
    unavailableCount,
    hasAllMention
  };
}

async function captureGroupReminderTargets(
  carId,
  mentions,
  dependencies = {}
) {
  const normalized =
    normalizeReminderMentions(
      mentions
    );

  if (normalized.hasAllMention) {
    return {
      captured: false,
      reason: "mention_all_not_supported",
      unavailableCount:
        normalized.unavailableCount
    };
  }

  const saveTargets =
    dependencies.addPreTripReminderTargets ||
    addPreTripReminderTargets;

  const result =
    await saveTargets(
      carId,
      normalized.userIds
    );

  return {
    ...result,
    unavailableCount:
      normalized.unavailableCount
  };
}


/**
 * A bound LINE "新增男位/女位 @..." roster command also opts its mentioned
 * players into the EXISTING pre-trip reminder. The reminder opens first,
 * then the same userIds are appended by the existing bounded target API.
 */
async function syncRosterReminderTargets(carId, car, mentions, dependencies = {}) {
  const normalized = normalizeReminderMentions(mentions);
  if (normalized.hasAllMention) {
    return { captured: false, reason: "mention_all_not_supported" };
  }
  if (!normalized.userIds.length) {
    return { captured: false, reason: "mention_user_id_unavailable" };
  }
  const enable = dependencies.enableGroupPreTripReminder || enableGroupPreTripReminder;
  const capture = dependencies.captureGroupReminderTargets || captureGroupReminderTargets;
  const enabled = await enable(carId, car, dependencies);
  if (!enabled.enabled) return { captured: false, reason: enabled.reason || "reminder_not_enabled" };
  const saved = await capture(carId, mentions, dependencies);
  return {
    ...saved,
    enabled: true,
    alreadyEnabled: Boolean(enabled.alreadyEnabled),
    scheduledAt: enabled.scheduledAt || (enabled.reminder && enabled.reminder.scheduledAt) || "",
    status: (enabled.reminder && enabled.reminder.status) || ""
  };
}

/**
 * On-demand, read-only LINE pre-trip reminder status. The report never
 * discloses LINE user IDs and never claims guaranteed delivery.
 */
function buildReminderStatusReport(result, options = {}) {
  const state = result && typeof result === "object" ? result : {};
  const reminder = state.reminder && typeof state.reminder === "object"
    ? state.reminder : null;

  if (!state.configured || !state.enabled || !reminder) {
    return [
      "⚪ 本場行前通知尚未開啟",
      "",
      "舊車團不會因新功能上線而自動補開。",
      "如需啟用請輸入「開啟行前通知」，",
      "之後再 @ 需要提醒的車友。"
    ].join("\n");
  }

  const reminderStatus = normalizeText(reminder.status);
  const targets = Array.isArray(reminder.targetLineUserIds)
    ? reminder.targetLineUserIds : [];
  const count = new Set(targets.map(normalizeText).filter(Boolean)).size;
  const now = options.now instanceof Date ? options.now : new Date();

  const labels = {
    scheduled: "🟢 已排程，等待發送",
    sending: "🟡 發送處理中",
    sent: "✅ 已提交 LINE 發送",
    failed: "⚠️ 發送失敗，需要處理",
    action_required: "⚠️ 預設提醒時間已過，需要調整",
    cancelled: "⚪ 已取消",
    canceled: "⚪ 已取消"
  };
  const lines = ["🔔 本場行前通知狀態", labels[reminderStatus] || "🟡 已啟用，狀態待確認"];
  const scheduledAt = normalizeText(reminder.scheduledAt);
  if (scheduledAt) {
    const formatted = formatScheduledAt(scheduledAt);
    lines.push("預定提醒：" + (formatted || scheduledAt) + "（台灣時間）");
    const due = new Date(scheduledAt);
    if (reminderStatus === "scheduled" && !Number.isNaN(due.getTime()) && due <= now) {
      lines.push("⚠️ 已超過預定時間，請確認發送排程。");
    }
  } else {
    lines.push("⚠️ 尚未設定有效提醒時間。");
  }
  lines.push("指定 @提醒對象：" + String(count) + " 人");
  if (count === 0) {
    lines.push("尚無個別 @名單；系統仍可能發送一般群組提醒。");
  }
  if (reminderStatus === "sent" && reminder.sentAt) {
    lines.push("提交發送：" + (formatScheduledAt(reminder.sentAt) || normalizeText(reminder.sentAt)));
  }
  lines.push("", "此處顯示系統記錄，實際送達仍以 LINE 結果為準。");
  return lines.join("\n");
}

function buildReminderStatusText(
  result
) {
  const source =
    result &&
    typeof result === "object"
      ? result
      : {};

  if (
    !source.configured ||
    !source.enabled
  ) {
    return "⚪ 行前通知尚未開啟";
  }

  if (
    source.reminder &&
    normalizeText(
      source.reminder.status
    ) === "sent"
  ) {
    return "✅ 行前通知已發送";
  }

  return "✅ 已開啟行前通知";
}


async function buildGroupReminderReply(
  carId,
  car,
  dependencies = {}
) {
  const result =
    await getReminderStatus(
      carId,
      car,
      dependencies
    );

  return {
    ...result,
    replyText:
      buildReminderStatusText(
        result
      )
  };
}


module.exports = {
  DEFAULT_SEND_TIME,
  DEFAULT_OFFSET_DAYS,
  DEFAULT_CUSTOM_MESSAGE,

  getReminderStatus,
  enableGroupPreTripReminder,
  captureGroupReminderTargets,
  syncRosterReminderTargets,
  normalizeReminderMentions,
  buildReminderStatusText,
  buildReminderStatusReport,
  buildGroupReminderReply,

  calculateScheduledAt,
  formatScheduledAt
};
