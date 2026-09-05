"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../../js/data-view/mycar-view-existence-repair.js"),
  "utf8"
);

function loadRepair() {
  const window = {};
  const module = { exports: {} };
  vm.runInNewContext(
    source,
    { window, module, exports: module.exports, console, globalThis: window },
    { filename: "mycar-view-existence-repair.js" }
  );
  return module.exports;
}

test("一次性 Seat Projection repair 以 Core slots 修正既有 MyCar stale seatSummary", () => {
  const repair = loadRepair();
  const view = {
    viewerId: "HOST-1",
    identityIds: ["HOST-1"],
    cars: [
      {
        id: "CAR-1",
        scriptName: "無夢之城",
        isHost: true,
        maleSlots: 3,
        femaleSlots: 3,
        players: [
          { playerId: "M1", position: "男" },
          { playerId: "F1", position: "女" }
        ],
        seatSummary: {
          maleTotal: 3,
          maleOccupied: 1,
          femaleTotal: 3,
          femaleOccupied: 3,
          flexibleTotal: 0,
          flexibleOccupied: 0,
          totalSeatCount: 6,
          occupiedSeatCount: 4,
          waitingCount: 0
        }
      }
    ]
  };

  const coreCars = new Map([
    [
      "CAR-1",
      {
        id: "CAR-1",
        ownerId: "HOST-1",
        maleSlots: 3,
        femaleSlots: 3,
        players: [
          { playerId: "M1", position: "男" },
          { playerId: "M2", position: "男" },
          { playerId: "M3", position: "男" },
          { playerId: "F1", position: "女" },
          { playerId: "F2", position: "女" },
          { playerId: "F3", position: "女" }
        ],
        slots: [
          { originalType: "male", playerId: "M1" },
          { originalType: "male", playerId: "M2" },
          { originalType: "male", playerId: "M3" },
          { originalType: "female", playerId: "F1" },
          { originalType: "female", playerId: "F2" },
          { originalType: "female", playerId: "F3" }
        ]
      }
    ]
  ]);

  function compactCoreCar(car) {
    return {
      id: car.id,
      maleSlots: 3,
      femaleSlots: 3,
      flexibleSlots: 0,
      totalPeople: 6,
      players: car.players,
      seatSummary: {
        maleTotal: 3,
        maleOccupied: 3,
        femaleTotal: 3,
        femaleOccupied: 3,
        flexibleTotal: 0,
        flexibleOccupied: 0,
        totalSeatCount: 6,
        occupiedSeatCount: 6,
        waitingCount: 0
      }
    };
  }

  const next = repair.repairSeatProjection(
    view,
    coreCars,
    compactCoreCar,
    "2026-09-05T06:00:00.000Z"
  );

  assert.equal(next.cars.length, 1);
  assert.equal(next.cars[0].scriptName, "無夢之城");
  assert.equal(next.cars[0].seatSummary.maleOccupied, 3);
  assert.equal(next.cars[0].seatSummary.femaleOccupied, 3);
  assert.equal(next.cars[0].seatSummary.occupiedSeatCount, 6);
  assert.equal(next.cars[0].players.length, 6);
  assert.equal(next.seatProjectionRepairChangedCount, 1);
  assert.equal(next.seatProjectionRepairRevision, 1);
});

test("Seat Projection repair 同一次掃描也移除不存在的 ghost car", () => {
  const repair = loadRepair();
  const view = {
    viewerId: "HOST-1",
    cars: [
      { id: "CAR-1", isHost: true },
      { id: "GHOST", isHost: true }
    ]
  };

  const next = repair.repairSeatProjection(
    view,
    new Map([["CAR-1", { id: "CAR-1" }]]),
    car => ({ id: car.id, players: [], seatSummary: null }),
    "2026-09-05T06:00:00.000Z"
  );

  assert.equal(Array.from(next.cars, car => car.id).join(","), "CAR-1");
  assert.equal(next.seatProjectionRepairRemovedCount, 1);
  assert.equal(next.existenceRepairRevision, 1);
});

test("已完成同 revision 的 Seat Projection repair 不會重複讀取 Core", async () => {
  const repair = loadRepair();
  let writes = 0;
  const module = {
    read: async () => ({
      viewerId: "HOST-1",
      seatProjectionRepairRevision: 1,
      cars: [{ id: "CAR-1" }]
    }),
    write: async () => { writes += 1; },
    compactCar: car => car
  };

  const result = await repair.repairSeatProjectionOnce(module, "HOST-1");

  assert.equal(result.changed, false);
  assert.equal(result.skipped, "already_repaired");
  assert.equal(writes, 0);
});
