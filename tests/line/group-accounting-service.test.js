"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  recordGroupAccounting
} = require(
  "../../services/line/group-accounting-service"
);

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
