"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { processVerifiedEvents } = require("../../api/line-webhook");

test("memberJoined reply routing runs before membership health bookkeeping", async () => {
  const order = [];
  const events = [{ type: "memberJoined", replyToken: "reply-1", source: { type: "group", groupId: "group-1" } }];

  const result = await processVerifiedEvents(events, {
    routeEvents: async received => {
      assert.equal(received, events);
      order.push("route");
      return [{ route: "member_joined_welcome" }];
    },
    processMembershipEvents: async received => {
      assert.equal(received, events);
      order.push("membership");
      return [{ reason: "membership_changed" }];
    }
  });

  assert.deepEqual(order, ["route", "membership"]);
  assert.equal(result.routeResults[0].route, "member_joined_welcome");
});

test("welcome routing completes even when membership bookkeeping is slow", async () => {
  const order = [];
  let releaseMembership;
  const membershipGate = new Promise(resolve => { releaseMembership = resolve; });

  const run = processVerifiedEvents([{ type: "memberJoined" }], {
    routeEvents: async () => {
      order.push("welcome_sent");
      return [{ route: "member_joined_welcome" }];
    },
    processMembershipEvents: async () => {
      order.push("membership_started");
      await membershipGate;
      order.push("membership_finished");
      return [{ reason: "membership_changed" }];
    }
  });

  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(order, ["welcome_sent", "membership_started"]);

  releaseMembership();
  await run;
  assert.deepEqual(order, ["welcome_sent", "membership_started", "membership_finished"]);
});
