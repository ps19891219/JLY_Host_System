"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  removeCarFromView
} = require("../../services/car/mycar-view-cleanup");

const repair = require(
  "../../js/data-view/mycar-view-existence-repair"
);

const root = path.join(__dirname, "../..");
const deleteApi = fs.readFileSync(
  path.join(root, "api/delete-test-car.js"),
  "utf8"
);
const mycarPage = fs.readFileSync(
  path.join(root, "pages/mycar.html"),
  "utf8"
);

function sampleView() {
  return {
    schemaVersion: 4,
    viewType: "mycar_index",
    viewerId: "owner-1",
    cars: [
      {
        id: "keep",
        isHost: true,
        isPlayer: false
      },
      {
        id: "delete-me",
        isHost: true,
        isPlayer: false
      },
      {
        id: "player-car",
        isHost: false,
        isPlayer: true
      }
    ],
    counts: {
      all: 3,
      host: 2,
      player: 1
    }
  };
}

test("永久刪車時 MyCar Prepared View 同步移除該車並重算 counts", () => {
  const result = removeCarFromView(
    sampleView(),
    "delete-me",
    "2026-09-02T00:00:00.000Z"
  );

  assert.equal(result.changed, true);
  assert.deepEqual(
    result.view.cars.map(car => car.id),
    ["keep", "player-car"]
  );
  assert.deepEqual(result.view.counts, {
    all: 2,
    host: 1,
    player: 1
  });
});

test("MyCar View 沒有該 carId 時 cleanup 不重寫", () => {
  const view = sampleView();
  const result = removeCarFromView(
    view,
    "missing"
  );

  assert.equal(result.changed, false);
  assert.equal(result.view, view);
});

test("一次性 existence repair 會移除歷史幽靈卡並留下 revision marker", () => {
  const next = repair.recalculateView(
    sampleView(),
    new Set(["keep", "player-car"]),
    "2026-09-02T00:00:00.000Z"
  );

  assert.deepEqual(
    next.cars.map(car => car.id),
    ["keep", "player-car"]
  );
  assert.deepEqual(next.counts, {
    all: 2,
    host: 1,
    player: 1
  });
  assert.equal(
    next.existenceRepairRevision,
    1
  );
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
    /mycar\.js\?v=47[\s\S]*mycar-view-existence-repair\.js\?v=1/
  );
});
