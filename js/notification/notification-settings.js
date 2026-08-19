/*
JLY Host System

Module:
Notification Settings V1

Responsibilities:

1. Define reminder configuration defaults
2. Normalize reminder configuration
3. Calculate scheduled reminder time
4. Keep reminder rules configurable
5. Do not store duplicated Activity data
*/

(function () {
  "use strict";

  const DEFAULTS = {
    schemaVersion: 1,

    reminderType: "pre_trip",

    enabled: false,

    /*
     * V1:
     * days_before_at_time
     *
     * Future:
     * hours_before
     * custom_datetime
     * activity_start_relative
     */
    triggerType:
      "days_before_at_time",

    offsetDays: 1,

    sendTime: "15:00",

    timezone: "Asia/Taipei",

    templateId:
      "pre_trip_default_v1",

    customMessage:
      "大家明天見唷～～～請準時到場❤️\n" +
      "有問題請提前回報，感謝🙏",

    targetType:
      "line_group",

    scheduledAt: "",

    status: "disabled",

    sentAt: "",

    lastError: ""
  };


  function text(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }


  function normalizeTime(value) {
    const source =
      text(value);

    if (
      /^\d{2}:\d{2}$/.test(source)
    ) {
      return source;
    }

    return DEFAULTS.sendTime;
  }


  function normalizeOffsetDays(
    value
  ) {
    const number =
      Number(value);

    if (!Number.isFinite(number)) {
      return DEFAULTS.offsetDays;
    }

    return Math.max(
      0,
      Math.floor(number)
    );
  }


  function normalizeConfig(
    input
  ) {
    const source =
      input &&
      typeof input === "object"
        ? input
        : {};

    return {
      ...DEFAULTS,

      ...source,

      schemaVersion:
        Number(
          source.schemaVersion
        ) || 1,

      reminderType:
        text(
          source.reminderType
        ) ||
        DEFAULTS.reminderType,

      enabled:
        source.enabled === true,

      triggerType:
        text(
          source.triggerType
        ) ||
        DEFAULTS.triggerType,

      offsetDays:
        normalizeOffsetDays(
          source.offsetDays
        ),

      sendTime:
        normalizeTime(
          source.sendTime
        ),

      timezone:
        text(
          source.timezone
        ) ||
        DEFAULTS.timezone,

      templateId:
        text(
          source.templateId
        ) ||
        DEFAULTS.templateId,

      customMessage:
        text(
          source.customMessage
        ),

      targetType:
        text(
          source.targetType
        ) ||
        DEFAULTS.targetType,

      scheduledAt:
        text(
          source.scheduledAt
        ),

      status:
        text(
          source.status
        ) ||
        (
          source.enabled === true
            ? "scheduled"
            : "disabled"
        ),

      sentAt:
        text(
          source.sentAt
        ),

      lastError:
        text(
          source.lastError
        )
    };
  }


  function getCarDate(car) {
    const source =
      car &&
      typeof car === "object"
        ? car
        : {};

    return text(
      source.gameDate ||
      source.date ||
      source.startDate
    );
  }


  function calculateScheduledAt(
    car,
    config
  ) {
    const settings =
      normalizeConfig(
        config
      );

    const gameDate =
      getCarDate(car);

    if (!gameDate) {
      return "";
    }

    if (
      settings.triggerType !==
      "days_before_at_time"
    ) {
      return "";
    }

    /*
     * V1 Activity timezone:
     * Asia/Taipei = UTC+08:00
     *
     * Timezone remains stored separately
     * so this can later move to a generic
     * timezone-aware scheduler.
     */
    const source =
      `${gameDate}T${settings.sendTime}:00+08:00`;

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
        settings.offsetDays *
        24 *
        60 *
        60 *
        1000
      )
    );

    return date.toISOString();
  }


  function prepareForSave(
    car,
    input
  ) {
    const config =
      normalizeConfig(
        input
      );

    const scheduledAt =
      config.enabled
        ? calculateScheduledAt(
            car,
            config
          )
        : "";

    return {
      ...config,

      scheduledAt,

      status:
        config.enabled
          ? (
              scheduledAt
                ? "scheduled"
                : "configuration_required"
            )
          : "disabled"
    };
  }


  window.JLYNotificationSettings = {
    DEFAULTS,

    normalizeConfig,

    normalizeOffsetDays,

    calculateScheduledAt,

    prepareForSave
  };
})();
