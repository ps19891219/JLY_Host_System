"use strict";

function text(value) { return String(value || "").trim(); }

function identityIds(value) {
  const source = value && typeof value === "object" ? value : {};
  const nested = source.player && typeof source.player === "object" ? source.player : {};
  return [
    source.id, source.personId, source.memberId, source.playerId, source.profileId,
    source.identityId, ...(Array.isArray(source.linkedPlayerIds) ? source.linkedPlayerIds : []),
    nested.id, nested.personId, nested.memberId, nested.playerId, nested.profileId,
    nested.identityId, ...(Array.isArray(nested.linkedPlayerIds) ? nested.linkedPlayerIds : [])
  ].map(text).filter(Boolean);
}

function sessionIds(session) {
  return new Set([session && session.profileId, session && session.identityId].map(text).filter(Boolean));
}

function isCarMember(car, session) {
  const ids = sessionIds(session);
  if (!ids.size) return false;
  if ([car && car.ownerId, car && car.hostId, car && car.createdBy].map(text).some(id => ids.has(id))) return true;
  const members = [
    ...(Array.isArray(car && car.players) ? car.players : []),
    ...(Array.isArray(car && car.staffSlots) ? car.staffSlots : [])
  ];
  return members.some(member => identityIds(member).some(id => ids.has(id)));
}

function publicCar(car) {
  const source = car && typeof car === "object" ? car : {};
  return {
    id: text(source.id || source.carId),
    scriptName: text(source.scriptName || source.title || source.name),
    status: text(source.status),
    gameDate: text(source.gameDate || source.date || source.startDate),
    gameTime: text(source.gameTime || source.time || source.startTime),
    price: Number(source.price || source.playerPrice || 0),
    totalPeople: Number(source.totalPeople || source.capacity || 0),
    studioName: text(source.studioName || source.organizerName || source.organizer),
    location: text(source.location || source.locationName),
    publicNote: text(source.publicNote)
  };
}

function carViewPayload(car, session) {
  const member = isCarMember(car, session);
  return {
    access: member ? "member" : "public",
    car: member ? { ...car } : publicCar(car)
  };
}

module.exports = { identityIds, isCarMember, publicCar, carViewPayload };
