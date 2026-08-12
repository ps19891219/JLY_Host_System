"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseAccountingCommand
} = require(
  "../../services/line/accounting-command"
);

test("parses a group expense command", function () {
  const result =
    parseAccountingCommand(
      "JLY 支出 350 聚餐飲料"
    );

  assert.deepEqual(result, {
    valid: true,
    command: {
      type: "expense",
      amount: 350,
      description: "聚餐飲料"
    }
  });
});

test("parses income with comma-separated amount", function () {
  const result =
    parseAccountingCommand(
      "jly 收入 1,200 成員繳費"
    );

  assert.equal(result.valid, true);
  assert.equal(result.command.type, "income");
  assert.equal(result.command.amount, 1200);
});

test("rejects an accounting command without description", function () {
  const result =
    parseAccountingCommand("JLY 支出 350");

  assert.equal(result.valid, false);
  assert.equal(result.error, "description_missing");
});

test("ignores text that is not an accounting command", function () {
  assert.equal(
    parseAccountingCommand("大家晚安"),
    null
  );
});
