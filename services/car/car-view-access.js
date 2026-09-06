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

function safePlayer(player) {
  const source = player && typeof player === "object" ? player : {};
  return {
    playerName: text(source.playerName || source.name || source.displayName),
    name: text(source.name || source.playerName || source.displayName),
    displayName: text(source.displayName || source.playerName || source.name),
    position: text(source.position || source.roleChoice || source.role),
    roleChoice: text(source.roleChoice || source.position || source.role),
    role: text(source.role || source.position || source.roleChoice),
    isCrossPlay: source.isCrossPlay === true,
    status: text(source.status)
  };
}

function safeStaff(slot, index) {
  const source = slot && typeof slot === "object" ? slot : {};
  const nested = source.player && typeof source.player === "object" ? source.player : {};
  return {
    id: text(source.id || source.slotId) || `staff-${index + 1}`,
    slotId: text(source.slotId || source.id),
    order: Number(source.order || index + 1),
    label: text(source.label || source.roleLabel || source.title || index + 1),
    roleLabel: text(source.roleLabel || source.label || source.title),
    title: text(source.title || source.label || source.roleLabel),
    displayName: text(source.displayName || source.name || nested.displayName || nested.name),
    name: text(source.name || source.displayName || nested.name || nested.displayName),
    isCrossPlay: source.isCrossPlay === true || nested.isCrossPlay === true,
    player: nested && Object.keys(nested).length ? safePlayer(nested) : null
  };
}

function safeSeat(slot, index) {
  const source = slot && typeof slot === "object" ? slot : {};
  const player = source.player && typeof source.player === "object" ? source.player : null;
  return {
    id: text(source.id || source.slotId) || `seat-${index + 1}`,
    slotId: text(source.slotId || source.id),
    section: text(source.section || source.position || source.gender),
    position: text(source.position || source.section || source.gender),
    gender: text(source.gender || source.position || source.section),
    order: Number(source.order || index + 1),
    label: text(source.label || source.name || index + 1),
    isOccupied: source.isOccupied === true || Boolean(player),
    player: player ? safePlayer(player) : null,
    displayName: text(source.displayName || source.playerName || source.name)
  };
}

function groupCar(car) {
  const source = car && typeof car === "object" ? car : {};
  const base = publicCar(source);
  return {
    ...base,
    maleSlots: Number(source.maleSlots || source.maleCount || 0),
    femaleSlots: Number(source.femaleSlots || source.femaleCount || 0),
    flexibleSlots: Number(source.flexibleSlots || source.flexSlots || source.anySlots || 0),
    address: text(source.address),
    locationName: text(source.locationName || source.location),
    organizerName: text(source.organizerName || source.studioName || source.organizer),
    note: text(source.publicNote || source.note),
    players: (Array.isArray(source.players) ? source.players : []).map(safePlayer),
    staffSlots: (Array.isArray(source.staffSlots) ? source.staffSlots : []).map(safeStaff),
    seatSlots: (Array.isArray(source.seatSlots) ? source.seatSlots : Array.isArray(source.slots) ? source.slots : []).map(safeSeat),
    slots: (Array.isArray(source.slots) ? source.slots : Array.isArray(source.seatSlots) ? source.seatSlots : []).map(safeSeat),
    waitingPlayers: (Array.isArray(source.waitingPlayers) ? source.waitingPlayers : []).map(safePlayer),
    unassignedPlayers: (Array.isArray(source.unassignedPlayers) ? source.unassignedPlayers : []).map(safePlayer)
  };
}

function carViewPayload(car, session, options = {}) {
  const member = isCarMember(car, session);
  if (member) return { access: "member", car: { ...car } };
  if (options.groupAccess === true) return { access: "group", car: groupCar(car) };
  return { access: "public", car: publicCar(car) };
}

module.exports = { identityIds, isCarMember, publicCar, groupCar, carViewPayload };
