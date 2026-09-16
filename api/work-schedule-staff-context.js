"use strict";

const crypto = require("crypto");
const { getFirestore } = require("../services/firebase/admin");
const {
  readCookie,
  verifyMemberSession
} = require("../services/line/member-session");

const text = value => String(value || "").trim();
const normalizedName = value => text(value).replace(/\s+/g, "").toLocaleLowerCase("zh-Hant");

function send(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function addId(set, value) {
  const id = text(value);
  if (id) set.add(id);
}

function rolePersonIds(work) {
  const ids = new Set();
  const roles = Array.isArray(work && work.roles) ? work.roles : [];
  for (const role of roles) {
    for (const id of (role.eligiblePersonIds || role.personIds || [])) addId(ids, id);
    for (const slot of (Array.isArray(role.staffSlots) ? role.staffSlots : [])) addId(ids, slot && slot.personId);
  }
  return ids;
}

function shiftPersonIds(row) {
  const ids = new Set();
  for (const id of (row.assignedPersonIds || row.personIds || [])) addId(ids, id);
  for (const slot of (Array.isArray(row.staffSlots) ? row.staffSlots : [])) addId(ids, slot && slot.personId);
  for (const person of (Array.isArray(row.people) ? row.people : [])) {
    addId(ids, person && (person.personId || person.id));
  }
  return ids;
}

function intersects(a, b) {
  for (const value of a) if (b.has(value)) return true;
  return false;
}

function sanitizeRow(doc, candidateIds) {
  const row = doc.data() || {};
  const assigned = shiftPersonIds(row);
  return {
    id: doc.id,
    workId: text(row.workId),
    workName: text(row.workName),
    studioName: text(row.studioName),
    hostName: text(row.hostName),
    roleName: text(row.roleName),
    date: text(row.date),
    monthKey: text(row.monthKey || text(row.date).slice(0, 7)),
    startTime: text(row.startTime),
    endTime: text(row.endTime),
    endDate: text(row.endDate || row.date),
    note: text(row.note),
    status: text(row.status || "scheduled"),
    people: (Array.isArray(row.people) ? row.people : []).map(person => ({
      personId: text(person && (person.personId || person.id)),
      name: text(person && person.name)
    })),
    assignedPersonIds: [...assigned],
    isMine: intersects(assigned, candidateIds)
  };
}

async function resolveCandidateIds(db, session) {
  const ids = new Set();
  addId(ids, session.profileId);
  addId(ids, session.identityId);

  if (session.profileId && !String(session.profileId).startsWith("line:")) {
    const profile = await db.collection("players").doc(session.profileId).get();
    if (profile.exists) {
      const data = profile.data() || {};
      addId(ids, profile.id);
      addId(ids, data.identityId);
      addId(ids, data.playerId);
      addId(ids, data.personId);
      for (const id of (data.linkedPlayerIds || [])) addId(ids, id);
    }
  }

  if (session.lineUserId) {
    const linked = await db.collection("players")
      .where("lineUserId", "==", session.lineUserId)
      .limit(2)
      .get();
    for (const doc of linked.docs) {
      const data = doc.data() || {};
      addId(ids, doc.id);
      addId(ids, data.identityId);
      addId(ids, data.playerId);
      addId(ids, data.personId);
      for (const id of (data.linkedPlayerIds || [])) addId(ids, id);
    }
  }

  return ids;
}

function membershipDocId(studioName, personId) {
  return crypto.createHash("sha256").update(`${studioName}:${personId}`).digest("hex").slice(0, 40);
}

async function findMembership(db, studioName, candidateIds) {
  for (const personId of candidateIds) {
    const doc = await db.collection("studioMemberships").doc(membershipDocId(studioName, personId)).get();
    if (doc.exists && text((doc.data() || {}).status || "active") === "active") return doc.data() || {};
  }
  return null;
}

function uniqueScheduleNameMatch(shiftsSnapshot, displayName) {
  const wanted = normalizedName(displayName);
  if (!wanted) return null;
  const matches = new Map();
  for (const doc of shiftsSnapshot.docs) {
    const row = doc.data() || {};
    for (const person of (Array.isArray(row.people) ? row.people : [])) {
      const personId = text(person && (person.personId || person.id));
      if (personId && normalizedName(person && person.name) === wanted) matches.set(personId, text(person && person.name));
    }
    for (const slot of (Array.isArray(row.staffSlots) ? row.staffSlots : [])) {
      const personId = text(slot && slot.personId);
      if (personId && normalizedName(slot && (slot.name || slot.personName)) === wanted) matches.set(personId, text(slot && (slot.name || slot.personName)));
    }
  }
  return matches.size === 1 ? { personId: [...matches.keys()][0], name: [...matches.values()][0] } : null;
}

async function persistMigratedMembership(db, studioName, candidateIds, scheduleMatch, session) {
  const canonicalPersonId = text(session.profileId) && !String(session.profileId).startsWith("line:")
    ? text(session.profileId)
    : [...candidateIds][0];
  if (!canonicalPersonId || !scheduleMatch || !scheduleMatch.personId) return null;
  const aliases = new Set(candidateIds);
  aliases.add(scheduleMatch.personId);
  const data = {
    studioName,
    personId: canonicalPersonId,
    schedulePersonId: scheduleMatch.personId,
    personIds: [...aliases],
    displayName: text(session.displayName || scheduleMatch.name),
    status: "active",
    source: "schedule_identity_bridge",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  await db.collection("studioMemberships").doc(membershipDocId(studioName, canonicalPersonId)).set(data, { merge: true });
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { success: false, error: "method_not_allowed" });
  }

  const secret = text(process.env.LINE_CHANNEL_SECRET);
  const verified = verifyMemberSession(readCookie(req), secret);
  if (!verified.valid) return send(res, 401, { success: false, error: "line_login_required" });

  const studioName = text(req.query && req.query.studio);
  if (!studioName) return send(res, 400, { success: false, error: "studio_required" });

  try {
    const db = getFirestore();
    const session = verified.data || {};
    const candidateIds = await resolveCandidateIds(db, session);
    if (!candidateIds.size || session.provisional === true) {
      return send(res, 403, { success: false, error: "person_link_required", lineVerified: true });
    }

    const [worksSnapshot, shiftsSnapshot] = await Promise.all([
      db.collection("workScheduleWorks").where("studioName", "==", studioName).get(),
      db.collection("workShifts").where("studioName", "==", studioName).get()
    ]);

    const memberIds = new Set();
    for (const doc of worksSnapshot.docs) for (const id of rolePersonIds(doc.data() || {})) memberIds.add(id);
    for (const doc of shiftsSnapshot.docs) for (const id of shiftPersonIds(doc.data() || {})) memberIds.add(id);

    let membership = await findMembership(db, studioName, candidateIds);
    if (membership) for (const id of (membership.personIds || [membership.personId, membership.schedulePersonId])) addId(candidateIds, id);

    if (!membership && !intersects(candidateIds, memberIds)) {
      const scheduleMatch = uniqueScheduleNameMatch(shiftsSnapshot, session.displayName);
      if (scheduleMatch) {
        membership = await persistMigratedMembership(db, studioName, candidateIds, scheduleMatch, session);
        if (membership) for (const id of membership.personIds) addId(candidateIds, id);
      }
    }

    if (!membership && !intersects(candidateIds, memberIds)) {
      return send(res, 403, { success: false, error: "not_studio_member", lineVerified: true });
    }

    const rows = shiftsSnapshot.docs
      .map(doc => sanitizeRow(doc, candidateIds))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.workName.localeCompare(b.workName, "zh-Hant"));
    const cancelledOwnRows = rows.filter(row => row.status === "cancelled" && row.isMine);

    return send(res, 200, {
      success: true,
      studioName,
      displayName: text(session.displayName),
      membershipSource: membership ? text(membership.source || "studio_membership") : "schedule",
      rows: rows.filter(row => row.status !== "cancelled"),
      cancelledOwnShiftIds: cancelledOwnRows.map(row => row.id),
      cancelledOwnRows
    });
  } catch (error) {
    console.error("Work Schedule staff context failed.", error);
    return send(res, 500, { success: false, error: error.message || "work_schedule_staff_context_failed" });
  }
};
