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
  enablePreTripReminder: saveEnabledPreTripReminder
} = require(
  "../firebase/reminder-repository"
);

const DEFAULT_SEND_TIME =
  "15:00";

const DEFAULT_OFFSET_DAYS =
  1;

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
  const gameDate =
    getCarDate(car);

  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(gameDate)
  ) {
    return "";
  }

  const sendTime =
    normalizeText(
      options.sendTime
    ) || DEFAULT_SEND_TIME;

  if (
    !/^\d{2}:\d{2}$/
      .test(sendTime)
  ) {
    return "";
  }

  const offsetDays =
    Number.isFinite(
      Number(
        options.offsetDays
      )
    )
      ? Math.max(
          0,
          Math.floor(
            Number(
              options.offsetDays
            )
          )
        )
      : DEFAULT_OFFSET_DAYS;

  const source =
    `${gameDate}T${sendTime}:00+08:00`;

  const date =
    new Date(source);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  date.setTime(
    date.getTime() -
    (
      offsetDays *
      24 *
      60 *
      60 *
      1000
    )
  );

  return date.toISOString();
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
    return {
      enabled: true,
      alreadyEnabled: true,
      reminder: existing
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
          "Asia/Taipei",
        templateId:
          "pre_trip_default_v1",
        customMessage:
          DEFAULT_CUSTOM_MESSAGE,
        targetType:
          "line_group",
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
  buildReminderStatusText,
  buildGroupReminderReply,

  calculateScheduledAt,
  formatScheduledAt
};
