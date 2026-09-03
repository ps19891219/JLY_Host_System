"use strict";

const {
  getSnapshot,
  saveSnapshot,
  savePendingAction,
  completePendingAction
} = require("../firebase/line-group-membership-repository");
const {
  getGroupMemberCount,
  listGroupMemberIds
} = require("./group-membership-client");

const ACTION_ID = "line_membership_review";

function text(value) { return String(value == null ? "" : value).trim(); }
function nowIso(dependencies) {
  return dependencies && dependencies.now ? dependencies.now() : new Date().toISOString();
}
function unique(values) {
  return Array.from(new Set((values || []).map(text).filter(Boolean)));
}

function carDateValue(car) {
  return text(car && (car.date || car.startDate || car.activityDate));
}

function isCarExpired(car, now = new Date()) {
  if (!car) return true;
  const status = text(car.status || car.carStatus).toLowerCase();
  if (["ended", "completed", "cancelled", "canceled", "deleted", "closed"].includes(status)) return true;
  const raw = carDateValue(car);
  if (!raw) return false;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59+08:00` : raw);
  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
}

function memberIdsFromEvent(members) {
  return unique((members || []).map(member => member && member.userId));
}

function buildPendingAction(input) {
  const timestamp = input.timestamp;
  return {
    pendingActionId: ACTION_ID,
    actionType: "line_membership_review",
    responsiblePersonId: text(input.ownerId),
    activityId: text(input.carId),
    carId: text(input.carId),
    groupId: text(input.groupId),
    status: "pending",
    targetUrl: `/pages/line-membership-review.html?carId=${encodeURIComponent(text(input.carId))}&groupId=${encodeURIComponent(text(input.groupId))}`,
    title: "LINE 群組名單待核對",
    updatedAt: timestamp,
    createdAt: text(input.createdAt) || timestamp
  };
}

async function markMembershipChanged(input, dependencies = {}) {
  const groupId = text(input.groupId);
  const carId = text(input.carId);
  const car = input.car;
  if (!groupId || !carId || !car) return { changed: false, reason: "context_missing" };
  if (isCarExpired(car, dependencies.currentDate ? dependencies.currentDate() : new Date())) {
    return { changed: false, reason: "car_expired" };
  }
  const read = dependencies.getSnapshot || getSnapshot;
  const save = dependencies.saveSnapshot || saveSnapshot;
  const saveAction = dependencies.savePendingAction || savePendingAction;
  const previous = await read(groupId);
  const timestamp = nowIso(dependencies);
  const joined = memberIdsFromEvent(input.joinedMembers);
  const left = memberIdsFromEvent(input.leftMembers);
  const pendingJoined = unique([...(previous && previous.pendingJoinedUserIds || []), ...joined]);
  const pendingLeft = unique([...(previous && previous.pendingLeftUserIds || []), ...left]);
  const revision = Math.max(0, Number(previous && previous.membershipRevision) || 0) + 1;
  const stored = await save(groupId, {
    carId,
    status: "needs_review",
    membershipRevision: revision,
    pendingJoinedUserIds: pendingJoined,
    pendingLeftUserIds: pendingLeft,
    lastEventType: text(input.eventType),
    lastEventAt: timestamp,
    updatedAt: timestamp,
    createdAt: text(previous && previous.createdAt) || timestamp,
    verifiedAt: text(previous && previous.verifiedAt),
    verifiedBy: text(previous && previous.verifiedBy)
  });
  await saveAction(carId, buildPendingAction({
    carId,
    groupId,
    ownerId: car.ownerId,
    timestamp,
    createdAt: previous && previous.reviewCreatedAt
  }));
  return { changed: true, reason: "membership_changed", snapshot: stored };
}

async function initializeMembershipSnapshot(input, dependencies = {}) {
  const groupId = text(input.groupId);
  const carId = text(input.carId);
  const car = input.car;
  if (!groupId || !carId || !car) return { initialized: false, reason: "context_missing" };
  if (isCarExpired(car, dependencies.currentDate ? dependencies.currentDate() : new Date())) {
    return { initialized: false, reason: "car_expired" };
  }
  const read = dependencies.getSnapshot || getSnapshot;
  const previous = await read(groupId);
  if (previous && ["verified", "needs_review"].includes(text(previous.status))) {
    return { initialized: false, reason: "snapshot_exists", snapshot: previous };
  }
  const countMembers = dependencies.getGroupMemberCount || getGroupMemberCount;
  const listIds = dependencies.listGroupMemberIds || listGroupMemberIds;
  const save = dependencies.saveSnapshot || saveSnapshot;
  const saveAction = dependencies.savePendingAction || savePendingAction;
  const timestamp = nowIso(dependencies);
  const [count, ids] = await Promise.all([countMembers(groupId), listIds(groupId)]);
  const stored = await save(groupId, {
    carId,
    status: "needs_review",
    lineMemberCount: count,
    lineUserIds: unique(ids),
    membershipRevision: 1,
    pendingJoinedUserIds: [],
    pendingLeftUserIds: [],
    initializedAt: timestamp,
    updatedAt: timestamp,
    createdAt: text(previous && previous.createdAt) || timestamp
  });
  await saveAction(carId, buildPendingAction({ carId, groupId, ownerId: car.ownerId, timestamp }));
  return { initialized: true, reason: "snapshot_initialized", snapshot: stored };
}

async function verifyMembershipSnapshot(input, dependencies = {}) {
  const groupId = text(input.groupId);
  const carId = text(input.carId);
  const read = dependencies.getSnapshot || getSnapshot;
  const save = dependencies.saveSnapshot || saveSnapshot;
  const complete = dependencies.completePendingAction || completePendingAction;
  const previous = await read(groupId);
  if (!previous || text(previous.carId) !== carId) return { verified: false, reason: "snapshot_not_found" };
  const timestamp = nowIso(dependencies);
  const stored = await save(groupId, {
    status: "verified",
    verifiedAt: timestamp,
    verifiedBy: text(input.verifiedBy),
    pendingJoinedUserIds: [],
    pendingLeftUserIds: [],
    updatedAt: timestamp
  });
  await complete(carId, ACTION_ID, timestamp);
  return { verified: true, reason: "snapshot_verified", snapshot: stored };
}

module.exports = {
  ACTION_ID,
  isCarExpired,
  buildPendingAction,
  markMembershipChanged,
  initializeMembershipSnapshot,
  verifyMembershipSnapshot
};
