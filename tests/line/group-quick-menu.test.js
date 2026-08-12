"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildGroupQuickMenuMessage
} = require(
  "../../services/line/group-quick-menu"
);

test(
  "group quick menu contains four valid message actions",
  function () {
    const message =
      buildGroupQuickMenuMessage();

    assert.equal(message.type, "text");
    assert.ok(message.text.includes("這個群組"));
    assert.equal(message.quickReply.items.length, 4);

    for (const item of message.quickReply.items) {
      assert.equal(item.type, "action");
      assert.equal(item.action.type, "message");
      assert.ok(item.action.label);
      assert.ok(item.action.text.startsWith("JLY "));
    }
  }
);
