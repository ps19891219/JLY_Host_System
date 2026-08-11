/*
JLY Host System

Module:
LINE Group Binding V1

Responsibilities:

1. Define LINE group binding structure
2. Normalize group / car identifiers
3. Validate binding data
4. Create normalized binding records
5. Provide lookup helpers for future storage layer

V1 does NOT:
- Read Firebase
- Write Firebase
- Send LINE messages
- Handle permissions
- Bind group automatically
*/

"use strict";

// ============================================================
// Normalize Text
// ============================================================

function normalizeText(value) {
  return String(
    value || ""
  ).trim();
}

// ============================================================
// Normalize Binding
// ============================================================

function normalizeBinding(binding) {
  const source =
    binding &&
    typeof binding === "object"
      ? binding
      : {};

  return {
    groupId:
      normalizeText(
        source.groupId
      ),

    carId:
      normalizeText(
        source.carId
      ),

    status:
      normalizeText(
        source.status
      ) || "active",

    createdBy:
      normalizeText(
        source.createdBy
      ),

    createdAt:
      source.createdAt || null,

    updatedAt:
      source.updatedAt || null
  };
}

// ============================================================
// Validate Binding
// ============================================================

function validateBinding(binding) {
  const normalized =
    normalizeBinding(
      binding
    );

  const errors = [];

  if (!normalized.groupId) {
    errors.push(
      "group_id_missing"
    );
  }

  if (!normalized.carId) {
    errors.push(
      "car_id_missing"
    );
  }

  return {
    valid:
      errors.length === 0,

    errors,

    binding:
      normalized
  };
}

// ============================================================
// Create Binding
// ============================================================

function createBinding(data) {
  const now =
    new Date().toISOString();

  const binding =
    normalizeBinding({
      ...data,

      status:
        "active",

      createdAt:
        data &&
        data.createdAt
          ? data.createdAt
          : now,

      updatedAt:
        now
    });

  const validation =
    validateBinding(
      binding
    );

  if (!validation.valid) {
    const error =
      new Error(
        "Invalid LINE group binding."
      );

    error.code =
      "invalid_group_binding";

    error.details =
      validation.errors;

    throw error;
  }

  return binding;
}

// ============================================================
// Binding Match Helpers
// ============================================================

function isSameGroup(
  binding,
  groupId
) {
  const normalized =
    normalizeBinding(
      binding
    );

  return (
    normalized.groupId ===
    normalizeText(
      groupId
    )
  );
}

function isSameCar(
  binding,
  carId
) {
  const normalized =
    normalizeBinding(
      binding
    );

  return (
    normalized.carId ===
    normalizeText(
      carId
    )
  );
}

// ============================================================
// Active Binding
// ============================================================

function isBindingActive(
  binding
) {
  const normalized =
    normalizeBinding(
      binding
    );

  return (
    normalized.status ===
    "active"
  );
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  normalizeBinding,
  validateBinding,
  createBinding,
  isSameGroup,
  isSameCar,
  isBindingActive
};