const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const cleanupSource = fs.readFileSync(path.join(root, "services/car/mycar-view-cleanup.js"), "utf8");
const repairSource = fs.readFileSync(path.join(root, "js/data-view/mycar-view-existence-repair.js"), "utf8");
const deleteApi = fs.readFileSync(path.join(root, "api/delete-test-car.js"), "utf8");
const mycarPage = fs.readFileSync(path.join(root, "pages/mycar.html"), "utf8");

function loadCleanup() {
  const module = { exports: {} };
  vm.runInNewContext(cleanupSource, { module, exports: module.exports, require, console }, { filename: "mycar-view-cleanup.js" });
  return module.exports;
}

function loadRepair() {
  const window = {};
  vm.runInNewContext(repairSource, { window, console }, { filename: "mycar-view-existence-repair.js" });
  return window.JLYMyCarViewExistenceRepair;
}

test("永久刪車時 MyCar Prepared View 同步移除該車並重算 counts", () => {
  const { removeCarFromView } = loadCleanup();
  const result = removeCarFromView({
    schemaVersion: 4,
    viewType: "mycar_index",
    viewerId: "P1",
    cars: [
      { id: "C1", isHost: true, isPlayer: false },
      { id: "C2", isHost: false, isPlayer: true }
    ],
    counts: { all: 2, host: 1, player: 1 }
  }, "C1", "2026-09-02T12:00:00.000Z");

  assert.equal(result.changed, true);
  assert.deepEqual(result.view.cars.map(car => car.id), ["C2"]);
  assert.deepEqual(result.view.counts, { all: 1, host: 0, player: 1 });
  assert.equal(result.view.builtAt, "2026-09-02T12:00:00.000Z");
});

test("MyCar View 沒有該 carId 時 cleanup 不重寫", () => {
  const { removeCarFromView } = loadCleanup();
  const original = {
    cars: [{ id: "C2", isHost: true }],
    counts: { all: 1, host: 1, player: 0 }
  };
  const result = removeCarFromView(original, "C1");
  assert.equal(result.changed, false);
  assert.equal(result.view, original);
});

test("一次性 existence repair 會移除歷史幽靈卡並留下 revision marker", () => {
  const repair = loadRepair();
  const result = repair.repairView({
    schemaVersion: 4,
    viewType: "mycar_index",
    viewerId: "P1",
    cars: [
      { id: "C1", isHost: true },
      { id: "GHOST", isPlayer: true }
    ]
  }, new Set(["C1"]), "2026-09-02T12:00:00.000Z");

  assert.equal(result.changed, true);
  assert.deepEqual(result.view.cars.map(car => car.id), ["C1"]);
  assert.equal(result.view.existenceRepairRevision, 1);
  assert.equal(result.view.existenceRepairedAt, "2026-09-02T12:00:00.000Z");
  assert.deepEqual(result.view.counts, { all: 1, host: 1, player: 0 });
});

test("delete-test-car 將 owner MyCar View 與 Core car 放在同一 final batch", () => {
  assert.match(
    deleteApi,
    /collection\("myCarViews"\)[\s\S]*finalBatch\.set\([\s\S]*finalBatch\.delete\([\s\S]*carRef[\s\S]*finalBatch\.commit\(\)/
  );
});

test("我的車頁載入一次性幽靈卡 repair runtime", () => {
  assert.match(
    mycarPage,
    /mycar\.js\?v=48[\s\S]*mycar-view-existence-repair\.js\?v=1/
  );
});
