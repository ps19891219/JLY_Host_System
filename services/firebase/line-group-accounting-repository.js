/*
JLY Host System

Module:
LINE Group Accounting Repository V1

Firestore path:
lineGroupAccounts/{groupId}/entries/{messageId}
*/

"use strict";

const {
  getFirestore
} = require(
  "./admin"
);

const COLLECTION_NAME =
  "lineGroupAccounts";

function normalizeText(value) {
  return String(value || "").trim();
}

async function saveGroupAccountingEntry(entry) {
  const source =
    entry && typeof entry === "object"
      ? entry
      : {};

  const groupId = normalizeText(source.groupId);
  const messageId = normalizeText(source.messageId);
  const userId = normalizeText(source.userId);
  const type = normalizeText(source.type);
  const description = normalizeText(source.description);
  const amount = Number(source.amount);

  if (!groupId) {
    throw new Error("LINE groupId is required.");
  }

  if (!messageId) {
    throw new Error("LINE messageId is required.");
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Accounting amount must be a positive integer.");
  }

  if (!description) {
    throw new Error("Accounting description is required.");
  }

  if (type !== "income" && type !== "expense") {
    throw new Error("Accounting type is invalid.");
  }

  const createdAt =
    normalizeText(source.createdAt) ||
    new Date().toISOString();

  const data = {
    groupId,
    messageId,
    userId,
    type,
    amount,
    description,
    source: "line_group",
    createdAt,
    updatedAt: new Date().toISOString()
  };

  await getFirestore()
    .collection(COLLECTION_NAME)
    .doc(groupId)
    .collection("entries")
    .doc(messageId)
    .set(data, { merge: false });

  return data;
}

module.exports = {
  COLLECTION_NAME,
  saveGroupAccountingEntry
};
