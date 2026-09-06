"use strict";

function text(value) { return String(value == null ? "" : value).trim(); }
function lower(value) { return text(value).toLowerCase(); }

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

function sameIdentity(value, session) {
  const ids = sessionIds(session);
  return ids.size > 0 && identityIds(value).some(id => ids.has(id));
}

function displayName(value) {
  const source = value && typeof value === "object" ? value : {};
  return text(source.displayName || source.playerName || source.name || source.nickname || source.staffName || source.dmName);
}

function sameLegacyName(value, session) {
  const sessionName = lower(session && session.displayName);
  return Boolean(sessionName && lower(displayName(value)) === sessionName);
}

function matchesViewer(value, session) {
  return sameIdentity(value, session) || sameLegacyName(value, session);
}

function isActive(value) {
  const status = lower(value && value.status);
  return !["cancelled", "canceled", "已取消", "取消", "rejected", "拒絕"].includes(status);
}

function isPending(value) {
  const status = lower(value && value.status);
  return !status || ["pending", "待審核", "等待審核", "待確認"].includes(status);
}

function isCarMember(car, session) {
  const ids = sessionIds(session);
  if (!ids.size) return false;
  if ([car && car.ownerId, car && car.hostId, car && car.createdBy].map(text).some(id => ids.has(id))) return true;
  const members = [
    ...(Array.isArray(car && car.players) ? car.players : []),
    ...(Array.isArray(car && car.staffSlots) ? car.staffSlots : [])
  ];
  return members.some(member => isActive(member) && matchesViewer(member, session));
}

function viewerState(car, session) {
  const authenticated = Boolean(sessionIds(session).size);
  if (!authenticated) {
    return { authenticated: false, role: "anonymous", playerStatus: "available", dmStatus: "available" };
  }

  const players = Array.isArray(car && car.players) ? car.players : [];
  const staff = Array.isArray(car && car.staffSlots) ? car.staffSlots : [];
  const playerApplications = Array.isArray(car && car.applications) ? car.applications : [];
  const dmApplications = Array.isArray(car && car.dmApplications) ? car.dmApplications : [];

  const player = players.find(item => isActive(item) && matchesViewer(item, session));
  const staffMember = staff.find(item => isActive(item) && matchesViewer(item, session));
  const pendingPlayer = playerApplications.find(item => isPending(item) && matchesViewer(item, session));
  const pendingDm = dmApplications.find(item => isPending(item) && matchesViewer(item, session));

  let role = "identified";
  if (staffMember) role = "staff";
  else if (player) role = "player";
  else if (pendingDm || pendingPlayer) role = "pending";

  return {
    authenticated: true,
    role,
    displayName: text(session && session.displayName),
    playerStatus: player ? "joined" : pendingPlayer ? "pending" : "available",
    dmStatus: staffMember ? "joined" : pendingDm ? "pending" : "available"
  };
}

function safePlayer(player, index) {
  const source = player && typeof player === "object" ? player : {};
  return {
    id: `public-player-${index + 1}`,
    playerName: displayName(source),
    displayName: displayName(source),
    position: text(source.position || source.roleChoice || source.role),
    roleChoice: text(source.roleChoice || source.position || source.role),
    isCrossPlay: source.isCrossPlay === true,
    status: text(source.status)
  };
}

function safeStaff(slot, index) {
  const source = slot && typeof slot === "object" ? slot : {};
  return {
    id: `public-staff-${index + 1}`,
    order: Number(source.order || index + 1),
    label: text(source.label || source.roleLabel || source.title || index + 1),
    displayName: displayName(source),
    name: displayName(source),
    isCrossPlay: source.isCrossPlay === true || Boolean(source.player && source.player.isCrossPlay === true)
  };
}

function publicCar(car) {
  const source = car && typeof car === "object" ? car : {};
  const rawPlayers = (Array.isArray(source.players) ? source.players : []).filter(isActive);
  const players = rawPlayers.map(safePlayer);
  const playerIdMap = new Map();
  rawPlayers.forEach((player, index) => identityIds(player).forEach(id => playerIdMap.set(id, players[index].id)));

  const seatSlots = (Array.isArray(source.seatSlots) ? source.seatSlots : []).map(function (slot, index) {
    const safe = slot && typeof slot === "object" ? slot : {};
    const originalPlayerId = text(safe.playerId || safe.memberId || safe.profileId);
    return {
      id: `public-seat-${index + 1}`,
      order: Number(safe.order || index + 1),
      label: text(safe.label || safe.position || safe.role || index + 1),
      position: text(safe.position || safe.role || safe.gender),
      role: text(safe.role || safe.position),
      gender: text(safe.gender),
      playerId: playerIdMap.get(originalPlayerId) || ""
    };
  });

  return {
    id: text(source.id || source.carId),
    scriptName: text(source.scriptName || source.title || source.name),
    status: text(source.status),
    gameDate: text(source.gameDate || source.date || source.startDate),
    gameTime: text(source.gameTime || source.time || source.startTime),
    price: source.price != null ? source.price : source.playerPrice,
    totalPeople: Number(source.totalPeople || source.capacity || 0),
    maleSlots: Number(source.maleSlots || source.maleCount || 0),
    femaleSlots: Number(source.femaleSlots || source.femaleCount || 0),
    flexibleSlots: Number(source.flexibleSlots || source.flexSlots || source.anySlots || 0),
    studioName: text(source.studioName || source.studio || source.organizerName || source.organizer),
    location: text(source.location || source.locationName || source.address || source.gameLocation),
    publicNote: text(source.publicNote || source.note),
    players,
    staffSlots: (Array.isArray(source.staffSlots) ? source.staffSlots : []).map(safeStaff),
    seatSlots
  };
}

function carViewPayload(car, session) {
  const member = isCarMember(car, session);
  return {
    access: member ? "member" : "public",
    viewer: viewerState(car, session),
    car: member ? { ...car } : publicCar(car)
  };
}

module.exports = { identityIds, isCarMember, viewerState, publicCar, carViewPayload };
