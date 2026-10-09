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
    assert.equal(buttons[2].action.label, "📅 加入我的 Google 行事曆");
    assert.equal(new URL(buttons[2].action.uri).hostname, "calendar.google.com");
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
                  "測試劇本",
                gameDate: "2027-10-04",
                gameTime: "19:00",
                calendar: { eventDurationMinutes: 180 }
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
    assert.equal(messages[0].contents.body.contents.length, 3);
    assert.equal(messages[0].contents.body.contents[2].action.label, "📅 加入我的 Google 行事曆");
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


test("explicit signup command reuses the existing three-button card and reads one car", async () => {
  for (const cmd of ["助手 報名", "小助手 報名", "JLY 報名", "DAY 報名"]) {
    let sent = null;
    let reads = 0;
    const result = await routeEvent({
      type: "message", replyToken: "reply", source: { type: "group", groupId: "group-1" },
      message: { id: "m1", type: "text", text: cmd }
    }, {
      resolveGroupBinding: async () => ({ bound: true, binding: { carId: "car-1" } }),
      getCarById: async id => {
        assert.equal(id, "car-1");
        reads++;
        return { id, scriptName: "孤注", gameDate: "2027-10-04", gameTime: "19:30",
          calendar: { eventDurationMinutes: 180 } };
      },
      getPublicBaseUrl: () => "https://example.com",
      sendReplyMessage: async (_token, messages) => { sent = messages; }
    });
    assert.equal(result.route, "assistant_signup_card", cmd);
    assert.equal(reads, 1);
    assert.deepEqual(sent[0].contents.body.contents.map(x => x.action.label), [
      "🎭 我是本場 DM", "🎮 我要報名玩家", "📅 加入我的 Google 行事曆"
    ]);
  }
});

test("only actual LINE bot mention plus 報名 unlocks the card", async () => {
  const tag = "@JLY 官方小助手";
  for (const mention of [
    { type: "user", isSelf: true, index: 0, length: tag.length },
    { type: "user", isSelf: false, index: 0, length: tag.length },
    { type: "user", isSelf: true, index: 0, length: 999 }
  ]) {
    let sent = null;
    const result = await routeEvent({
      type: "message", replyToken: "reply", source: { type: "group", groupId: "group-1" },
      message: { id: "m2", type: "text", text: tag + " 報名",
        mention: { mentionees: [mention] } }
    }, {
      resolveGroupBinding: async () => ({ bound: true, binding: { carId: "car-1" } }),
      getCarById: async () => ({ id: "car-1", scriptName: "孤注",
        gameDate: "2027-10-04", gameTime: "19:30",
        calendar: { eventDurationMinutes: 180 } }),
      getPublicBaseUrl: () => "https://example.com",
      createGroupAssistantToken: () => "token",
      sendReplyMessage: async (_token, messages) => { sent = messages; }
    });
    if (mention.isSelf === true && mention.length === tag.length) {
      assert.equal(result.route, "assistant_signup_card");
      assert.equal(sent[0].type, "flex");
      assert.equal(sent[0].contents.body.contents[2].action.label,
        "📅 加入我的 Google 行事曆");
    } else {
      assert.notEqual(result.route, "assistant_signup_card");
    }
  }
});

test("bare 報名 neither reads group binding nor replies", async () => {
  let calls = 0;
  const result = await routeEvent({
    type: "message", replyToken: "reply", source: { type: "group", groupId: "group-1" },
    message: { id: "m3", type: "text", text: "報名" }
  }, {
    resolveGroupBinding: async () => { calls++; return { bound: true, binding: { carId: "car-1" } }; },
    getCarById: async () => { calls++; },
    sendReplyMessage: async () => { calls++; }
  });
  assert.equal(result.route, "ignore_normal_chat");
  assert.equal(calls, 0);
});

test("signup card requires a bound group and does not read other cars", async () => {
  let reads = 0, reply = "";
  const result = await routeEvent({
    type: "message", replyToken: "reply", source: { type: "group", groupId: "group-1" },
    message: { id: "m4", type: "text", text: "助手 報名" }
  }, {
    resolveGroupBinding: async () => ({ bound: false, binding: null }),
    getCarById: async () => { reads++; },
    sendTextReply: async (_token, value) => { reply = value; }
  });
  assert.equal(result.route, "assistant_signup_binding_required");
  assert.equal(reads, 0);
  assert.match(reply, /綁定/);
});

test("bot mention alone still opens existing assistant menu", async () => {
  const tag = "@JLY 官方小助手";
  let sent = null;
  const result = await routeEvent({
    type: "message", replyToken: "reply", source: { type: "group", groupId: "group-1" },
    message: { id: "m5", type: "text", text: tag,
      mention: { mentionees: [{ type: "user", isSelf: true, index: 0, length: tag.length }] } }
  }, {
    resolveGroupBinding: async () => ({ bound: true, binding: { carId: "car-1" } }),
    getCarById: async () => ({ id: "car-1", scriptName: "孤注" }),
    createGroupAssistantToken: () => "token",
    getPublicBaseUrl: () => "https://example.com",
    sendReplyMessage: async (_token, messages) => { sent = messages; }
  });
  assert.equal(result.route, "assistant_called");
  assert.equal(sent[0].type, "flex");
  assert.notEqual(sent[0].altText, "歡迎加入《孤注》｜本場活動資訊與個人行事曆");
});
