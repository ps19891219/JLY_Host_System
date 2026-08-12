"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  routeEvent
} = require(
  "../../services/line/event-router"
);

function createTextEvent(options = {}) {
  return {
    type: "message",
    timestamp: 1,
    replyToken:
      options.replyToken ||
      "reply-token",
    source: {
      type:
        options.sourceType ||
        "group",
      groupId:
        options.groupId ||
        "group-1",
      userId: "user-1"
    },
    message: {
      id: "message-1",
      type: "text",
      text:
        options.text ||
        "JLY 小助手"
    }
  };
}

test(
  "normal group chat stays silent and does not read binding",
  async function () {
    let bindingCalls = 0;
    let replyCalls = 0;

    const result = await routeEvent(
      createTextEvent({
        text: "大家晚安"
      }),
      {
        resolveGroupBinding: async function () {
          bindingCalls += 1;
        },
        sendTextReply: async function () {
          replyCalls += 1;
        }
      }
    );

    assert.equal(result.handled, false);
    assert.equal(result.route, "ignore_normal_chat");
    assert.equal(bindingCalls, 0);
    assert.equal(replyCalls, 0);
  }
);

test(
  "assistant call in a group resolves binding before replying",
  async function () {
    const calls = [];

    const result = await routeEvent(
      createTextEvent(),
      {
        resolveGroupBinding: async function (groupId) {
          calls.push([
            "binding",
            groupId
          ]);

          return {
            bound: true,
            reason: "binding_found",
            binding: {
              groupId,
              carId: "car-1",
              active: true
            }
          };
        },
        sendReplyMessage: async function (
          replyToken,
          messages
        ) {
          calls.push([
            "reply",
            replyToken,
            messages
          ]);
        }
      }
    );

    assert.equal(result.handled, true);
    assert.equal(result.route, "assistant_called");
    assert.equal(result.groupBinding.bound, true);
    assert.equal(
      result.groupBinding.binding.carId,
      "car-1"
    );
    assert.equal(calls[0][0], "binding");
    assert.equal(calls[1][0], "reply");
    assert.equal(
      calls[1][2][0].quickReply.items.length,
      4
    );
    assert.deepEqual(
      calls[1][2][0].quickReply.items.map(
        function (item) {
          return item.action.text;
        }
      ),
      [
        "JLY 記帳",
        "JLY 提醒",
        "JLY 車團資訊",
        "JLY 使用說明"
      ]
    );
  }
);

test(
  "binding lookup failure does not prevent assistant reply",
  async function () {
    let replyCalls = 0;

    const result = await routeEvent(
      createTextEvent(),
      {
        resolveGroupBinding: async function () {
          throw new Error("firebase unavailable");
        },
        sendReplyMessage: async function () {
          replyCalls += 1;
        }
      }
    );

    assert.equal(result.handled, true);
    assert.equal(replyCalls, 1);
    assert.equal(result.groupBinding.bound, false);
    assert.equal(
      result.groupBinding.reason,
      "binding_lookup_failed"
    );
  }
);

test(
  "one-to-one assistant call does not query group binding",
  async function () {
    let bindingCalls = 0;

    const result = await routeEvent(
      createTextEvent({
        sourceType: "user",
        groupId: ""
      }),
      {
        resolveGroupBinding: async function () {
          bindingCalls += 1;
        },
        sendTextReply: async function () {}
      }
    );

    assert.equal(result.handled, true);
    assert.equal(bindingCalls, 0);
    assert.equal(result.groupBinding, null);
  }
);
