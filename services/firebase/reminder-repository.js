/*
JLY Host System

Module:
Reminder Repository V1.1

Responsibilities:

1. Read Activity reminder configuration
2. Find reminders that are due
3. Claim reminders before dispatch
4. Record sent / failed state
5. Prevent duplicate dispatch
6. Keep Firestore logic outside LINE services

Firestore:

cars/{carId}/reminders/preTrip
*/

"use strict";

const {
  getFirestore
} = require("./admin");

const REMINDER_COLLECTION =
  "reminders";

const PRE_TRIP_DOCUMENT =
  "preTrip";


function normalizeText(value) {
  return String(
    value == null ? "" : value
  ).trim();
}


function getReminderRef(
  carId,
  reminderId = PRE_TRIP_DOCUMENT
) {
  const normalizedCarId =
    normalizeText(carId);

  const normalizedReminderId =
    normalizeText(reminderId);

  if (!normalizedCarId) {
    throw new Error(
      "carId is required."
    );
  }

  if (!normalizedReminderId) {
    throw new Error(
      "reminderId is required."
    );
  }

  return getFirestore()
    .collection("cars")
    .doc(normalizedCarId)
    .collection(
      REMINDER_COLLECTION
    )
    .doc(
      normalizedReminderId
    );
}


async function getReminder(
  carId,
  reminderId = PRE_TRIP_DOCUMENT
) {
  const snapshot =
    await getReminderRef(
      carId,
      reminderId
    ).get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id:
      snapshot.id,

    carId:
      snapshot.ref
        .parent
        .parent
        .id,

    ...snapshot.data()
  };
}


async function getPreTripReminder(
  carId
) {
  return getReminder(
    carId,
    PRE_TRIP_DOCUMENT
  );
}


// ============================================================
// Find Due Reminders
// ============================================================

async function listDueReminders(
  nowIso,
  limit = 30
) {
  const db =
    getFirestore();

  const normalizedNow =
    normalizeText(
      nowIso
    ) ||
    new Date()
      .toISOString();

  /*
   * scheduledAt is stored as canonical ISO UTC text.
   * ISO timestamps of this format sort chronologically.
   *
   * Only scheduledAt is queried so V1 does not require
   * a compound Firestore index.
   */
  const snapshot =
    await db
      .collectionGroup(
        REMINDER_COLLECTION
      )
      .where(
        "scheduledAt",
        "<=",
        normalizedNow
      )
      .limit(
        Math.max(
          1,
          Number(limit) || 30
        )
      )
      .get();

  return snapshot.docs
    .map(
      function (doc) {
        const parentCar =
          doc.ref &&
          doc.ref.parent &&
          doc.ref.parent.parent;

        return {
          id:
            doc.id,

          carId:
            parentCar
              ? parentCar.id
              : "",

          ...doc.data()
        };
      }
    )
    .filter(
      function (item) {
        return (
          item.id ===
            PRE_TRIP_DOCUMENT &&
          item.enabled === true &&
          normalizeText(
            item.status
          ) === "scheduled" &&
          Boolean(
            normalizeText(
              item.carId
            )
          )
        );
      }
    );
}


// ============================================================
// Claim Reminder
// ============================================================

async function claimReminder(
  carId,
  reminderId,
  nowIso
) {
  const db =
    getFirestore();

  const ref =
    getReminderRef(
      carId,
      reminderId
    );

  const now =
    normalizeText(
      nowIso
    ) ||
    new Date()
      .toISOString();

  return db.runTransaction(
    async function (
      transaction
    ) {
      const snapshot =
        await transaction.get(
          ref
        );

      if (!snapshot.exists) {
        return {
          claimed: false,
          reason:
            "not_found"
        };
      }

      const data =
        snapshot.data() || {};

      const scheduledAt =
        normalizeText(
          data.scheduledAt
        );

      if (
        data.enabled !== true ||
        normalizeText(
          data.status
        ) !== "scheduled"
      ) {
        return {
          claimed: false,
          reason:
            "not_scheduled"
        };
      }

      if (
        !scheduledAt ||
        scheduledAt > now
      ) {
        return {
          claimed: false,
          reason:
            "not_due"
        };
      }

      transaction.set(
        ref,
        {
          status:
            "sending",

          dispatchStartedAt:
            now,

          updatedAt:
            now
        },
        {
          merge: true
        }
      );

      return {
        claimed: true,

        reminder: {
          id:
            snapshot.id,

          carId:
            normalizeText(
              carId
            ),

          ...data,

          status:
            "sending",

          dispatchStartedAt:
            now
        }
      };
    }
  );
}


// ============================================================
// Mark Sent
// ============================================================

async function markReminderSent(
  carId,
  reminderId,
  sentAt
) {
  const now =
    normalizeText(
      sentAt
    ) ||
    new Date()
      .toISOString();

  await getReminderRef(
    carId,
    reminderId
  ).set(
    {
      status:
        "sent",

      sentAt:
        now,

      lastAttemptAt:
        now,

      lastError:
        "",

      updatedAt:
        now
    },
    {
      merge: true
    }
  );

  return {
    sent: true,
    sentAt:
      now
  };
}


// ============================================================
// Return Failed Reminder To Queue
// ============================================================

async function markReminderFailed(
  carId,
  reminderId,
  errorMessage
) {
  const db =
    getFirestore();

  const ref =
    getReminderRef(
      carId,
      reminderId
    );

  const now =
    new Date()
      .toISOString();

  return db.runTransaction(
    async function (
      transaction
    ) {
      const snapshot =
        await transaction.get(
          ref
        );

      if (!snapshot.exists) {
        return {
          saved: false
        };
      }

      const data =
        snapshot.data() || {};

      const retryCount =
        Number(
          data.retryCount || 0
        ) + 1;

      transaction.set(
        ref,
        {
          status:
            "scheduled",

          retryCount,

          lastAttemptAt:
            now,

          lastError:
            normalizeText(
              errorMessage
            ).slice(
              0,
              500
            ),

          updatedAt:
            now
        },
        {
          merge: true
        }
      );

      return {
        saved: true,
        retryCount
      };
    }
  );
}


module.exports = {
  REMINDER_COLLECTION,
  PRE_TRIP_DOCUMENT,

  getReminderRef,
  getReminder,
  getPreTripReminder,

  listDueReminders,
  claimReminder,
  markReminderSent,
  markReminderFailed
};