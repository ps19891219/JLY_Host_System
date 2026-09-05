"use strict";

const { getSnapshot, saveSnapshot, savePendingAction, completePendingAction } = require("../firebase/line-group-membership-repository");
const { getGroupMemberCount, listGroupMemberIds } = require("./group-membership-client");
const ACTION_ID = "line_membership_review";
function text(value) { return String(value == null ? "" : value).trim(); }
function nowIso(dependencies) { return dependencies && dependencies.now ? dependencies.now() : new Date().toISOString(); }
function unique(values) { return Array.from(new Set((values || []).map(text).filter(Boolean))); }
function carDateValue(car) { return text(car && (car.date || car.gameDate || car.startDate || car.activityDate)); }
function isCarExpired(car, now = new Date()) {
  if (!car) return true;
  const status = text(car.status || car.carStatus).toLowerCase();
  if (["ended", "completed", "cancelled", "canceled", "deleted", "closed", "已完成", "已取消", "已結束"].includes(status)) return true;
  const raw = carDateValue(car);
  if (!raw) return false;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59+08:00` : raw);
  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
}
function memberIdsFromEvent(members) { return unique((members || []).map(member => member && member.userId)); }
function buildPendingAction(input) {
  const timestamp = input.timestamp;
  return {
    pendingActionId: ACTION_ID,
    actionType: "line_membership_review",
    responsiblePersonId: text(input.ownerId),
    activityId: text(input.carId), carId: text(input.carId), groupId: text(input.groupId),
    status: "pending",
    targetUrl: `/pages/line-membership-review.html?carId=${encodeURIComponent(text(input.carId))}&groupId=${encodeURIComponent(text(input.groupId))}`,
    title: "LINE 群組名單待核對", updatedAt: timestamp, createdAt: text(input.createdAt) || timestamp
  };
}
async function markMembershipChanged(input, dependencies = {}) {
  const groupId = text(input.groupId), carId = text(input.carId), car = input.car;
  if (!groupId || !carId || !car) return { changed: false, reason: "context_missing" };
  if (isCarExpired(car, dependencies.currentDate ? dependencies.currentDate() : new Date())) return { changed: false, reason: "car_expired" };
  const read = dependencies.getSnapshot || getSnapshot, save = dependencies.saveSnapshot || saveSnapshot;
  const saveAction = dependencies.savePendingAction || savePendingAction;
  const previous = await read(groupId), timestamp = nowIso(dependencies);
  const pendingJoined = unique([...(previous && previous.pendingJoinedUserIds || []), ...memberIdsFromEvent(input.joinedMembers)]);
  const pendingLeft = unique([...(previous && previous.pendingLeftUserIds || []), ...memberIdsFromEvent(input.leftMembers)]);
  const revision = Math.max(0, Number(previous && previous.membershipRevision) || 0) + 1;
  const stored = await save(groupId, {
    carId, ownerId: text(car.ownerId), status: "needs_review", membershipRevision: revision,
    pendingJoinedUserIds: pendingJoined, pendingLeftUserIds: pendingLeft,
    lastEventType: text(input.eventType), lastEventAt: timestamp, updatedAt: timestamp,
    createdAt: text(previous && previous.createdAt) || timestamp,
    verifiedAt: text(previous && previous.verifiedAt), verifiedBy: text(previous && previous.verifiedBy),
    verifiedMembershipRevision: Number(previous && previous.verifiedMembershipRevision) || 0,
    verifiedLineMemberCount: Number(previous && previous.verifiedLineMemberCount) || 0,
    verifiedPlayerCount: Number(previous && previous.verifiedPlayerCount) || 0
  });
  await saveAction(carId, buildPendingAction({ carId, groupId, ownerId: car.ownerId, timestamp, createdAt: previous && previous.reviewCreatedAt }));
  return { changed: true, reason: "membership_changed", snapshot: stored };
}
async function initializeMembershipSnapshot(input, dependencies = {}) {
  const groupId = text(input.groupId), carId = text(input.carId), car = input.car;
  if (!groupId || !carId || !car) return { initialized: false, reason: "context_missing" };
  if (isCarExpired(car, dependencies.currentDate ? dependencies.currentDate() : new Date())) return { initialized: false, reason: "car_expired" };
  const read = dependencies.getSnapshot || getSnapshot, previous = await read(groupId);
  if (previous && ["verified", "needs_review"].includes(text(previous.status))) return { initialized: false, reason: "snapshot_exists", snapshot: previous };
  const countMembers = dependencies.getGroupMemberCount || getGroupMemberCount;
  const listIds = dependencies.listGroupMemberIds || listGroupMemberIds;
  const save = dependencies.saveSnapshot || saveSnapshot, saveAction = dependencies.savePendingAction || savePendingAction;
  const timestamp = nowIso(dependencies);

  const count = await countMembers(groupId);
  let ids = [];
  let memberIdsStatus = "available";
  let memberIdsError = "";
  try {
    ids = await listIds(groupId);
  } catch (error) {
    memberIdsStatus = "unavailable";
    memberIdsError = text(error && error.message).slice(0, 160);
  }

  const stored = await save(groupId, {
    carId, ownerId: text(car.ownerId), status: "needs_review", lineMemberCount: count,
    lineUserIds: unique(ids), lineMemberIdsStatus: memberIdsStatus, lineMemberIdsError: memberIdsError,
    membershipRevision: 1, pendingJoinedUserIds: [], pendingLeftUserIds: [], initializedAt: timestamp, updatedAt: timestamp,
    createdAt: text(previous && previous.createdAt) || timestamp
  });
  await saveAction(carId, buildPendingAction({ carId, groupId, ownerId: car.ownerId, timestamp }));
  return {
    initialized: true,
    reason: memberIdsStatus === "available" ? "snapshot_initialized" : "snapshot_initialized_count_only",
    snapshot: stored
  };
}
async function verifyMembershipSnapshot(input, dependencies = {}) {
  const groupId = text(input.groupId), carId = text(input.carId);
  const read = dependencies.getSnapshot || getSnapshot, save = dependencies.saveSnapshot || saveSnapshot;
  const complete = dependencies.completePendingAction || completePendingAction, previous = await read(groupId);
  if (!previous || text(previous.carId) !== carId) return { verified: false, reason: "snapshot_not_found" };
  const timestamp = nowIso(dependencies);
  const stored = await save(groupId, {
    status: "verified",
    verifiedAt: timestamp,
    verifiedBy: text(input.verifiedBy),
    verifiedMembershipRevision: Number(previous.membershipRevision) || 0,
    verifiedLineMemberCount: Number(previous.lineMemberCount) || 0,
    verifiedPlayerCount: Math.max(0, Number(input.playerCount) || 0),
    pendingJoinedUserIds: [], pendingLeftUserIds: [], updatedAt: timestamp
  });
  await complete(carId, ACTION_ID, timestamp);
  return { verified: true, reason: "snapshot_verified", snapshot: stored };
}
module.exports = { ACTION_ID, isCarExpired, buildPendingAction, markMembershipChanged, initializeMembershipSnapshot, verifyMembershipSnapshot };