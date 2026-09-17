const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

function loadMyCarView() {
  const window = {};
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "js/data-view/mycar-view.js"), "utf8"),
    { window, console },
    { filename: "js/data-view/mycar-view.js" }
  );
  return window.JLYMyCarView;
}

test("owner who explicitly created car as player stays player", () => {
  const view = loadMyCarView();
  const car = view.compactCar({
    id: "player-created",
    ownerId: "me",
    myRole: "player",
    isHost: false,
    isPlayer: true,
    players: []
  }, ["me"]);
  assert.equal(car.isHost, false);
  assert.equal(car.isPlayer, true);
  assert.equal(car.role, "player");
});

test("owner who explicitly created car as host stays host", () => {
  const view = loadMyCarView();
  const car = view.compactCar({
    id: "host-created",
    ownerId: "me",
    myRole: "host",
    isHost: true,
    isPlayer: false,
    players: []
  }, ["me"]);
  assert.equal(car.isHost, true);
  assert.equal(car.isPlayer, false);
  assert.equal(car.role, "host");
});

test("legacy owner without explicit role remains host for compatibility", () => {
  const view = loadMyCarView();
  const car = view.compactCar({ id: "legacy", ownerId: "me", players: [] }, ["me"]);
  assert.equal(car.isHost, true);
  assert.equal(car.isPlayer, false);
});

test("formal player membership is independent from ownership", () => {
  const view = loadMyCarView();
  const car = view.compactCar({
    id: "joined",
    ownerId: "someone-else",
    players: [{ playerId: "me", status: "已加入" }]
  }, ["me"]);
  assert.equal(car.isHost, false);
  assert.equal(car.isPlayer, true);
});
