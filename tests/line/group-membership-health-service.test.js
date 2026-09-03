"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isCarExpired,
  markMembershipChanged,
  initializeMembershipSnapshot,
  verifyMembershipSnapshot
} = require("../../services/line/group-membership-health-service");
const {
  processMembershipEvent
} = require("../../services/line/group-membership-event-service");

const NOW = "2026-09-03T01:00:00.000Z";

function memoryDependencies(seed = null) {
  let snapshot = seed;
  let action = null;
  return {
    now: () => NOW,
    currentDate: () => new Date(NOW),
    getSnapshot: async () => snapshot,
    saveSnapshot: async (_groupId, patch) => {
      snapshot = { ...(snapshot || {}), ...patch };
      return snapshot;
    },
    savePendingAction: async (_carId, next) => { action = next; return next; },
    completePendingAction: async () => { action = { ...(action || {}), status: "completed" }; },
    inspect: () => ({ snapshot, action })
  };
}

test("expired or ended cars are skipped before LINE membership work", async () => {
  assert.equal(isCarExpired({ status: "ended", date: "2026-09-10" }, new Date(NOW)), true);
  assert.equal(isCarExpired({ status: "active", date: "2026-09-02" }, new Date(NOW)), true);
  const deps = memoryDependencies();
  let countCalls = 0;
  const result = await initializeMembershipSnapshot({
    groupId: "G1", carId: "C1", car: { status: "ended", ownerId: "P1" }
  }, { ...deps, getGroupMemberCount: async () => { countCalls += 1; return 8; } });
  assert.equal(result.reason, "car_expired");
  assert.equal(countCalls, 0);
});

test("first binding initializes only that group and creates review action", async () => {
  const deps = memoryDependencies();
  const result = await initializeMembershipSnapshot({
    groupId: "G1", carId: "C1", car: { status: "active", date: "2026-09-10", ownerId: "P1" }
  }, {
    ...deps,
    getGroupMemberCount: async groupId => { assert.equal(groupId, "G1"); return 8; },
    listGroupMemberIds: async () => ["U1", "U2"]
  });
  assert.equal(result.initialized, true);
  const state = deps.inspect();
  assert.equal(state.snapshot.status, "needs_review");
  assert.equal(state.snapshot.lineMemberCount, 8);
  assert.deepEqual(state.snapshot.lineUserIds, ["U1", "U2"]);
  assert.equal(state.action.actionType, "line_membership_review");
  assert.match(state.action.targetUrl, /carId=C1/);
});

test("join and leave invalidate verified snapshot even when net count is unchanged", async () => {
  const deps = memoryDependencies({
    carId: "C1", status: "verified", membershipRevision: 7,
    lineMemberCount: 8, verifiedAt: "2026-09-01T00:00:00.000Z"
  });
  await markMembershipChanged({
    eventType: "memberJoined", groupId: "G1", carId: "C1",
    car: { status: "active", date: "2026-09-10", ownerId: "P1" },
    joinedMembers: [{ userId: "U_NEW" }]
  }, deps);
  await markMembershipChanged({
    eventType: "memberLeft", groupId: "G1", carId: "C1",
    car: { status: "active", date: "2026-09-10", ownerId: "P1" },
    leftMembers: [{ userId: "U_OLD" }]
  }, deps);
  const state = deps.inspect();
  assert.equal(state.snapshot.status, "needs_review");
  assert.equal(state.snapshot.lineMemberCount, 8);
  assert.deepEqual(state.snapshot.pendingJoinedUserIds, ["U_NEW"]);
  assert.deepEqual(state.snapshot.pendingLeftUserIds, ["U_OLD"]);
  assert.equal(state.snapshot.membershipRevision, 9);
});

test("verification clears deltas and completes the same pending action", async () => {
  const deps = memoryDependencies({
    carId: "C1", status: "needs_review", pendingJoinedUserIds: ["U2"], pendingLeftUserIds: ["U1"]
  });
  const result = await verifyMembershipSnapshot({ groupId: "G1", carId: "C1", verifiedBy: "P1" }, deps);
  assert.equal(result.verified, true);
  const state = deps.inspect();
  assert.equal(state.snapshot.status, "verified");
  assert.deepEqual(state.snapshot.pendingJoinedUserIds, []);
  assert.deepEqual(state.snapshot.pendingLeftUserIds, []);
  assert.equal(state.action.status, "completed");
});

test("webhook processor touches only the event group binding", async () => {
  const calls = [];
  const result = await processMembershipEvent({
    type: "memberJoined",
    source: { type: "group", groupId: "G_A" },
    joined: { members: [{ type: "user", userId: "U9" }] }
  }, {
    resolveGroupBinding: async groupId => {
      calls.push(["binding", groupId]);
      return { bound: true, binding: { carId: "C_A" } };
    },
    getCarById: async carId => {
      calls.push(["car", carId]);
      return { id: carId, ownerId: "P1", status: "active", date: "2026-09-10" };
    },
    markMembershipChanged: async input => {
      calls.push(["mark", input.groupId, input.carId, input.joinedMembers[0].userId]);
      return { changed: true, reason: "membership_changed" };
    }
  });
  assert.equal(result.handled, true);
  assert.deepEqual(calls, [
    ["binding", "G_A"],
    ["car", "C_A"],
    ["mark", "G_A", "C_A", "U9"]
  ]);
});
