"use strict";

const Core = require("../../js/data-view/play-history-core");
const { text, resolveCanonicalPerson } = require("./access");
const { createAdapter } = require("../../js/data-view/play-history-storage");
const { getCarAccountingManagerIds } = require("../line/accounting-authorization-service");

const maxParticipants = 60;
const cancelledRegistrationStates = new Set([
  "cancelled", "canceled", "已取消", "取消", "removed", "withdrawn", "已退出", "rejected", "declined"
]);

function roleOf(value) {
  const role = text(value).toLowerCase();
  if (["host", "organizer", "主揪", "揪團者"].includes(role)) return "host";
  if (["dm", "主持", "主持人"].includes(role)) return "dm";
  if (["npc", "non-player character"].includes(role)) return "npc";
  return "player";
}

function attendanceOf(value) {
  const state = text(value).toLowerCase();
  if (["attended", "出席", "已出席"].includes(state)) return "attended";
  if (["absent", "未出席", "未到"].includes(state)) return "absent";
  if (["cancelled", "canceled", "已取消"].includes(state)) return "cancelled";
  return "unconfirmed";
}

function canonicalResolver(db, readDoc) {
  const cache = new Map();
  const documentCache = new Map();
  const cachedReadDoc = async ref => {
    if (!documentCache.has(ref.path)) documentCache.set(ref.path, Promise.resolve(readDoc ? readDoc(ref) : ref.get()));
    return documentCache.get(ref.path);
  };
  return async id => {
    const key = text(id);
    if (cache.has(key)) return cache.get(key);
    const pending = resolveCanonicalPerson(db, key, cachedReadDoc);
    cache.set(key, pending);
    const person = await pending;
    for (const alias of person.aliases) cache.set(alias, Promise.resolve(person));
    return person;
  };
}

async function normalizeParticipants(db, rows, resolver = canonicalResolver(db)) {
  if (!Array.isArray(rows) || rows.length > maxParticipants) {
    throw Object.assign(new Error("participants_invalid"), { statusCode: 400 });
  }
  const normalized = [];
  for (const participant of rows) {
    const person = await resolver(participant.personId);
    normalized.push({
      personId: person.id,
      role: roleOf(participant.role),
      attendance: attendanceOf(participant.attendance)
    });
  }
  if (new Set(normalized.map(person => person.personId)).size !== normalized.length) {
    throw Object.assign(new Error("duplicate_canonical_person"), { statusCode: 400 });
  }
  return normalized;
}

function sessionInput(body, participants, id) {
  return {
    id,
    sourceType: "historical",
    scriptName: text(body.scriptName),
    date: text(body.date),
    time: text(body.time),
    place: text(body.place),
    status: text(body.status || "completed"),
    participants,
    updatedAt: new Date().toISOString()
  };
}

function makeAdapter(db) {
  const transactionResolvers = new WeakMap();
  return createAdapter({
    db,
    core: Core,
    authorizeManager: async actor => actor && actor.manager === true,
    authorizeViewer: async (actor, target) => actor === target,
    canonicalize: async (id, readDoc, context) => {
      if (!transactionResolvers.has(context)) transactionResolvers.set(context, canonicalResolver(db, readDoc));
      return (await transactionResolvers.get(context)(id)).id;
    }
  });
}

async function createOrUpdateHistorical(db, actor, body) {
  if (!actor?.manager) throw Object.assign(new Error("manager_required"), { statusCode: 403 });
  const id = text(body.id) || `hist:${require("crypto").randomUUID().replace(/-/g, "")}`;
  if (!/^hist:[A-Za-z0-9_-]{8,128}$/.test(id)) {
    throw Object.assign(new Error("historical_session_id_invalid"), { statusCode: 400 });
  }
  if (!Array.isArray(body.participants) || body.participants.length > maxParticipants) {
    throw Object.assign(new Error("participants_invalid"), { statusCode: 400 });
  }
  const participants = body.participants.map(person => ({
    personId: text(person && person.personId),
    role: roleOf(person && person.role),
    attendance: attendanceOf(person && person.attendance)
  }));
  return makeAdapter(db).put(actor, sessionInput(body, participants, id));
}

async function getPersonView(db, actor) {
  return makeAdapter(db).read(actor.id, actor.id);
}

async function getHistoricalSession(db, id) {
  const snap = await db.collection("playHistorySessions").doc(id).get();
  return snap.exists ? Core.prepareSession(snap.data()) : null;
}

async function getCarDetail(db, id) {
  const snap = await db.collection("carDetailViews").doc(id).get();
  if (!snap.exists) return null;
  return (snap.data() || {}).car || null;
}

async function getCarRosterForManager(db, actor, carId) {
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(text(carId))) {
    throw Object.assign(new Error("car_id_invalid"), { statusCode: 400 });
  }
  const [sourceSnap, detail] = await Promise.all([
    db.collection("cars").doc(carId).get(),
    getCarDetail(db, carId)
  ]);
  if (!sourceSnap.exists || !detail) throw Object.assign(new Error("car_not_found"), { statusCode: 404 });
  const car = sourceSnap.data() || {};
  if (!await isCarManager(db, actor, car)) throw Object.assign(new Error("manager_required"), { statusCode: 403 });
  const resolvePerson = canonicalResolver(db);
  const priorAttendance = new Map();
  for (const person of Array.isArray(car.playRecordParticipants) ? car.playRecordParticipants : []) {
    const canonical = await resolvePerson(person.personId);
    priorAttendance.set(canonical.id, person.attendance);
  }
  const rows = carParticipantIds({ ...detail, ...car });
  const participants = [];
  const canonicalIds = new Set();
  for (const person of rows) {
    const canonical = await resolvePerson(person.personId);
    if (canonicalIds.has(canonical.id)) continue;
    canonicalIds.add(canonical.id);
    participants.push({
      personId: canonical.id,
      displayName: text(canonical.profile.displayName || canonical.profile.nickname || canonical.profile.playerName),
      role: roleOf(person.role),
      attendance: attendanceOf(priorAttendance.get(canonical.id) || person.attendance)
    });
  }
  return { carId, participants };
}

async function isCarManager(db, actor, car, resolvePerson = canonicalResolver(db)) {
  if (actor?.manager) return true;
  for (const id of getCarAccountingManagerIds(car)) {
    try {
      if ((await resolvePerson(id)).id === actor?.id) return true;
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }
  return false;
}

function carParticipantIds(car) {
  const rows = [];
  const savedAttendance = car.playRecordAttendance && typeof car.playRecordAttendance === "object"
    ? car.playRecordAttendance : {};
  for (const person of Array.isArray(car.players) ? car.players : []) {
    const id = text(person.personId || person.playerId || person.profileId || person.memberId || person.id);
    if (id && !cancelledRegistrationStates.has(text(person.status).toLowerCase())) {
      rows.push({
        personId: id,
        role: roleOf(person.role || person.roleChoice || "player"),
        attendance: attendanceOf(person.playAttendance || savedAttendance[id])
      });
    }
  }
  for (const person of Array.isArray(car.staffSlots) ? car.staffSlots : []) {
    const id = text(person.personId || person.memberId || person.profileId || person.playerId);
    const role = roleOf(person.label || person.role || "dm");
    if (id && ["dm", "npc"].includes(role)) {
      rows.push({ personId: id, role, attendance: attendanceOf(person.playAttendance || savedAttendance[id]) });
    }
  }
  // Host authority is not proof of attendance. Include the host in the
  // manager-confirmed roster only when not already represented; attendance
  // remains unconfirmed until the manager explicitly marks it.
  for (const personId of [car.ownerId, ...(Array.isArray(car.hostIds) ? car.hostIds : [])].map(text).filter(Boolean)) {
    const existing = rows.find(person => text(person.personId) === personId);
    if (existing) existing.role = "host";
    else rows.push({ personId, role: "host", attendance: attendanceOf(savedAttendance[personId]) });
  }
  return rows;
}

function mergeCarParticipants(rows, resolvePerson) {
  const priority = { player: 1, npc: 2, dm: 3, host: 4 };
  return Promise.all(rows.map(async row => ({ ...row, personId: (await resolvePerson(row.personId)).id })))
    .then(canonicalRows => {
      const merged = new Map();
      for (const row of canonicalRows) {
        const prior = merged.get(row.personId);
        if (!prior) { merged.set(row.personId, row); continue; }
        if ((priority[row.role] || 0) > (priority[prior.role] || 0)) prior.role = row.role;
        if (row.attendance === "attended" || (prior.attendance !== "attended" && row.attendance === "unconfirmed")) {
          prior.attendance = row.attendance;
        }
      }
      return [...merged.values()];
    });
}

function personIds(rows) {
  return [...new Set((Array.isArray(rows) ? rows : []).map(row => text(row && row.personId)).filter(Boolean))];
}

async function markCarPlayed(db, actor, carId, attendanceMap = {}) {
  if (!actor?.manager && !actor?.id) throw Object.assign(new Error("manager_required"), { statusCode: 403 });
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(text(carId))) throw Object.assign(new Error("car_id_invalid"), { statusCode: 400 });

  const carRef = db.collection("cars").doc(carId);
  const detailRef = db.collection("carDetailViews").doc(carId);
  return db.runTransaction(async tx => {
    const carSnap = await tx.get(carRef);
    const detailSnap = await tx.get(detailRef);
    if (!carSnap.exists || !detailSnap.exists) throw Object.assign(new Error("car_not_found"), { statusCode: 404 });
    const car = carSnap.data() || {};
    const prepared = detailSnap.data() || {};
    const detail = prepared.car || {};
    const txReadCache = new Map();
    const readDoc = async ref => {
      if (!txReadCache.has(ref.path)) txReadCache.set(ref.path, await tx.get(ref));
      return txReadCache.get(ref.path);
    };
    const resolvePerson = canonicalResolver(db, readDoc);
    if (!await isCarManager(db, actor, car, resolvePerson)) {
      throw Object.assign(new Error("manager_required"), { statusCode: 403 });
    }
    const carStatus = text(car.status || car.carStatus).toLowerCase();
    if (["cancelled", "canceled", "已取消", "取消", "deleted", "removed"].includes(carStatus)) {
      throw Object.assign(new Error("car_not_playable"), { statusCode: 409 });
    }
    if (!["ended", "completed", "closed", "已結束", "已完成"].includes(carStatus)) {
      throw Object.assign(new Error("car_not_ended"), { statusCode: 409 });
    }

    const inputRoster = carParticipantIds({ ...detail, ...car });
    const participants = await mergeCarParticipants(inputRoster, resolvePerson);
    const attendanceByCanonical = new Map();
    const attendanceEntries = Object.entries(attendanceMap || {});
    if (attendanceEntries.length > maxParticipants) {
      throw Object.assign(new Error("attendance_map_invalid"), { statusCode: 400 });
    }
    const currentParticipantIds = new Set(participants.map(person => person.personId));
    for (const [personId, attendance] of attendanceEntries) {
      attendanceByCanonical.set((await resolvePerson(personId)).id, attendanceOf(attendance));
    }
    for (const person of participants) {
      if (currentParticipantIds.has(person.personId) && attendanceByCanonical.has(person.personId)) {
        person.attendance = attendanceByCanonical.get(person.personId);
      }
    }
    if (!participants.length) throw Object.assign(new Error("car_has_no_participants"), { statusCode: 409 });

    const session = Core.prepareSession({
      id: `car:${carId}`,
      sourceType: "car",
      carId,
      scriptName: text(car.scriptName || detail.scriptName),
      date: text(car.gameDate || car.date || detail.gameDate),
      time: text(car.gameTime || car.time || detail.gameTime),
      place: text(car.location || car.address || car.place || detail.location),
      status: "completed",
      participants,
      updatedAt: new Date().toISOString()
    });

    const previousParticipants = Array.isArray(car.playRecordParticipants)
      ? car.playRecordParticipants : [];
    // Keep legacy/raw IDs so any stale pre-merge view is cleared, and also
    // include their current canonical targets so the shared session lands on
    // exactly the current Person View after an alias is re-homed.
    const previousCanonicalIds = await Promise.all(previousParticipants.map(person => resolvePerson(person.personId)));
    const affectedIds = [...new Set([
      ...personIds(previousParticipants),
      ...previousCanonicalIds.map(person => person.id),
      ...participants.map(person => person.personId)
    ])];
    const refs = affectedIds.map(id => db.collection("personPlayHistoryViews").doc(id));
    const snapshots = [];
    for (const ref of refs) snapshots.push(await tx.get(ref));

    const updates = [];
    for (let index = 0; index < affectedIds.length; index++) {
      const personId = affectedIds[index];
      const oldView = snapshots[index].exists ? snapshots[index].data() : null;
      if (oldView && !Core.validatePersonView(oldView, personId)) {
        throw Object.assign(new Error("person_view_invalid"), { statusCode: 409 });
      }
      // applySessionToPersonView removes the old card first, then adds it back only for current participants.
      updates.push(Core.applySessionToPersonView(personId, oldView, session, (oldView?.revision || 0) + 1));
    }

    const now = new Date().toISOString();
    const playRecordAttendance = Object.fromEntries(participants.map(person => [person.personId, person.attendance]));
    const playRecordParticipants = participants.map(person => ({ ...person }));
    tx.update(carRef, {
      playRecordStatus: "completed",
      playRecordAttendance,
      playRecordParticipants,
      playRecordUpdatedAt: now
    });
    tx.set(detailRef, {
      ...prepared,
      car: {
        ...detail,
        playRecordStatus: "completed",
        playRecordAttendance,
        playRecordParticipants,
        playRecordUpdatedAt: now
      },
      sourceUpdatedAt: now,
      builtAt: now
    }, { merge: false });
    for (let index = 0; index < refs.length; index++) tx.set(refs[index], updates[index]);
    return { sessionId: session.id, source: "cars", participants: participants.length, viewsUpdated: affectedIds.length };
  });
}

async function canonicalRosterForRead(db, rows) {
  const resolvePerson = canonicalResolver(db);
  const byPerson = new Map();
  const rolePriority = { player: 1, npc: 2, dm: 3, host: 4 };
  for (const person of rows) {
    const canonical = await resolvePerson(person.personId);
    const prior = byPerson.get(canonical.id);
    if (prior) {
      if ((rolePriority[person.role] || 0) > (rolePriority[prior.role] || 0)) prior.role = person.role;
      if (person.attendance === "attended") prior.attendance = "attended";
      continue;
    }
    byPerson.set(canonical.id, {
      personId: canonical.id,
      role: person.role,
      attendance: person.attendance,
      displayName: text(canonical.profile.displayName || canonical.profile.nickname || canonical.profile.playerName)
    });
  }
  return [...byPerson.values()];
}

async function authorizedSession(db, actor, id) {
  if (String(id).startsWith("hist:")) {
    const session = await getHistoricalSession(db, id);
    if (!session) return { session: null, participants: [] };
    // Historical Source of Truth may still contain a legacy Person ID after
    // an independently approved Person merge. Canonicalize on this bounded
    // detail read, not by scanning or rewriting historical collections.
    const participants = await canonicalRosterForRead(db, session.participants);
    const actualParticipant = session.status === "completed" && participants.some(person =>
      person.personId === actor.id && person.attendance === "attended");
    if (!actualParticipant && !actor.manager) {
      throw Object.assign(new Error("session_access_denied"), { statusCode: 403 });
    }
    const normalizedSession = Core.prepareSession({
      ...session,
      participants: participants.map(({ displayName, ...person }) => person)
    });
    return { session: normalizedSession, participants };
  }

  if (String(id).startsWith("car:")) {
    const carId = String(id).slice(4);
    const car = await getCarDetail(db, carId);
    if (!car) throw Object.assign(new Error("car_not_found"), { statusCode: 404 });
    const rosterSource = Array.isArray(car.playRecordParticipants) ? car.playRecordParticipants : carParticipantIds(car);
    const participants = await canonicalRosterForRead(db, rosterSource);
    const actualParticipant = participants.some(person =>
      person.personId === actor.id && person.attendance === "attended");
    const completed = car.playRecordStatus === "completed";
    let canManage = actor.manager === true;
    if (!canManage && (!completed || !actualParticipant)) {
      const sourceSnap = await db.collection("cars").doc(carId).get();
      canManage = sourceSnap.exists && await isCarManager(db, actor, sourceSnap.data() || {});
    }
    if (!(completed && actualParticipant) && !canManage) {
      throw Object.assign(new Error("session_access_denied"), { statusCode: 403 });
    }
    const session = Core.prepareSession({
      id: `car:${carId}`,
      sourceType: "car",
      carId,
      scriptName: text(car.scriptName),
      date: text(car.gameDate || car.date),
      time: text(car.gameTime || car.time),
      place: text(car.location || car.address || car.place),
      status: completed ? "completed" : "scheduled",
      participants: participants.map(({ displayName, ...person }) => person)
    });
    return { session, participants };
  }

  throw Object.assign(new Error("session_id_invalid"), { statusCode: 400 });
}

const endedCarStatuses = new Set(["ended", "completed", "closed", "已結束", "已完成"]);
const cancelledCarStatuses = new Set(["cancelled", "canceled", "已取消", "取消", "deleted", "removed"]);

async function getMyEndedCars(db, actor) {
  // Explicit user action only. Resolve at most eight authenticated Person aliases
  // through existing MyCar Prepared Views; never query/scans cars or players here.
  const ids = [...new Set([actor.id, ...(actor.aliases || [])].map(text).filter(id =>
    /^[A-Za-z0-9_-]{6,128}$/.test(id)))].slice(0, 8);
  const allowed = new Set(ids), loaded = new Set(), views = [];
  const load = async viewerId => {
    if (!viewerId || loaded.has(viewerId) || !/^[A-Za-z0-9_-]{6,128}$/.test(viewerId)) return;
    loaded.add(viewerId);
    const snap = await db.collection("myCarViews").doc(viewerId).get();
    if (!snap.exists) return;
    const data = snap.data() || {};
    if (data.viewType !== "mycar_index" || text(data.viewerId) !== viewerId || !Array.isArray(data.cars)) return;
    // Alias routes cannot grant access to unrelated viewers' Prepared Views.
    if (!allowed.has(viewerId) && !(Array.isArray(data.identityIds) &&
      data.identityIds.some(id => allowed.has(text(id))))) return;
    views.push(data);
  };
  for (const id of ids) await load(id);
  if (!views.length) {
    for (const id of ids) {
      const alias = await db.collection("myCarViewAliases").doc(id).get();
      if (!alias.exists) continue;
      await load(text((alias.data() || {}).viewerId));
    }
  }
  const byId = new Map();
  for (const view of views) {
    for (const car of view.cars) {
      const carId = text(car && (car.id || car.carId));
      const status = text(car && car.status).toLowerCase();
      const isHost = car && car.isHost === true;
      const ownerMatches = allowed.has(text(car && car.ownerId));
      if (!/^[A-Za-z0-9_-]{4,128}$/.test(carId) || cancelledCarStatuses.has(status) ||
          !endedCarStatuses.has(status) || (!isHost && !ownerMatches)) continue;
      byId.set(carId, {
        carId, scriptName: text(car.scriptName), gameDate: text(car.gameDate),
        gameTime: text(car.gameTime)
      });
    }
  }
  const all = [...byId.values()].sort((a, b) =>
    b.gameDate.localeCompare(a.gameDate) || a.scriptName.localeCompare(b.scriptName));
  return { cars: all.slice(0, 120), hasPreparedView: views.length > 0 };
}

async function peopleForManager(db, actor) {
  if (!actor?.manager) throw Object.assign(new Error("manager_required"), { statusCode: 403 });
  const snap = await db.collection("personDirectoryViews").doc("canonical").get();
  if (!snap.exists) return [];
  const rows = Array.isArray(snap.data()?.people) ? snap.data().people : [];
  return rows
    .filter(person => person && person.id && person.canonicalPersonId === person.id && !["merged", "deleted", "removed"].includes(text(person.status).toLowerCase()))
    .map(person => ({
      id: text(person.id),
      displayName: text(person.displayName || person.nickname || person.playerName),
      memberType: text(person.memberType || person.type),
      identityStatus: text(person.identityStatus)
    }));
}

module.exports = {
  maxParticipants, roleOf, attendanceOf, canonicalResolver, normalizeParticipants, makeAdapter,
  createOrUpdateHistorical, getPersonView, getHistoricalSession, getCarDetail, isCarManager,
  carParticipantIds, markCarPlayed, authorizedSession, peopleForManager, getCarRosterForManager, getMyEndedCars
};
