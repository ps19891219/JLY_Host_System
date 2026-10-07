"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { routeEvent } = require("../../services/line/event-router");

function eventWithMentions(mentions, text = "@甲 @乙") {
  return {
    type: "message",
    timestamp: 1,
    replyToken: "reply-token",
    source: {
      type: "group",
      groupId: "group-1",
      userId: "host-line-user"
    },
    message: {
      id: "message-1",
      type: "text",
      text,
      mention: {
        mentionees: mentions
      }
    }
  };
}

test("tag-only group message is captured when reminder target selection is open", async function () {
  let replyText = "";
  let capturedMentions = null;

  const result = await routeEvent(
    eventWithMentions([
      { type: "user", userId: "U1", isSelf: false, index: 0, length: 2 },
      { type: "user", userId: "U2", isSelf: false, index: 3, length: 2 }
    ]),
    {
      resolveGroupBinding: async groupId => ({
        bound: true,
        binding: { groupId, carId: "car-1" }
      }),
      captureGroupReminderTargets: async (carId, mentions) => {
        assert.equal(carId, "car-1");
        capturedMentions = mentions;
        return {
          captured: true,
          addedCount: 2,
          totalCount: 5,
          unavailableCount: 0
        };
      },
      sendTextReply: async (_token, text) => {
        replyText = text;
      }
    }
  );

  assert.equal(result.route, "assistant_reminder_targets_captured");
  assert.equal(capturedMentions.length, 2);
  assert.match(replyText, /這次新增：2 人/);
  assert.match(replyText, /目前名單：5 人/);
});

test("ordinary tagged chat stays silent when reminder target capture is closed", async function () {
  let replyCalls = 0;

  const result = await routeEvent(
    eventWithMentions([
      { type: "user", userId: "U1", isSelf: false, index: 0, length: 2 }
    ], "@甲 晚點見"),
    {
      resolveGroupBinding: async groupId => ({
        bound: true,
        binding: { groupId, carId: "car-1" }
      }),
      captureGroupReminderTargets: async () => ({
        captured: false,
        reason: "target_capture_closed"
      }),
      sendTextReply: async () => {
        replyCalls += 1;
      }
    }
  );

  assert.equal(result.handled, false);
  assert.equal(result.route, "ignore_normal_chat");
  assert.equal(replyCalls, 0);
});
