"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  recordGroupAccounting,
  queryGroupAccounting,
  getTaipeiPeriod,
  summarizeEntries
} = require(
  "../../services/line/group-accounting-service"
);

test(
  "calculates today using the Taipei timezone",
  function () {
    const period = getTaipeiPeriod(
      "today",
      Date.parse("2026-08-12T16:30:00.000Z")
    );

    assert.deepEqual(period, {
      startAt: "2026-08-12T16:00:00.000Z",
      endBefore: "2026-08-13T16:00:00.000Z"
    });
  }
);

test(
  "calculates the Taipei calendar month",
  function () {
    const period = getTaipeiPeriod(
      "month",
      Date.parse("2026-08-12T08:00:00.000Z")
    );

    assert.deepEqual(period, {
      startAt: "2026-07-31T16:00:00.000Z",
      endBefore: "2026-08-31T16:00:00.000Z"
    });
  }
);

test("summarizes income, expense and balance", function () {
  assert.deepEqual(
    summarizeEntries([
      { type: "income", amount: 1000 },
      { type: "expense", amount: 350 },
      { type: "expense", amount: 50 }
    ]),
    {
      count: 3,
      income: 1000,
      expense: 400,
      balance: 600
    }
  );
});

test(
  "records accounting with group, message and user identity",
  async function () {
    let savedEntry = null;

    const result = await recordGroupAccounting(
      {
        timestamp: 1723420800000,
        source: {
          type: "group",
          groupId: "group-1",
          userId: "user-1"
        },
        message: {
          id: "message-1"
        }
      },
      {
        type: "expense",
        amount: 350,
        description: "聚餐飲料"
      },
      {
        saveGroupAccountingEntry: async function (entry) {
          savedEntry = entry;
          return entry;
        }
      }
    );

    assert.equal(result.saved, true);
    assert.equal(savedEntry.groupId, "group-1");
    assert.equal(savedEntry.messageId, "message-1");
    assert.equal(savedEntry.userId, "user-1");
    assert.equal(savedEntry.amount, 350);
  }
);

test(
  "does not record group accounting in a private chat",
  async function () {
    let saveCalls = 0;

    const result = await recordGroupAccounting(
      {
        source: {
          type: "user",
          groupId: "",
          userId: "user-1"
        },
        message: {
          id: "message-1"
        }
      },
      {
        type: "expense",
        amount: 350,
        description: "聚餐飲料"
      },
      {
        saveGroupAccountingEntry: async function () {
          saveCalls += 1;
        }
      }
    );

    assert.equal(result.saved, false);
    assert.equal(result.reason, "group_required");
    assert.equal(saveCalls, 0);
  }
);

test(
  "queries only the current group with a Taipei period",
  async function () {
    let receivedGroupId = "";
    let receivedPeriod = null;

    const result = await queryGroupAccounting(
      {
        timestamp: Date.parse(
          "2026-08-12T08:00:00.000Z"
        ),
        source: {
          type: "group",
          groupId: "group-2"
        }
      },
      "today",
      {
        listGroupAccountingEntries: async function (
          groupId,
          period
        ) {
          receivedGroupId = groupId;
          receivedPeriod = period;

          return [
            {
              type: "expense",
              amount: 200,
              description: "午餐"
            }
          ];
        }
      }
    );

    assert.equal(receivedGroupId, "group-2");
    assert.equal(
      receivedPeriod.startAt,
      "2026-08-11T16:00:00.000Z"
    );
    assert.equal(result.found, true);
    assert.equal(result.summary.balance, -200);
  }
);
