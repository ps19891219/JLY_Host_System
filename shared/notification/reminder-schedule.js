/*
JLY Host System

Common Reminder Schedule Core V1

Pure reminder-time and reschedule rules shared by browser and server.
This module does not read Firestore and does not send LINE messages.
*/

(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.JLYReminderSchedule = api;
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const DEFAULT_SEND_TIME = "09:00";
    const DEFAULT_OFFSET_DAYS = 1;
    const DEFAULT_TIMEZONE = "Asia/Taipei";
    const TERMINAL_STATUSES = new Set([
      "已取消",
      "取消",
      "cancelled",
      "canceled",
      "已結束",
      "結束",
      "ended",
      "completed"
    ]);

    function text(value) {
      return String(value == null ? "" : value).trim();
    }

    function normalizeTime(value) {
      const source = text(value);
      return /^\d{2}:\d{2}$/.test(source)
        ? source
        : DEFAULT_SEND_TIME;
    }

    function normalizeOffsetDays(value) {
      const number = Number(value);
      return Number.isFinite(number)
        ? Math.max(0, Math.floor(number))
        : DEFAULT_OFFSET_DAYS;
    }

    function getActivityDate(activity) {
      const source = activity && typeof activity === "object"
        ? activity
        : {};
      return text(source.gameDate || source.date || source.startDate);
    }

    function isTerminalActivity(activity) {
      return TERMINAL_STATUSES.has(
        text(activity && activity.status).toLowerCase()
      );
    }

    function calculateScheduledAt(activity, config) {
      const settings = config && typeof config === "object"
        ? config
        : {};
      const gameDate = getActivityDate(activity);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
        return "";
      }

      const sendTime = normalizeTime(settings.sendTime);
      const offsetDays = normalizeOffsetDays(settings.offsetDays);

      /* V1 Activity timezone is fixed to Asia/Taipei (UTC+08:00). */
      const date = new Date(`${gameDate}T${sendTime}:00+08:00`);
      if (Number.isNaN(date.getTime())) {
        return "";
      }

      date.setTime(
        date.getTime() - offsetDays * 24 * 60 * 60 * 1000
      );
      return date.toISOString();
    }

    function buildRescheduleUpdate(previousActivity, nextActivity, reminder, nowIso) {
      const previous = previousActivity || {};
      const next = nextActivity || {};
      const currentReminder = reminder || null;
      const oldDate = getActivityDate(previous);
      const newDate = getActivityDate(next);
      const oldTime = text(previous.gameTime || previous.time);
      const newTime = text(next.gameTime || next.time);
      const oldStatus = text(previous.status);
      const newStatus = text(next.status);

      if (oldDate === newDate && oldTime === newTime && oldStatus === newStatus) {
        return { checked: false, rescheduled: false };
      }

      if (!currentReminder) {
        return {
          checked: true,
          rescheduled: false,
          reason: "reminder_not_found"
        };
      }

      if (currentReminder.enabled !== true) {
        return {
          checked: true,
          rescheduled: false,
          reason: "reminder_disabled"
        };
      }

      if (text(currentReminder.status) === "sent") {
        return {
          checked: true,
          rescheduled: false,
          reason: "already_sent",
          contentChanged: oldTime !== newTime || oldStatus !== newStatus
        };
      }

      const now = text(nowIso) || new Date().toISOString();

      if (isTerminalActivity(next)) {
        return {
          checked: true,
          rescheduled: true,
          schedulePassed: false,
          scheduledAt: "",
          updateData: {
            scheduledAt: "",
            status: "cancelled",
            needsHostAction: false,
            rescheduleReason: "activity_cancelled_or_ended",
            previousScheduledAt: text(currentReminder.scheduledAt),
            rescheduledAt: now,
            updatedAt: now,
            noticeType: "",
            noticeStatus: "suppressed"
          }
        };
      }

      if (oldDate === newDate) {
        return {
          checked: true,
          rescheduled: false,
          contentChanged: oldTime !== newTime || oldStatus !== newStatus,
          reason: "content_only"
        };
      }

      const scheduledAt = calculateScheduledAt(next, currentReminder);
      const schedulePassed = Boolean(scheduledAt && scheduledAt <= now);
      const updateData = {
        scheduledAt,
        status: !scheduledAt
          ? "configuration_required"
          : (schedulePassed ? "action_required" : "scheduled"),
        needsHostAction: schedulePassed,
        rescheduleReason: schedulePassed
          ? "scheduled_time_passed"
          : "activity_date_changed",
        previousScheduledAt: text(currentReminder.scheduledAt),
        rescheduledAt: now,
        updatedAt: now,
        noticeType: "",
        noticeStatus: "suppressed"
      };

      return {
        checked: true,
        rescheduled: true,
        schedulePassed,
        scheduledAt,
        previousScheduledAt: updateData.previousScheduledAt,
        updateData
      };
    }

    return {
      DEFAULT_SEND_TIME,
      DEFAULT_OFFSET_DAYS,
      DEFAULT_TIMEZONE,
      normalizeTime,
      normalizeOffsetDays,
      getActivityDate,
      isTerminalActivity,
      calculateScheduledAt,
      buildRescheduleUpdate
    };
  }
);
