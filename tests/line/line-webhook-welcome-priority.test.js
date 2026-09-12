"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { processVerifiedEvents } = require("../../api/line-webhook");

test("memberJoined uses fast welcome path before membership health bookkeeping", async () => {
  const order = [];
  const events = [{ type: "memberJoined", replyToken: "reply-1", source: { type: "group", groupId: "group-1" } }];

  const result = await processVerifiedEvents(events, {
    routeEvents: async () => {
      throw new Error("memberJoined must not use the general router");
    },
    sendMemberJoinedWelcome: async received => {
      assert.equal(received, events[0]);
      order.push("welcome");
      return { route: "member_joined_welcome" };
    },
    processMembershipEvents: async received => {
      assert.equal(received, events);
      order.push("membership");
      return [{ reason: "membership_changed" }];
    }
  });

  assert.deepEqual(order, ["welcome", "membership"]);
  assert.equal(result.routeResults[0].route, "member_joined_welcome");
});

test("welcome completes even when membership bookkeeping is slow", async () => {
  const order = [];
  let releaseMembership;
  const membershipGate = new Promise(resolve => { releaseMembership = resolve; });

  const run = processVerifiedEvents([{ type: "memberJoined" }], {
    sendMemberJoinedWelcome: async () => {
      order.push("welcome_sent");
      return { route: "member_joined_welcome" };
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

test("non-memberJoined events still use the general router", async () => {
  const event = { type: "message" };
  let routed = null;

  const result = await processVerifiedEvents([event], {
    routeEvents: async events => {
      routed = events;
      return [{ route: "message" }];
    },
    sendMemberJoinedWelcome: async () => {
      throw new Error("unexpected welcome path");
    },
    processMembershipEvents: async () => []
  });

  assert.deepEqual(routed, [event]);
  assert.equal(result.routeResults[0].route, "message");
});
