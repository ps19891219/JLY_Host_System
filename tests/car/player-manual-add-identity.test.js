"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadManualAddModule() {
  const window = {
    JLYCarDetailPlayerSearch: {
      normalizePlayerName(value) {
        return String(value || "").trim().toLowerCase();
      },
      getPlayerDatabaseName(player) {
        return String(
          player &&
          (player.displayName || player.playerName || player.name) ||
          ""
        ).trim();
      }
    }
  };

  const context = {
    window,
    console,
    URLSearchParams,
    location: { search: "" },
    Date,
    setTimeout,
    clearTimeout
  };
  window.window = window;

  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../../js/modules/car/detail/player/player-manual-add.js"
    ),
    "utf8"
  );
  vm.runInNewContext(source, context, {
    filename: "player-manual-add.js"
  });
  return window.JLYCarDetailPlayerManualAdd;
}

test("manual add does not collapse different stable Person IDs with same name", function () {
  const module = loadManualAddModule();
  const existing = [
    {
      playerId: "person-A",
      displayName: "小安"
    }
  ];
  const selected = {
    id: "person-B",
    displayName: "小安"
  };

  assert.equal(
    module.findExistingCarPlayer(existing, selected),
    null
  );
});

test("manual add keeps legacy name fallback when a stable Person ID is missing", function () {
  const module = loadManualAddModule();
  const legacy = [
    {
      displayName: "小安"
    }
  ];
  const selected = {
    id: "person-B",
    displayName: "小安"
  };

  assert.equal(
    module.findExistingCarPlayer(legacy, selected),
    legacy[0]
  );
});
