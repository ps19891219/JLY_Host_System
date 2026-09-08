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

function addFormalId(target, value) {
  const safe = text(value);
  if (!safe || isSyntheticLineId(safe)) return;
  target.add(safe);
}

function getIdentityIds(player) {
  const source = player && typeof player === "object" ? player : {};
  const ids = new Set();

  addFormalId(ids, source.id);
  addFormalId(ids, source.playerId);
  addFormalId(ids, source.personId);
  addFormalId(ids, source.profileId);
  addFormalId(ids, source.identityId);
  addFormalId(ids, source.canonicalPersonId);
  addFormalId(ids, source.canonicalProfileId);
  addFormalId(ids, source.canonicalMemberId);
  addFormalId(ids, source.mergedIntoPersonId);
  addFormalId(ids, source.mergedIntoProfileId);
  addFormalId(ids, source.mergedIntoMemberId);

  const linkedPlayerIds = Array.isArray(source.linkedPlayerIds)
    ? source.linkedPlayerIds
    : [];
  linkedPlayerIds.forEach(value => addFormalId(ids, value));

  return ids;
}

function getReferenceIds(player) {
  const source = player && typeof player === "object" ? player : {};
  const ids = new Set();
  [
    source.playerId,
    source.personId,
    source.canonicalPersonId,
    source.canonicalProfileId,
    source.canonicalMemberId,
    source.mergedIntoPersonId,
    source.mergedIntoProfileId,
    source.mergedIntoMemberId
  ].forEach(value => addFormalId(ids, value));
  (Array.isArray(source.linkedPlayerIds) ? source.linkedPlayerIds : [])
    .forEach(value => addFormalId(ids, value));
  return ids;
}

function formalStrongValues(player) {
  const source = player && typeof player === "object" ? player : {};
  const out = {};
  ["lineUserId", "identityId", "profileId"].forEach(field => {
    const value = text(source[field]);
    out[field] = value && !isSyntheticLineId(value) ? value : "";
  });
  return out;
}

function sharesStrongIdentity(a, b) {
  const left = formalStrongValues(a);
  const right = formalStrongValues(b);
  return ["lineUserId", "identityId", "profileId"]
    .some(field => left[field] && left[field] === right[field]);
}

function hasExplicitIdentityReference(a, b) {
  const aId = text(a && a.id);
  const bId = text(b && b.id);
  if (!aId || !bId) return false;
  return getReferenceIds(a).has(bId) || getReferenceIds(b).has(aId);
}

function getIdentityComponentConflicts(rows) {
  const conflicts = [];
  ["lineUserId", "identityId", "profileId"].forEach(field => {
    const values = [...new Set((rows || [])
      .map(row => formalStrongValues(row)[field])
      .filter(Boolean))];
    if (values.length > 1) conflicts.push({ field, values });
  });
  return conflicts;
}

function buildIdentityComponent(rows, lineUserId) {
  const source = Array.isArray(rows) ? rows : [];
  const targetLineUserId = text(lineUserId);
  const seeds = source.filter(row => text(row && row.lineUserId) === targetLineUserId);
  if (!targetLineUserId || !seeds.length) {
    return { rows: [], ids: new Set(), conflicts: [], valid: false };
  }

  const selected = new Set(seeds);
  let changed = true;
  while (changed) {
    changed = false;
    source.forEach(candidate => {
      if (selected.has(candidate)) return;
      const related = [...selected].some(current =>
        sharesStrongIdentity(current, candidate) ||
        hasExplicitIdentityReference(current, candidate)
      );
      if (related) {
        selected.add(candidate);
        changed = true;
      }
    });
  }

  const componentRows = [...selected];
  const conflicts = getIdentityComponentConflicts(componentRows);
  const ids = new Set();
  componentRows.forEach(row => getIdentityIds(row).forEach(id => ids.add(id)));
  return {
    rows: componentRows,
    ids,
    conflicts,
    valid: componentRows.length > 0 && conflicts.length === 0
  };
}

function getCarOwnerIds(car) {
  const source = car && typeof car === "object" ? car : {};
  const ids = new Set();

  addFormalId(ids, source.ownerId);
  addFormalId(ids, source.ownerPersonId);
  addFormalId(ids, source.hostPersonId);
  addFormalId(ids, source.createdByPersonId);
  addFormalId(ids, source.hostProfileId);
  addFormalId(ids, source.ownerProfileId);
  addFormalId(ids, source.hostId);

  return ids;
}

function identityIdsOwnCar(identityIds, car) {
  const actorIds = identityIds instanceof Set ? identityIds : new Set(identityIds || []);
  const ownerIds = getCarOwnerIds(car);
  if (!actorIds.size || !ownerIds.size) return false;
  return [...ownerIds].some(id => actorIds.has(id));
}

function isCarOwner(player, car) {
  return identityIdsOwnCar(getIdentityIds(player), car);
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
  getReferenceIds,
  formalStrongValues,
  sharesStrongIdentity,
  hasExplicitIdentityReference,
  getIdentityComponentConflicts,
  buildIdentityComponent,
  getCarOwnerIds,
  identityIdsOwnCar,
  isCarOwner,
  isAuthorizedPairing,
  getCarLabel
};
