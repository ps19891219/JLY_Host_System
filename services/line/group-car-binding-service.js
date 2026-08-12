"use strict";

const {
  findPlayerByLineUserId,
  getCarById
} = require(
  "../firebase/line-accounting-authorization-repository"
);
const { getBindingByGroupId, saveBinding } = require(
  "../firebase/line-group-binding-repository"
);
const { listGroupAccountingEntries } = require(
  "../firebase/line-group-accounting-repository"
);
const { migrateLegacyGroupAccounting } = require(
  "../firebase/car-accounting-repository"
);

function getIdentityIds(player) {
  return new Set([
    player && player.id,
    player && player.identityId,
    ...(
      player && Array.isArray(player.linkedPlayerIds)
        ? player.linkedPlayerIds
        : []
    )
  ].filter(Boolean).map(String));
}

async function bindGroupToCar(
  context,
  carId,
  dependencies = {}
) {
  const findPlayer = dependencies.findPlayerByLineUserId ||
    findPlayerByLineUserId;
  const getCar = dependencies.getCarById || getCarById;
  const getBinding = dependencies.getBindingByGroupId ||
    getBindingByGroupId;
  const save = dependencies.saveBinding || saveBinding;
  const listLegacy = dependencies.listGroupAccountingEntries ||
    listGroupAccountingEntries;
  const migrate = dependencies.migrateLegacyGroupAccounting ||
    migrateLegacyGroupAccounting;

  if (!context || context.source.type !== "group") {
    return { bound: false, reason: "group_required" };
  }

  const player = await findPlayer(context.source.userId);
  if (!player) {
    return { bound: false, reason: "line_identity_unlinked" };
  }

  const car = await getCar(carId);
  if (!car) {
    return { bound: false, reason: "car_not_found" };
  }

  if (!getIdentityIds(player).has(String(car.ownerId || ""))) {
    return { bound: false, reason: "owner_required" };
  }

  const existingBinding = await getBinding(
    context.source.groupId
  );
  if (
    existingBinding &&
    existingBinding.status === "active" &&
    String(existingBinding.carId || "") !== String(carId)
  ) {
    return {
      bound: false,
      reason: "binding_conflict",
      binding: existingBinding
    };
  }

  const binding = await save({
    groupId: context.source.groupId,
    carId,
    createdBy: context.source.userId,
    status: "active"
  });
  const legacyEntries = await listLegacy(context.source.groupId);
  const migration = await migrate(
    carId,
    context.source.groupId,
    legacyEntries
  );

  return {
    bound: true,
    reason: "binding_created",
    binding,
    migration
  };
}

module.exports = {
  bindGroupToCar,
  getIdentityIds
};
