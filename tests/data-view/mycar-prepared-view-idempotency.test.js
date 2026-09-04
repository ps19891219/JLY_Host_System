const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

function loadBrowserModule(relativePath, window) {
  vm.runInNewContext(fs.readFileSync(path.join(root, relativePath), "utf8"), { window, console }, { filename: relativePath });
}

function player(id, position) {
  return { playerId: id, position, status: "已加入" };
}

function slot(id, originalType, playerId) {
  return { slotId: id, originalType, type: originalType, playerId };
}

test("a fully occupied 3/3 prepared card remains full after defensive re-compaction", () => {
  const window = {};
  loadBrowserModule("js/data-view/mycar-view.js", window);
  const coreCar = {
    id: "car-full-3-3", ownerId: "host", totalPeople: 6, maleSlots: 3, femaleSlots: 3,
    players: [player("m1", "男"), player("m2", "男"), player("m3", "男"), player("f1", "女"), player("f2", "女"), player("f3", "女")],
    slots: [slot("m1", "male", "m1"), slot("m2", "male", "m2"), slot("m3", "male", "m3"), slot("f1", "female", "f1"), slot("f2", "female", "f2"), slot("f3", "female", "f3")]
  };
  const prepared = window.JLYMyCarView.compactCar(coreCar, ["host"]);
  assert.equal(prepared.seatSummary.maleOccupied, 3);
  assert.equal(prepared.seatSummary.femaleOccupied, 3);
  assert.equal(Array.isArray(prepared.slots), false);
  const defensiveSecondPass = window.JLYMyCarView.compactCar(prepared, ["host"]);
  assert.equal(defensiveSecondPass.seatSummary.maleOccupied, 3);
  assert.equal(defensiveSecondPass.seatSummary.femaleOccupied, 3);
  assert.equal(defensiveSecondPass.seatSummary.maleTotal, 3);
  assert.equal(defensiveSecondPass.seatSummary.femaleTotal, 3);
});

test("MyCar runtime consumes prepared cards instead of projecting them again", () => {
  const source = fs.readFileSync(path.join(root, "js/mycar.js"), "utf8");
  assert.match(source, /Prepared View 已在 mutation\/build 階段 compact/);
  assert.doesNotMatch(source, /preparedView\.cars\.map\([\s\S]{0,500}myCarViewModule\.compactCar/);
});

test("seat mutations remain a formal MyCar invalidation trigger", () => {
  const window = {};
  loadBrowserModule("js/data-view/view-impact-resolver.js", window);
  for (const field of ["players", "playerIds", "slots", "maleSlots", "femaleSlots", "flexibleSlots", "totalPeople"]) {
    assert.ok(window.JLYViewImpactResolver.resolveCarViews([field]).includes("mycar"));
  }
});
