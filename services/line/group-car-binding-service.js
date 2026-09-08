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
const { initializeMembershipSnapshot } = require(
  "./group-membership-health-service"
);

function text(value) {
  return String(value || "").trim();
}

function isSyntheticLineId(value) {
  return text(value).toLowerCase().startsWith("line:");
}

function getIdentityIds(player) {
  const source = player && typeof player === "object" ? player : {};
  const ids = new Set();

  function add(value) {
    const safe = text(value);
    if (!safe || isSyntheticLineId(safe)) return;
    ids.add(safe);
  }

  add(source.id);
  add(source.playerId);
  add(source.personId);
  add(source.profileId);
  add(source.identityId);
  add(source.canonicalPersonId);
  add(source.canonicalProfileId);
  add(source.canonicalMemberId);
  add(source.mergedIntoPersonId);
  add(source.mergedIntoProfileId);
  add(source.mergedIntoMemberId);

  const linkedPlayerIds = Array.isArray(source.linkedPlayerIds)
    ? source.linkedPlayerIds
    : [];
  linkedPlayerIds.forEach(add);

  return ids;
}

function getCarOwnerIds(car) {
  const source = car && typeof car === "object" ? car : {};
  const ids = new Set();

  function add(value) {
    const safe = text(value);
    if (!safe || isSyntheticLineId(safe)) return;
    ids.add(safe);
  }

  add(source.ownerId);
  add(source.ownerPersonId);
  add(source.hostPersonId);
  add(source.createdByPersonId);
  add(source.hostProfileId);
  add(source.ownerProfileId);
  add(source.hostId);

  return ids;
}

function isCarOwner(player, car) {
  const actorIds = getIdentityIds(player);
  const ownerIds = getCarOwnerIds(car);
  if (!actorIds.size || !ownerIds.size) return false;
  return [...ownerIds].some(id => actorIds.has(id));
}

function isAuthorizedPairing(dependencies) {
  const pairing = dependencies && dependencies.pairingAuthorization;
  return Boolean(
    dependencies &&
    dependencies.authorizedPairing === true &&
    pairing &&
    pairing.authorizationType === "car_owner_session" &&
    text(pairing.authorizedByPersonId)
  );
}

function getCarLabel(car) {
  return String(
    car && (car.scriptName || car.title || car.name || car.id) || "JLY 車團"
  ).trim();
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
  const initializeMembership = dependencies.initializeMembershipSnapshot ||
    initializeMembershipSnapshot;

  if (!context || context.source.type !== "group") {
    return { bound: false, reason: "group_required" };
  }

  const car = await getCar(carId);
  if (!car) {
    return { bound: false, reason: "car_not_found" };
  }

  const pairingAuthorized = isAuthorizedPairing(dependencies);

  // Direct/legacy binding still requires the LINE actor to be the car owner.
  // The pairing-code flow is different: owner authority was already verified
  // when the short-lived code was minted on the JLY car side. Therefore the
  // LINE group executor may be any group participant holding that valid code.
  if (!pairingAuthorized) {
    const player = await findPlayer(context.source.userId);
    if (!player) {
      return { bound: false, reason: "line_identity_unlinked" };
    }
    if (!isCarOwner(player, car)) {
      return { bound: false, reason: "owner_required" };
    }
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
    authorizedByPersonId:
      pairingAuthorized
        ? text(dependencies.pairingAuthorization.authorizedByPersonId)
        : null,
    authorizationType:
      pairingAuthorized
        ? "car_owner_session"
        : "direct_car_owner",
    status: "active"
  });
  const legacyEntries = await listLegacy(context.source.groupId);
  const migration = await migrate(
    carId,
    context.source.groupId,
    legacyEntries
  );

  let membershipHealth = null;
  try {
    membershipHealth = await initializeMembership({
      groupId: context.source.groupId,
      carId,
      car
    }, dependencies);
  } catch (error) {
    console.error("LINE membership snapshot initialization failed.", error);
    membershipHealth = {
      initialized: false,
      reason: "initialization_failed"
    };
  }

  return {
    bound: true,
    reason: "binding_created",
    binding,
    migration,
    membershipHealth,
    car: {
      id: car.id || carId,
      label: getCarLabel(car),
      date: car.date || car.startDate || ""
    }
  };
}

module.exports = {
  bindGroupToCar,
  getIdentityIds,
  getCarOwnerIds,
  isCarOwner,
  isAuthorizedPairing,
  getCarLabel
};
