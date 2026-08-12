"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  routeTextMessage
} = require(
  "../../services/line/message-router"
);

const cases = [
  [
    "JLY 記帳",
    "assistant_accounting_menu"
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
