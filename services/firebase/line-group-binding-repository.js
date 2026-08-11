/*
JLY Host System

Module:
LINE Group Binding Repository V1

Responsibilities:

1. Read LINE group bindings from Firestore
2. Save LINE group bindings to Firestore
3. Disable existing bindings
4. Keep Firestore logic out of LINE event routing

Collection:
lineGroupBindings

Document ID:
LINE groupId
*/

"use strict";

const {
  getFirestore
} = require(
  "./admin"
);

const COLLECTION_NAME =
  "lineGroupBindings";

// ============================================================
// Normalize Text
// ============================================================

function normalizeText(value) {
  return String(
    value || ""
  ).trim();
}

// ============================================================
// Get Collection
// ============================================================

function getCollection() {
  const db =
    getFirestore();

  return db.collection(
    COLLECTION_NAME
  );
}

// ============================================================
// Get Binding By Group ID
// ============================================================

async function getBindingByGroupId(
  groupId
) {
  const normalizedGroupId =
    normalizeText(
      groupId
    );

  if (!normalizedGroupId) {
    return null;
  }

  const snapshot =
    await getCollection()
      .doc(normalizedGroupId)
      .get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id:
      snapshot.id,

    ...snapshot.data()
  };
}

// ============================================================
// Save Binding
// ============================================================

async function saveBinding(binding) {
  const source =
    binding &&
    typeof binding === "object"
      ? binding
      : {};

  const groupId =
    normalizeText(
      source.groupId
    );

  const carId =
    normalizeText(
      source.carId
    );

  if (!groupId) {
    throw new Error(
      "LINE groupId is required."
    );
  }

  if (!carId) {
    throw new Error(
      "LINE carId is required."
    );
  }

  const now =
    new Date().toISOString();

  const data = {
    groupId,
    carId,

    status:
      normalizeText(
        source.status
      ) || "active",

    createdBy:
      normalizeText(
        source.createdBy
      ),

    createdAt:
      source.createdAt || now,

    updatedAt:
      now
  };

  await getCollection()
    .doc(groupId)
    .set(
      data,
      {
        merge: true
      }
    );

  return data;
}

// ============================================================
// Disable Binding
// ============================================================

async function disableBinding(
  groupId
) {
  const normalizedGroupId =
    normalizeText(
      groupId
    );

  if (!normalizedGroupId) {
    throw new Error(
      "LINE groupId is required."
    );
  }

  const updatedAt =
    new Date().toISOString();

  await getCollection()
    .doc(normalizedGroupId)
    .set(
      {
        status:
          "inactive",

        updatedAt
      },
      {
        merge: true
      }
    );

  return {
    groupId:
      normalizedGroupId,

    status:
      "inactive",

    updatedAt
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  COLLECTION_NAME,
  getBindingByGroupId,
  saveBinding,
  disableBinding
};