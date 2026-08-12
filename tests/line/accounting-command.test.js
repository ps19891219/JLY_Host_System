"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseAccountingCommand,
  parseAccountingQuery,
  parseAccountingMutation
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

test("parses accounting query commands", function () {
  assert.deepEqual(
    parseAccountingQuery("JLY 今日帳目"),
    { scope: "today" }
  );
  assert.deepEqual(
    parseAccountingQuery("JLY 本月帳目"),
    { scope: "month" }
  );
  assert.deepEqual(
    parseAccountingQuery("JLY 帳本餘額"),
    { scope: "all" }
  );
  assert.deepEqual(
    parseAccountingQuery("JLY 最近帳目"),
    { scope: "recent" }
  );
  assert.deepEqual(
    parseAccountingQuery("JLY 異動紀錄"),
    { scope: "audit" }
  );
});

test("parses update and delete commands", function () {
  assert.deepEqual(
    parseAccountingMutation(
      "JLY 修改帳目 ABCD1234 支出 400 新說明"
    ),
    {
      valid: true,
      mutation: {
        operation: "update",
        entryCode: "ABCD1234",
        type: "expense",
        amount: 400,
        description: "新說明"
      }
    }
  );

  assert.deepEqual(
    parseAccountingMutation(
      "JLY 刪除帳目 ABCD1234"
    ),
    {
      valid: true,
      mutation: {
        operation: "delete",
        entryCode: "ABCD1234"
      }
    }
  );
});
