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
          scriptName: "測試劇本",
          gameDate: "2027-10-04",
          gameTime: "19:00",
          calendar: { eventDurationMinutes: 180 }
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
      3
    );

    assert.equal(
      buttons[0].action.label,
      "🎭 我是本場 DM"
    );

    assert.match(
      buttons[0].action.uri,
      /car-view\.html\?id=car-1&entry=dm/
    );

    assert.equal(
      buttons[1].action.label,
      "🎮 我要報名玩家"
    );

    assert.match(
      buttons[1].action.uri,
      /car-view\.html\?id=car-1&entry=player/
    );
    ���q�^