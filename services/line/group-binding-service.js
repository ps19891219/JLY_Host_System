/*
JLY Host System

Module:
LINE Group Binding Service V1

Responsibilities:

1. Resolve LINE group binding
2. Read binding data through repository
3. Validate binding state
4. Return normalized group context

V1 does NOT:
- Create bindings
- Change bindings
- Read Car data
- Check host permissions
- Send LINE messages
*/

"use strict";

const {
  getBindingByGroupId
} = require(
  "../firebase/line-group-binding-repository"
);

const {
  normalizeBinding,
  isBindingActive
} = require(
  "./group-binding"
);

// ============================================================
// Normalize Text
// ============================================================

function normalizeText(value) {
  return String(
    value || ""
  ).trim();
}

// ============================================================
// Resolve Group Binding
// ============================================================

async function resolveGroupBinding(
  groupId
) {
  const normalizedGroupId =
    normalizeText(
      groupId
    );

  if (!normalizedGroupId) {
    return {
      bound: false,
      reason:
        "group_id_missing",
      binding: null
    };
  }

  const storedBinding =
    await getBindingByGroupId(
      normalizedGroupId
    );

  if (!storedBinding) {
    return {
      bound: false,
      reason:
        "binding_not_found",
      binding: null
    };
  }

  const binding =
    normalizeBinding(
      storedBinding
    );

  if (
    !isBindingActive(
      binding
    )
  ) {
    return {
      bound: false,
      reason:
        "binding_inactive",
      binding
    };
  }

  if (!binding.carId) {
    return {
      bound: false,
      reason:
        "car_id_missing",
      binding
    };
  }

  return {
    bound: true,
    reason:
      "binding_found",
    binding
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  resolveGroupBinding
};