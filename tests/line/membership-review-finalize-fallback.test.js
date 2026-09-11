"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyMembershipSnapshot } = require("../../services/line/group-membership-health-service");

test("verified snapshot remains successful when pending action cleanup fails", async () => {
  let stored = { carId: "C1", status: "needs_review", membershipRevision: 4, lineMemberCount: 6 };
  const result = await verifyMembershipSnapshot(
    { groupId: "G1", carId: "C1", verifiedBy: "P1", playerCount: 5 },
    {
      now: () => "2026-09-11T06:40:00.000Z",
      getSnapshot: async () => stored,
      saveSnapshot: async (_groupId, patch) => {
        stored = { ...stored, ...patch };
        return stored;
      },
      completePendingAction: async () => {
        throw new Error("pending_action_write_failed");
      }
    }
  );

  assert.equal(result.verified, true);
  assert.equal(result.pendingActionCompleted, false);
  assert.equal(result.reason, "snapshot_verified_pending_action_cleanup_failed");
  assert.equal(stored.status, "verified");
  assert.equal(stored.verifiedPlayerCount, 5);
});
