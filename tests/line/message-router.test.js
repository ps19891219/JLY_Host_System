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
    "assistant_reminder_status"
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
      if (action === "assistant_reminder_status") {
        assert.equal(result.replyText, "");
      } else {
        assert.ok(
          result.replyText
        );
      }
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

test("status queries are read-only while legacy explicit enable is retained", () => {
  assert.equal(routeTextMessage("JLY 提醒狀態").action, "assistant_reminder_status");
  assert.equal(routeTextMessage("JLY 通知狀態").action, "assistant_reminder_status");
  assert.equal(routeTextMessage("開啟行前通知").action, "assistant_reminder_enable");
  assert.equal(routeTextMessage("JLY 開啟行前通知").action, "assistant_reminder_enable");
  assert.match(routeTextMessage("JLY 使用說明").replyText, /JLY 提醒/);
});


test("signup shortcut aliases require the bot name and keep bare chat silent", () => {
  for (const cmd of ["助手報名", "助手 報名", "小助手 報名", "JLY 報名",
    "JLY 小助手 報名", "DAY 報名", "Day 報名", "Day 助手 報名"]) {
    assert.equal(routeTextMessage(cmd).action, "assistant_signup_card", cmd);
  }
  for (const cmd of ["報名", "我想報名", "有人要報名嗎", "報名成功", "報名+1",
    "我要報名了", "@助手 報名", "JLY 記帳"]) {
    assert.notEqual(routeTextMessage(cmd).action, "assistant_signup_card", cmd);
  }
  assert.equal(routeTextMessage("報名").handled, false);
  assert.equal(routeTextMessage("助手").action, "assistant_called");
  assert.equal(routeTextMessage("小助手").action, "assistant_called");
  assert.equal(routeTextMessage("Day").action, "assistant_called");
  assert.equal(routeTextMessage("JLY 記帳").action, "assistant_accounting_menu");
});
