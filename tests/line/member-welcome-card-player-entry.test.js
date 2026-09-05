"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMemberWelcomeCard } = require("../../services/line/member-welcome-card");

function buttonUri(card, label) {
  const buttons = card.contents.body.contents;
  const button = buttons.find(item => item && item.action && item.action.label === label);
  return button && button.action && button.action.uri;
}

test("LINE welcome player entry uses the same formal car view as 車團總覽", function () {
  const card = buildMemberWelcomeCard(
    { id: "car id/1", scriptName: "齒痕" },
    { baseUrl: "https://jly.example.com/" }
  );

  assert.equal(
    buttonUri(card, "🎮 我要報名玩家"),
    "https://jly.example.com/pages/car-view.html?id=car%20id%2F1"
  );
  assert.equal(
    buttonUri(card, "🎭 我是本場 DM"),
    "https://jly.example.com/pages/dm-join.html?id=car%20id%2F1"
  );
});
