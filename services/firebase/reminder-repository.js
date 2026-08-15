/*
JLY Host System

Module:
Reminder Repository V1.2

Responsibilities:

1. Read Activity reminder configuration
2. Find reminders that are due
3. Claim reminders before dispatch
4. Record reminder sent / failed state
5. Handle reminder status notices
6. Prevent duplicate dispatch
7. Keep Firestore logic outside LINE services

Firestore:

cars/{carId}/reminders/preTrip
*/

"use strict";

const {
  getFirestore
} = require(
  "./admin"
);

const REMINDER_COLLECTION =
  "reminders";

const PRE_TRIP_DOCUMENT =
  "preTrip";


// ============================================================
// Normalize Text
// ============================================================

function normalizeText(value) {
  return String(
    value == null
      ? ""
      : value
  ).trim();
}


// ============================================================
// Reminder Ref
// ============================================================

function getReminderRef(
  carId,
  reminderId = PRE_TRIP_DOCUMENT
) {
  const normalizedCarId =
    normalizeText(
      carId
    );

  const normalizedReminderId =
    normalizeText(
      reminderId
    );

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


// ============================================================
// Get Reminder
// ============================================================

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
      normalizeText(
        carId
      ),

    ...snapshot.data()
  };
}


// ============================================================
// Get Pre-Trip Reminder
// ============================================================

async function getPreTripReminder(
  carId
) {
  return getReminder(
    carId,
    PRE_TRIP_DOCUMENT
  );
}


// ============================================================
// List Due Reminders
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

  const safeLimit =
    Math.max(
      1,
      Math.min(
        50,
        Number(limit) || 30
      )
    );

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
        safeLimit
      )
      .get();

  return snapshot.docs
    .map(
      function (doc) {
        const carRef =
          doc.ref &&
          doc.ref.parent &&
          doc.ref.parent.parent;

        return {
          id:
            doc.id,

          carId:
            carRef
              ? carRef.id
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
// Mark Reminder Sent
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
// Mark Reminder Failed
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


// ============================================================
// List Pending Reminder Notices
// ============================================================

async function listPendingReminderNotices(
  limit = 30
) {
  const db =
    getFirestore();

  const safeLimit =
    Math.max(
      1,
      Math.min(
        50,
        Number(limit) || 30
      )
    );

  const snapshot =
    await db
      .collectionGroup(
        REMINDER_COLLECTION
      )
      .where(
        "noticeStatus",
        "==",
        "pending"
      )
      .limit(
        safeLimit
      )
      .get();

  return snapshot.docs
    .map(
      function (doc) {
        const carRef =
          doc.ref &&
          doc.ref.parent &&
          doc.ref.parent.parent;

        return {
          id:
            doc.id,

          carId:
            carRef
              ? carRef.id
              : "",

          ...doc.data()
        };
      }
    )
    .filter(
      function (item) {
        return Boolean(
          normalizeText(
            item.carId
          )
        );
      }
    );
}


// ============================================================
// Claim Reminder Notice
// ============================================================

async function claimReminderNotice(
  carId,
  reminderId
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
          claimed: false,
          reason:
            "not_found"
        };
      }

      const data =
        snapshot.data() || {};

      if (
        normalizeText(
          data.noticeStatus
        ) !== "pending"
      ) {
        return {
          claimed: false,
          reason:
            "not_pending"
        };
      }

      transaction.set(
        ref,
        {
          noticeStatus:
            "sending",

          noticeStartedAt:
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

          noticeStatus:
            "sending",

          noticeStartedAt:
            now
        }
      };
    }
  );
}


// ============================================================
// Mark Reminder Notice Sent
// ============================================================

async function markReminderNoticeSent(
  carId,
  reminderId
) {
  const now =
    new Date()
      .toISOString();

  await getReminderRef(
    carId,
    reminderId
  ).set(
    {
      noticeStatus:
        "sent",

      noticeSentAt:
        now,

      noticeLastError:
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
// Mark Reminder Notice Failed
// ============================================================

async function markReminderNoticeFailed(
  carId,
  reminderId,
  errorMessage
) {
  const now =
    new Date()
      .toISOString();

  await getReminderRef(
    carId,
    reminderId
  ).set(
    {
      noticeStatus:
        "pending",

      noticeLastError:
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
    updatedAt:
      now
  };
}


// ============================================================
// Exports
// ============================================================

module.exports = {
  REMINDER_COLLECTION,
  PRE_TRIP_DOCUMENT,

  getReminderRef,
  getReminder,
  getPreTripReminder,

  listDueReminders,
  claimReminder,
  markReminderSent,
  markReminderFailed,

  listPendingReminderNotices,
  claimReminderNotice,
  markReminderNoticeSent,
  markReminderNoticeFailed
};