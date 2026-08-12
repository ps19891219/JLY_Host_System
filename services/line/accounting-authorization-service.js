"use strict";

const {
  findPlayerByLineUserId,
  getCarById
} = require(
  "../firebase/line-accounting-authorization-repository"
);

function normalizeList(value) {
  return Array.isArray(value)
    ? value.map(String).map(v => v.trim().toLowerCase()).filter(Boolean)
    : [];
}

function normalizeIdentityList(value) {
  return Array.isArray(value)
    ? value.map(String).map(v => v.trim()).filter(Boolean)
    : [];
}

function isAccountingManagerLabel(value) {
  const label = String(value || "")
    .trim()
    .toLowerCase();

  return [
    "主揪",
    "協辦",
    "管理",
    "財務",
    "會計",
    "host",
    "manager",
    "accounting",
    "finance"
  ].some(function (keyword) {
    return label.includes(keyword);
  });
}

function getCarAccountingManagerIds(car) {
  const source = car && typeof car === "object" ? car : {};
  const ids = new Set([
    String(source.ownerId || "").trim(),
    ...normalizeIdentityList(source.hostIds),
    ...normalizeIdentityList(source.managerIds),
    ...normalizeIdentityList(source.accountingManagerIds)
  ]);

  const staffSlots = Array.isArray(source.staffSlots)
    ? source.staffSlots
    : [];

  for (const slot of staffSlots) {
    const label =
      slot && (
        slot.label ||
        slot.roleLabel ||
        slot.title ||
        slot.role
      );

    if (!isAccountingManagerLabel(label)) {
      continue;
    }

    const memberId = String(
      slot.memberId ||
      (slot.memberSnapshot && slot.memberSnapshot.memberId) ||
      ""
    ).trim();

    if (memberId) {
      ids.add(memberId);
    }
  }

  ids.delete("");
  return [...ids];
}

async function resolveAccountingAuthority(
  context,
  groupBinding,
  dependencies = {}
) {
  const findPlayer =
    dependencies.findPlayerByLineUserId ||
    findPlayerByLineUserId;
  const getCar = dependencies.getCarById || getCarById;
  const userId = context.source.userId;
  const player = await findPlayer(userId);
  const roles = normalizeList(player && player.roles);

  if (
    roles.includes("admin") ||
    roles.includes("administrator") ||
    roles.includes("system_admin")
  ) {
    return {
      canManageAll: true,
      reason: "system_admin",
      playerId: player.id
    };
  }

  const carId =
    groupBinding && groupBinding.bound &&
    groupBinding.binding
      ? groupBinding.binding.carId
      : "";

  if (player && carId) {
    const car = await getCar(carId);
    const identityIds = new Set([
      player.id,
      player.identityId,
      ...normalizeIdentityList(player.linkedPlayerIds)
    ].map(String).map(v => v.trim()).filter(Boolean));

    const managerIds = new Set(
      getCarAccountingManagerIds(car)
    );

    const matched = [...identityIds].some(
      function (id) {
        return managerIds.has(id);
      }
    );

    if (car && matched) {
      return {
        canManageAll: true,
        reason:
          managerIds.has(String(car.ownerId || "")) &&
          identityIds.has(String(car.ownerId || ""))
            ? "car_owner"
            : "car_accounting_manager",
        playerId: player.id
      };
    }
  }

  return {
    canManageAll: false,
    reason: player ? "member" : "line_identity_unlinked",
    playerId: player ? player.id : ""
  };
}

function canMutateEntry(entry, actorUserId, authority) {
  if (!entry || entry.status === "deleted") {
    return { allowed: false, reason: "entry_unavailable" };
  }

  if (entry.userId === actorUserId) {
    return { allowed: true, reason: "entry_creator" };
  }

  if (authority && authority.canManageAll) {
    return { allowed: true, reason: authority.reason };
  }

  return { allowed: false, reason: "permission_denied" };
}

module.exports = {
  resolveAccountingAuthority,
  canMutateEntry,
  isAccountingManagerLabel,
  getCarAccountingManagerIds
};
