/*
JLY Host System

Module:
Reminder Dispatch Service V1

Responsibilities:

1. Find due reminders
2. Claim each reminder atomically
3. Read latest Activity data
4. Resolve current LINE group binding
5. Build message at send time
6. Push LINE message
7. Mark reminder sent or retryable failure

Reminder data is not an Activity data copy.
*/

"use strict";

const {
  listDueReminders,
  claimReminder,
  markReminderSent,
  markReminderFailed
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


function normalizeText(value) {
  return String(
    value == null ? "" : value
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


async function dispatchOne(
  candidate,
  dependencies = {}
) {
  const claim =
    dependencies.claimReminder ||
    claimReminder;

  const readCar =
    dependencies.getCarById ||
    getCarById;

  const readBinding =
    dependencies.getActiveBindingByCarId ||
    getActiveBindingByCarId;

  const push =
    dependencies.sendTextPush ||
    sendTextPush;

  const markSent =
    dependencies.markReminderSent ||
    markReminderSent;

  const markFailed =
    dependencies.markReminderFailed ||
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
     * Message is built NOW from the latest Car.
     * Reminder documents do not hold copied Activity fields.
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

      carId:
        candidate.carId,

      reminderId:
        candidate.id,

      sentAt
    };

  } catch (error) {
    console.error(
      "Reminder dispatch failed.",
      {
        carId:
          candidate.carId,

        reminderId:
          candidate.id,

        error:
          error &&
          error.message
      }
    );

    await markFailed(
      candidate.carId,
      candidate.id,
      error &&
      error.message
        ? error.message
        : "unknown_error"
    );

    return {
      sent: false,

      skipped: false,

      carId:
        candidate.carId,

      reminderId:
        candidate.id,

      error:
        error &&
        error.message
          ? error.message
          : "unknown_error"
    };
  }
}


async function dispatchDueReminders(
  options = {}
) {
  const readDue =
    options.listDueReminders ||
    listDueReminders;

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

  const candidates =
    await readDue(
      now,
      limit
    );

  const results = [];

  /*
   * Sequential dispatch keeps V1 predictable
   * and avoids suddenly flooding LINE API.
   */
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

  return {
    checkedAt:
      now,

    candidateCount:
      candidates.length,

    sentCount:
      results.filter(
        item => item.sent
      ).length,

    skippedCount:
      results.filter(
        item => item.skipped
      ).length,

    failedCount:
      results.filter(
        item =>
          !item.sent &&
          !item.skipped
      ).length,

    results
  };
}


module.exports = {
  buildReminderMessage,
  dispatchOne,
  dispatchDueReminders
};