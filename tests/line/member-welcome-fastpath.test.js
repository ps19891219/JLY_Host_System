"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { sendMemberJoinedWelcome, readCarQuickly } = require("../../services/line/member-welcome-fastpath");

test("fast welcome sends a working card even when car metadata is slow", async () => {
  let sent = null;
  const event = {
    type: "memberJoined",
    replyToken: "reply-1",
    source: { type: "group", groupId: "group-1" }
  };

  const result = await sendMemberJoinedWelcome(event, {
    resolveGroupBinding: async () => ({
      bound: true,
      binding: { groupId: "group-1", carId: "car-1" }
    }),
    getCarById: async () => new Promise(() => {}),
    getPublicBaseUrl: () => "https://example.com",
    sendReplyMessage: async (_token, messages) => { sent = messages; }
  });

  assert.equal(result.route, "member_joined_welcome");
  assert.equal(result.usedGenericTitle, true);
  assert.equal(sent[0].type, "flex");
  const urls = sent[0].contents.body.contents.map(item => item.action && item.action.uri);
  assert.deepEqual(urls.filter(Boolean), [
    "https://example.com/pages/car-view.html?id=car-1&entry=dm&source=line_group",
    "https://example.com/pages/car-view.html?id=car-1&entry=player&source=line_group"
  ]);
  assert.match(sent[0].contents.body.contents[2].text, /暫時無法新增行程/);
});

test("fast welcome keeps the car title when metadata returns quickly", async () => {
  let sent = null;
  const result = await sendMemberJoinedWelcome({
    type: "mem���q�^