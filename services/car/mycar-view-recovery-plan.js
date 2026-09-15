"use strict";

function text(value) {
  return String(value == null ? "" : value).trim();
}

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean)));
}

function isCancelled(member) {
  return ["已取消", "取消", "cancelled", "canceled"].includes(text(member && member.status).toLowerCase());
}

function identityIdsFromProfile(profileId, profile) {
  const source = profile && typeof profile === "object" ? profile : {};
  return unique([
    profileId,
    source.id,
    source.playerId,
    source.profileId,
    source.personId,
    source.identityId,
    source.memberId,
    source.canonicalPersonId,
    source.canonicalProfileId,
    source.canonicalMemberId,
    source.mergedIntoPersonId,
    source.mergedIntoProfileId,
    source.mergedIntoMemberId,
    ...(Array.isArray(source.linkedPlayerIds) ? source.linkedPlayerIds : [])
  ]).filter(id => !id.toLowerCase().startsWith("line:"));
}

function memberIds(member) {
  const source = member && typeof member === "object" ? member : {};
  return unique([
    source.playerId,
    source.id,
    source.profileId,
    source.personId,
    source.identityId,
    source.memberId,
    source.canonicalPersonId,
    source.canonicalProfileId,
    source.canonicalMemberId,
    source.mergedIntoPersonId,
    source.mergedIntoProfileId,
    source.mergedIntoMemberId,
    ...(Array.isArray(source.linkedPlayerIds) ? source.linkedPlayerIds : [])
  ]);
}

function ownerIds(car) {
  const source = car && typeof car === "object" ? car : {};
  return unique([
    source.ownerId,
    source.ownerPersonId,
    source.ownerProfileId,
    source.hostId,
    source.hostPersonId,
    source.hostProfileId,
    source.createdByPersonId
  ]);
}

function intersects(values, identitySet) {
  return values.some(value => identitySet.has(text(value)));
}

function classifyCar(car, identityIds) {
  const identitySet = new Set(unique(identityIds));
  const isHost = intersects(ownerIds(car), identitySet);
  const isPlayer = !isHost && (Array.isArray(car && car.players) ? car.players : []).some(member => {
    return !isCancelled(member) && intersects(memberIds(member), identitySet);
  });
  return { isHost, isPlayer };
}

function collectRelevantCars(cars, identityIds) {
  return (Array.isArray(cars) ? cars : []).reduce((result, car) => {
    const id = text(car && (car.id || car.carId));
    if (!id) return result;
    const role = classifyCar(car, identityIds);
    if (!role.isHost && !role.isPlayer) return result;
    result.push({ ...car, id, ...role });
    return result;
  }, []);
}

function summarize(cars) {
  const rows = Array.isArray(cars) ? cars : [];
  return {
    all: rows.length,
    host: rows.filter(car => car && car.isHost === true).length,
    player: rows.filter(car => car && car.isPlayer === true).length
  };
}

function planRecovery(options) {
  const settings = options || {};
  const existingView = settings.existingView && typeof settings.existingView === "object" ? settings.existingView : null;
  const identityIds = unique(settings.identityIds);
  if (!identityIds.length) throw new Error("mycar_recovery_identity_required");
  if (!settings.coreReadComplete) throw new Error("mycar_recovery_core_read_incomplete");

  const relevantCars = collectRelevantCars(settings.coreCars, identityIds);
  const existingCars = existingView && Array.isArray(existingView.cars) ? existingView.cars : [];
  const before = summarize(existingCars);
  const after = summarize(relevantCars);

  return {
    safeToBuild: true,
    shouldWrite: settings.allowWrite === true && (after.all > 0 || settings.confirmEmpty === true),
    identityIds,
    relevantCars,
    before,
    after,
    reason: after.all > 0 ? "core_memberships_found" : "core_memberships_empty_requires_explicit_confirmation"
  };
}

module.exports = {
  identityIdsFromProfile,
  classifyCar,
  collectRelevantCars,
  summarize,
  planRecovery
};
