"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  routeEvent
} = require(
  "../../services/line/event-router"
);

const {
  buildMemberWelcomeCard
} = require(
  "../../services/line/member-welcome-card"
);

function createMemberJoinedEvent() {
  return {
    type: "memberJoined",
    timestamp: 1,
    replyToken: "reply-token",
    source: {
      type: "group",
      groupId: "group-1"
    },
    joined: {
      members: [
        {
          type: "user",
          userId: "user-2"
        }
      ]
    }
  };
}

test(
  "member welcome card keeps DM above player",
  function () {
    const card =
      buildMemberWelcomeCard(
        {
          id: "car-1",
          scriptName: "測試劇本"
        },
        {
          baseUrl:
            "https://example.com",
          carId:
            "car-1"
        }
      );

    const buttons =
      card.contents.body.contents;

    assert.equal(
      buttons.length,
      2
    );

    assert.equal(
      buttons[0].action.label,
      "🎭 我是本場 DM"
    );

    assert.match(
      buttons[0].action.uri,
      /dm-join\.html\?id=car-1/
    );

    assert.equal(
      buttons[1].action.label,
      "🎮 我要報名玩家"
    );

    assert.match(
      buttons[1].action.uri,
      /join\.html\?id=car-1/
    );
  }
);

test(
  "memberJoined replies only for a bound car group",
  async function () {
    let messages = null;

    const result =
      await routeEvent(
        createMemberJoinedEvent(),
        {
          resolveGroupBinding:
            async function () {
              return {
                bound: true,
                reason:
                  "binding_found",
                binding: {
                  groupId:
                    "group-1",
                  carId:
                    "car-1"
                }
              };
            },

          getCarById:
            async function () {
              return {
                id: "car-1",
                scriptName:
                  "測試劇本"
              };
            },

          getPublicBaseUrl:
            function () {
              return "https://example.com";
            },

          sendReplyMessage:
            async function (
              replyToken,
              value
            ) {
              assert.equal(
                replyToken,
                "reply-token"
              );
              messages = value;
            }
        }
      );

    assert.equal(
      result.route,
      "member_joined_welcome"
    );

    assert.equal(
      messages.length,
      1
    );

    assert.equal(
      messages[0].type,
      "flex"
    );
  }
);

test(
  "memberJoined stays silent when the group is not bound",
  async function () {
    let replyCalls = 0;

    const result =
      await routeEvent(
        createMemberJoinedEvent(),
        {
          resolveGroupBinding:
            async function () {
              return {
                bound: false,
                reason:
                  "binding_not_found",
                binding: null
              };
            },

          sendReplyMessage:
            async function () {
              replyCalls += 1;
            }
        }
      );

    assert.equal(
      result.route,
      "member_joined_unbound_group"
    );

    assert.equal(
      replyCalls,
      0
    );
  }
);
