/*
JLY Host System

Module:
Reminder Dispatch Service V1.1

Responsibilities:

1. Dispatch reminder status notices
2. Dispatch due pre-trip reminders
3. Claim work before sending
4. Read latest Activity data
5. Resolve current LINE group binding
6. Send LINE Push messages
7. Record sent / failed state
8. Avoid duplicate dispatch

Reminder Core is independent from Scheduler provider.
*/

"use strict";

const {
  listDueReminders,
  claimReminder,
  markReminderSent,
  markReminderFailed,

  listPendingReminderNotices,
  claimReminderNotice,
  markReminderNoticeSent,
  markReminderNoticeFailed
} = require(
  "../firebase/reminder-repository"
);

const {
  getActiveBindingByCarId
} = require(
  "../firebase/line-group-binding-repository"
);

const {
  getCarById
} = require(
  "../firebase/line-accounting-authorization-repository"
);

const {
  sendTextPush
} = require(
  "./line-push"
);


// ============================================================
// Utilities
// ============================================================

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


function getCarTime(car) {
  return normalizeText(
    car &&
    (
      car.gameTime ||
      car.time ||
      car.startTime
    )
  );
}


function getStudio(car) {
  return normalizeText(
    car &&
    (
      car.studioName ||
      car.studio ||
      car.storeName
    )
  );
}


function getLocation(car) {
  return normalizeText(
    car &&
    (
      car.location ||
      car.address
    )
  );
}


// ============================================================
// Build Main Reminder Message
// ============================================================

function buildReminderMessage(
  car,
  reminder
) {
  const lines = [
    "🐻 JLY 行前提醒",
    "",
    `《${getCarTitle(car)}》`
  ];

  const date =
    getCarDate(car);

  const time =
    getCarTime(car);

  const studio =
    getStudio(car);

  const location =
    getLocation(car);

  if (date) {
    lines.push(
      `📅 日期：${date}`
    );
  }

  if (time) {
    lines.push(
      `⏰ 時間：${time}`
    );
  }

  if (studio) {
    lines.push(
      `🏠 工作室：${studio}`
    );
  }

  if (location) {
    lines.push(
      `📍 地點：${location}`
    );
  }

  const customMessage =
    normalizeText(
      reminder &&
      reminder.customMessage
    );

  if (customMessage) {
    lines.push(
      "",
      customMessage
    );
  }

  return lines.join("\n");
}


// ============================================================
// Build Reminder Status Notice
// ============================================================

function buildReminderNoticeMessage(
  car,
  reminder
) {
  const title =
    getCarTitle(car);

  const noticeType =
    normalizeText(
      reminder &&
      reminder.noticeType
    );

  if (
    noticeType ===
    "disabled"
  ) {
    return (
      `⏰《${title}》行前提醒\n\n` +
      "⚪ 已關閉"
    );
  }

  return (
    `⏰《${title}》行前提醒\n\n` +
    "🟢 已綁定\n" +
    "JLY 小助手會依照設定自動發送行前提醒。"
  );
}


// ============================================================
// Dispatch Reminder Status Notice
// ============================================================

async function dispatchReminderNotice(
  candidate,
  dependencies = {}
) {
  const claim =
    dependencies
      .claimReminderNotice ||
    claimReminderNotice;

  const readCar =
    dependencies
      .getCarById ||
    getCarById;

  const readBinding =
    dependencies
      .getActiveBindingByCarId ||
    getActiveBindingByCarId;

  const push =
    dependencies
      .sendTextPush ||
    sendTextPush;

  const markSent =
    dependencies
      .markReminderNoticeSent ||
    markReminderNoticeSent;

  const markFailed =
    dependencies
      .markReminderNoticeFailed ||
    markReminderNoticeFailed;

  const claimed =
    await claim(
      candidate.carId,
      candidate.id
    );

  if (!claimed.claimed) {
    return {
      sent: false,
      skipped: true,
      reason:
        claimed.reason
    };
  }

  try {
    const car =
      await readCar(
        candidate.carId
      );

    if (!car) {
      throw new Error(
        "car_not_found"
      );
    }

    const binding =
      await readBinding(
        candidate.carId
      );

    /*
     * No LINE group:
     * mark status notice as handled.
     * This avoids endless retries.
     */
    if (
      !binding ||
      normalizeText(
        binding.status
      ) !== "active" ||
      !normalizeText(
        binding.groupId
      )
    ) {
      await markSent(
        candidate.carId,
        candidate.id
      );

      return {
        sent: false,
        skipped: true,
        reason:
          "no_active_line_group"
      };
    }

    const message =
      buildReminderNoticeMessage(
        car,
        claimed.reminder
      );

    await push(
      binding.groupId,
      message
    );

    await markSent(
      candidate.carId,
      candidate.id
    );

    return {
      sent: true,

      skipped: false,

      type:
        "reminder_status_notice",

      carId:
        candidate.carId,

      reminderId:
        candidate.id
    };

  } catch (error) {
    const errorMessage =
      error &&
      error.message
        ? error.message
        : "unknown_error";

    console.error(
      "Reminder notice dispatch failed.",
      {
        carId:
          candidate.carId,

        reminderId:
          candidate.id,

        error:
          errorMessage
      }
    );

    await markFailed(
      candidate.carId,
      candidate.id,
      errorMessage
    );

    return {
      sent: false,
      skipped: false,

      carId:
        candidate.carId,

      reminderId:
        candidate.id,

      error:
        errorMessage
    };
  }
}


// ============================================================
// Dispatch One Main Reminder
// ============================================================

async function dispatchOne(
  candidate,
  dependencies = {}
) {
  const claim =
    dependencies
      .claimReminder ||
    claimReminder;

  const readCar =
    dependencies
      .getCarById ||
    getCarById;

  const readBinding =
    dependencies
      .getActiveBindingByCarId ||
    getActiveBindingByCarId;

  const push =
    dependencies
      .sendTextPush ||
    sendTextPush;

  const markSent =
    dependencies
      .markReminderSent ||
    markReminderSent;

  const markFailed =
    dependencies
      .markReminderFailed ||
    markReminderFailed;

  const now =
    new Date()
      .toISOString();

  const claimed =
    await claim(
      candidate.carId,
      candidate.id,
      now
    );

  if (!claimed.claimed) {
    return {
      sent: false,
      skipped: true,
      reason:
        claimed.reason
    };
  }

  const reminder =
    claimed.reminder;

  try {
    const car =
      await readCar(
        candidate.carId
      );

    if (!car) {
      throw new Error(
        "car_not_found"
      );
    }

    const binding =
      await readBinding(
        candidate.carId
      );

    if (
      !binding ||
      normalizeText(
        binding.status
      ) !== "active" ||
      !normalizeText(
        binding.groupId
      )
    ) {
      throw new Error(
        "active_line_group_binding_not_found"
      );
    }

    /*
     * Build message from CURRENT Car data.
     * Reminder document does not duplicate Activity fields.
     */
    const message =
      buildReminderMessage(
        car,
        reminder
      );

    await push(
      binding.groupId,
      message
    );

    const sentAt =
      new Date()
        .toISOString();

    await markSent(
      candidate.carId,
      candidate.id,
      sentAt
    );

    return {
      sent: true,
      skipped: false,

      carId:
        candidate.carId,

      reminderId:
        candidate.id,

      sentAt
    };

  } catch (error) {
    const errorMessage =
      error &&
      error.message
        ? error.message
        : "unknown_error";

    console.error(
      "Reminder dispatch failed.",
      {
        carId:
          candidate.carId,

        reminderId:
          candidate.id,

        error:
          errorMessage
      }
    );

    await markFailed(
      candidate.carId,
      candidate.id,
      errorMessage
    );

    return {
      sent: false,
      skipped: false,

      carId:
        candidate.carId,

      reminderId:
        candidate.id,

      error:
        errorMessage
    };
  }
}


// ============================================================
// Dispatch Due Reminders
// ============================================================

async function dispatchDueReminders(
  options = {}
) {
  const now =
    new Date()
      .toISOString();

  const limit =
    Math.max(
      1,
      Math.min(
        50,
        Number(
          options.limit || 30
        )
      )
    );


  // ----------------------------------------------------------
  // 1. Status Notices
  // ----------------------------------------------------------

  const readPendingNotices =
    options
      .listPendingReminderNotices ||
    listPendingReminderNotices;

  const noticeCandidates =
    await readPendingNotices(
      limit
    );

  const noticeResults = [];

  for (
    const candidate
    of noticeCandidates
  ) {
    noticeResults.push(
      await dispatchReminderNotice(
        candidate,
        options
      )
    );
  }


  // ----------------------------------------------------------
  // 2. Due Main Reminders
  // ----------------------------------------------------------

  const readDue =
    options
      .listDueReminders ||
    listDueReminders;

  const candidates =
    await readDue(
      now,
      limit
    );

  const results = [];

  for (
    const candidate
    of candidates
  ) {
    results.push(
      await dispatchOne(
        candidate,
        options
      )
    );
  }


  // ----------------------------------------------------------
  // Summary
  // ----------------------------------------------------------

  return {
    checkedAt:
      now,

    noticeCandidateCount:
      noticeCandidates.length,

    noticeSentCount:
      noticeResults.filter(
        function (item) {
          return item.sent;
        }
      ).length,

    noticeSkippedCount:
      noticeResults.filter(
        function (item) {
          return item.skipped;
        }
      ).length,

    noticeFailedCount:
      noticeResults.filter(
        function (item) {
          return (
            !item.sent &&
            !item.skipped
          );
        }
      ).length,

    noticeResults,

    candidateCount:
      candidates.length,

    sentCount:
      results.filter(
        function (item) {
          return item.sent;
        }
      ).length,

    skippedCount:
      results.filter(
        function (item) {
          return item.skipped;
        }
      ).length,

    failedCount:
      results.filter(
        function (item) {
          return (
            !item.sent &&
            !item.skipped
          );
        }
      ).length,

    results
  };
}


// ============================================================
// Exports
// ============================================================

module.exports = {
  buildReminderMessage,
  buildReminderNoticeMessage,

  dispatchReminderNotice,
  dispatchOne,
  dispatchDueReminders
};