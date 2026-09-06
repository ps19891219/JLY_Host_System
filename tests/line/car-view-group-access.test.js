"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { carViewPayload } = require("../../services/car/car-view-access");
const { buildGroupAssistantCard } = require("../../services/line/group-assistant-card");

test("signed group access can read roster and seats without a member login", function () {
  const car = {
    id: "car-1",
    scriptName: "測試劇本",
    players: [{ memberId: "private-person-id", playerName: "小梅", position: "女位" }],
    staffSlots: [{ id: "dm-1", memberId: "private-dm-id", label: "DM", displayName: "小安" }],
    slots: [{ id: "seat-1", section: "female", player: { memberId: "private-person-id", playerName: "小梅" } }]
  };
  const result = carViewPayload(car, null, { groupAccess: true });
  assert.equal(result.access, "group");
  assert.equal(result.car.players[0].playerName, "小梅");
  assert.equal(result.car.players[0].memberId, undefined);
  assert.equal(result.car.staffSlots[0].memberId, undefined);
  assert.equal(result.car.slots[0].player.memberId, undefined);
});

test("assistant car overview carries the signed group token", function () {
  const card = buildGroupAssistantCard(
    { id: "car-1", scriptName: "測試劇本" },
    { baseUrl: "https://example.com", token: "signed-token", carId: "car-1" }
  );
  const buttons = card.contents.body.contents;
  const overview = buttons.find(item => item.action && item.action.label === "🚗 車團總覽");
  assert.ok(overview);
  assert.equal(overview.action.uri, "https://example.com/pages/car-view.html?id=car-1&groupToken=signed-token");
});

test("legacy player and DM pages redirect into the same car view", function () {
  const player = fs.readFileSync(path.join(process.cwd(), "pages/join.html"), "utf8");
  const dm = fs.readFileSync(path.join(process.cwd(), "pages/dm-join.html"), "utf8");
  const carView = fs.readFileSync(path.join(process.cwd(), "pages/car-view.html"), "utf8");
  assert.match(player, /car-view\.html/);
  assert.match(player, /apply.*player/);
  assert.match(dm, /car-view\.html/);
  assert.match(dm, /apply.*dm/);
  assert.match(carView, /car-view-application\.js\?v=1/);
});
