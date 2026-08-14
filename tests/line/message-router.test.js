"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  routeTextMessage,
  routeMenuCommand
} = require(
  "../../services/line/message-router"
);

test("routes compact car information keywords", function () {
  assert.equal(routeMenuCommand("JLY 店家").action, "assistant_store_info");
  assert.equal(routeMenuCommand("JLY 時間").action, "assistant_time_info");
  assert.equal(routeMenuCommand("JLY 人員").action, "assistant_people_info");
});

const cases = [
  [
    "JLY 記帳",
    "assistant_accounting_menu"
  ],
  [
    "JLY 提醒",
    "assistant_reminder_menu"
  ],
  [
    "JLY 車團資訊",
    "assistant_car_info_menu"
  ],
  [
    "JLY 使用說明",
    "assistant_help_menu"
  ]
];

for (const [text, action] of cases) {
  test(
    `routes Rich Menu command: ${text}`,
    function () {
      const result =
        routeTextMessage(
          text
        );

      assert.equal(
        result.handled,
        true
      );
      assert.equal(
        result.action,
        action
      );
      assert.ok(
        result.replyText
      );
    }
  );
}

test("group help lists the available compact car shortcuts and quick accounting", function () {
  const result = routeTextMessage("JLY 使用說明");
  assert.ok(result.replyText.includes("JLY 店家"));
  assert.ok(result.replyText.includes("JLY 時間"));
  assert.ok(result.replyText.includes("JLY 人員"));
  assert.ok(result.replyText.includes("記帳 晚餐 690 詩婕付"));
});
