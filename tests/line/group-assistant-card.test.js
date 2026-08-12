"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildGroupAssistantCard,
  buildAccountingMenuCard
} = require("../../services/line/group-assistant-card");

function buttons(message) {
  return message.contents.body.contents;
}

test("group assistant card shows car identity and six persistent entries", function () {
  const card = buildGroupAssistantCard({
    scriptName: "測試劇本",
    date: "2026-08-20"
  });
  assert.equal(card.type, "flex");
  assert.ok(card.altText.includes("測試劇本"));
  assert.ok(card.contents.header.contents[0].text.includes("測試劇本"));
  assert.ok(card.contents.header.contents[1].text.includes("2026-08-20"));
  assert.equal(buttons(card).length, 6);
  assert.deepEqual(
    buttons(card).map(button => button.action.text),
    [
      "JLY 車團帳務",
      "JLY 車團資訊",
      "JLY 成員座位",
      "JLY 提醒",
      "JLY 最新通知",
      "JLY 使用說明"
    ]
  );
});

test("accounting card is a second-level persistent menu", function () {
  const card = buildAccountingMenuCard({ scriptName: "測試劇本" });
  assert.equal(card.type, "flex");
  assert.equal(buttons(card).length, 4);
  assert.deepEqual(
    buttons(card).map(button => button.action.label),
    ["➕ 新增分帳", "📒 帳目總覽", "👤 我的應收／應付", "✏️ 我的帳目"]
  );
});
