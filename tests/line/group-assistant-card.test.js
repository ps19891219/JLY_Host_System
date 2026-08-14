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
  }, { baseUrl: "https://example.com", token: "signed-token" });
  assert.equal(card.type, "flex");
  assert.ok(card.altText.includes("測試劇本"));
  assert.ok(card.contents.header.contents[0].text.includes("測試劇本"));
  assert.ok(card.contents.header.contents[1].text.includes("2026-08-20"));
  assert.equal(buttons(card).length, 6);
  assert.deepEqual(
    buttons(card).map(button => button.action.type),
    ["message", "message", "message", "uri", "uri", "uri"]
  );
  assert.equal(buttons(card)[0].action.text, "JLY 店家");
  assert.equal(buttons(card)[1].action.text, "JLY 時間");
  assert.equal(buttons(card)[2].action.text, "JLY 人員");
  assert.ok(buttons(card)[3].action.uri.includes("tab=accounting"));
  assert.ok(buttons(card)[3].action.uri.includes("signed-token"));
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
