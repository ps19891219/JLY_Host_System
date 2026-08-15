/*
JLY Host System

Module:
Reminder Repository V1

Responsibilities:

1. Read Activity reminder configuration
2. Keep Firestore access outside LINE business logic
3. Do not duplicate Activity data

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
    value == null
      ? ""
      : value
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
    id: snapshot.id,
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


module.exports = {
  REMINDER_COLLECTION,
  PRE_TRIP_DOCUMENT,

  getReminderRef,
  getReminder,
  getPreTripReminder
};