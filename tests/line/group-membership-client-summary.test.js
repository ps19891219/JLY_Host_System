"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getGroupSummary } = require("../../services/line/group-membership-client");

test("getGroupSummary reads the LINE group name without mutating membership state", async function () {
  let requestedUrl = "";
  const summary = await getGroupSummary("group/with space", {
    accessToken: "test-token",
    fetch: async url => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({
          groupId: "group/with space",
          groupName: "金粉",
          pictureUrl: "https://example.com/group.jpg"
        })
      };
    }
  });

  assert.equal(requestedUrl, "https://api.line.me/v2/bot/group/group%2Fwith%20space/summary");
  assert.equal(summary.groupName, "金粉");
  assert.equal(summary.groupId, "group/with space");
});

test("getGroupSummary surfaces LINE failures to the diagnostic caller", async function () {
  await assert.rejects(
    () => getGroupSummary("group-1", {
      accessToken: "test-token",
      fetch: async () => ({ ok: false, status: 404 })
    }),
    /line_group_membership_failed_404/
  );
});
