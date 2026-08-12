"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveAccountingAuthority,
  canMutateEntry,
  isAccountingManagerLabel,
  getCarAccountingManagerIds
} = require(
  "../../services/line/accounting-authorization-service"
);

test("entry creator can mutate their own entry", function () {
  assert.deepEqual(
    canMutateEntry(
      { userId: "user-1", status: "active" },
      "user-1",
      { canManageAll: false }
    ),
    { allowed: true, reason: "entry_creator" }
  );
});

test("another member cannot mutate the entry", function () {
  assert.equal(
    canMutateEntry(
      { userId: "user-1", status: "active" },
      "user-2",
      { canManageAll: false }
    ).allowed,
    false
  );
});

test("car owner can manage every group entry", async function () {
  const authority = await resolveAccountingAuthority(
    { source: { userId: "line-owner" } },
    {
      bound: true,
      binding: { carId: "car-1" }
    },
    {
      findPlayerByLineUserId: async function () {
        return {
          id: "profile-1",
          linkedPlayerIds: ["owner-1"],
          roles: []
        };
      },
      getCarById: async function () {
        return { ownerId: "owner-1" };
      }
    }
  );

  assert.equal(authority.canManageAll, true);
  assert.equal(authority.canViewAudit, false);
  assert.equal(authority.reason, "car_owner");
});

test("legacy car owner identity can manage accounting without audit access", async function () {
  const authority = await resolveAccountingAuthority(
    { source: { userId: "line-owner" } },
    {
      bound: true,
      binding: { carId: "legacy-car" }
    },
    {
      findPlayerByLineUserId: async function () {
        return {
          id: "member-document-id",
          identityId: "legacy-owner-id",
          linkedPlayerIds: [],
          roles: []
        };
      },
      getCarById: async function () {
        return { ownerId: "legacy-owner-id" };
      }
    }
  );

  assert.equal(authority.canManageAll, true);
  assert.equal(authority.canViewAudit, false);
  assert.equal(authority.reason, "car_owner");
});

test("system admin can manage every entry", async function () {
  const authority = await resolveAccountingAuthority(
    { source: { userId: "line-admin" } },
    null,
    {
      findPlayerByLineUserId: async function () {
        return {
          id: "admin-1",
          roles: ["system_admin"]
        };
      }
    }
  );

  assert.equal(authority.canManageAll, true);
  assert.equal(authority.canViewAudit, true);
  assert.equal(authority.reason, "system_admin");
});

test("recognizes explicit car accounting management labels", function () {
  assert.equal(isAccountingManagerLabel("協辦主揪"), true);
  assert.equal(isAccountingManagerLabel("財務管理"), true);
  assert.equal(isAccountingManagerLabel("DM"), false);
  assert.equal(isAccountingManagerLabel("一般工作人員"), false);
});

test("collects manager member ids from configured staff slots", function () {
  assert.deepEqual(
    getCarAccountingManagerIds({
      ownerId: "owner-1",
      staffSlots: [
        {
          label: "財務",
          memberId: "finance-1"
        },
        {
          label: "DM",
          memberId: "dm-1"
        },
        {
          label: "協辦",
          memberSnapshot: {
            memberId: "cohost-1"
          }
        }
      ]
    }).sort(),
    ["cohost-1", "finance-1", "owner-1"].sort()
  );
});

test("configured finance staff can manage group accounting", async function () {
  const authority = await resolveAccountingAuthority(
    { source: { userId: "line-finance" } },
    {
      bound: true,
      binding: { carId: "car-1" }
    },
    {
      findPlayerByLineUserId: async function () {
        return {
          id: "profile-finance",
          linkedPlayerIds: ["finance-1"],
          roles: []
        };
      },
      getCarById: async function () {
        return {
          ownerId: "owner-1",
          staffSlots: [
            {
              label: "財務管理",
              memberId: "finance-1"
            }
          ]
        };
      }
    }
  );

  assert.equal(authority.canManageAll, true);
  assert.equal(authority.reason, "car_accounting_manager");
});
