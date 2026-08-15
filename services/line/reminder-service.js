/*
JLY Host System

Module:
LINE Reminder Service V1

Responsibilities:

1. Read reminder configuration
2. Build reminder status for LINE group
3. Keep Reminder and Activity data separated
4. Do not send scheduled Push messages

V1 Stage 2A:
Read-only reminder status.
*/

"use strict";

const {
  getPreTripReminder
} = require(
  "../firebase/reminder-repository"
);


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


function formatScheduledAt(
  value
) {
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


function buildReminderStatusText(
  result
) {
  const source =
    result &&
    typeof result === "object"
      ? result
      : {};

  const title =
    normalizeText(
      source.carTitle
    ) || "JLY 車團";

  if (
    !source.configured ||
    !source.enabled
  ) {
    return (
      `⏰《${title}》行前提醒\n\n` +
      "⚪ 已關閉"
    );
  }

  return (
    `⏰《${title}》行前提醒\n\n` +
    "🟢 已綁定"
  );

  const scheduledAt =
    formatScheduledAt(
      reminder.scheduledAt
    );

  const offsetDays =
    Number(
      reminder.offsetDays
    );

  const sendTime =
    normalizeText(
      reminder.sendTime
    );

  const customMessage =
    normalizeText(
      reminder.customMessage
    );

  const status =
    normalizeText(
      reminder.status
    );

  const lines = [
    `⏰ 《${title}》行前提醒`,
    "",
    "狀態：🟢 已開啟"
  ];

  if (
    Number.isFinite(offsetDays)
  ) {
    lines.push(
      offsetDays === 0
        ? "提醒時間：活動當天"
        : `提前：${offsetDays} 天`
    );
  }

  if (sendTime) {
    lines.push(
      `發送時間：${sendTime}`
    );
  }

  if (scheduledAt) {
    lines.push(
      `預計發送：${scheduledAt}`
    );
  }

  if (
    status ===
    "configuration_required"
  ) {
    lines.push(
      "⚠️ 尚無法計算正式發送時間，請確認車團日期。"
    );
  }

  if (customMessage) {
    lines.push(
      "",
      "補充內容：",
      customMessage
    );
  }

  lines.push(
    "",
    "實際發送時會讀取最新車團資料。"
  );

  return lines.join("\n");
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
  getReminderStatus,
  buildReminderStatusText,
  buildGroupReminderReply,
  formatScheduledAt
};