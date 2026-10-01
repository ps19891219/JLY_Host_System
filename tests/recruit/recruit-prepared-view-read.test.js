const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

function loadRecruitData(db) {
  const window = { db };
  const location = { search: "" };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "js/recruit/recruit-data.js"), "utf8"),
    { window, location, URLSearchParams, console },
    { filename: "recruit-data.js" }
  );
  return window.JLYRecruitData;
}

test("Recruit host list returns prepared car snapshots without reading cars Core", async () => {
  let coreReads = 0;
  const preparedView = {
    viewType: "mycar_index",
    cars: [
      { id: "car-1", isHost: true, visibility: "public", scriptName: "A" },
      { id: "car-2", isHost: false, isPlayer: true, visibility: "public", scriptName: "B" }
    ]
  };

  const db = {
    collection(name) {
      if (name === "cars") {
        coreReads += 1;
        throw new Error("Recruit list must not read cars Core");
      }
      if (name !== "myCarViews") throw new Error("unexpected collection: " + name);
      return {
        doc() {
          return {
            async get() {
              return { exists: true, data: () => preparedView };
            }
          };
        }
      };
    }
  };

  const data = loadRecruitData(db);
  const cars = await data.getHostCarsFromMyCarViews(["viewer-1"]);
  assert.equal(coreReads, 0);
  assert.equal(cars.length, 1);
  assert.equal(cars[0].id, "car-1");
  assert.equal(cars[0].scriptName, "A");
});


test("Recruit host list stays on one MyCar Prepared View read", async () => {
  let myCarReads = 0;
  let detailReads = 0;
  const preparedView = {
    viewType: "mycar_index",
    cars: [
      { id: "car-1", isHost: true, visibility: "public", scriptName: "A", seatSummary: { maleTotal: 3, maleOccupied: 2, femaleTotal: 3, femaleOccupied: 3 } }
    ]
  };
  const db = {
    collection(name) {
      if (name === "carDetailViews") {
        detailReads += 1;
        throw new Error("Owner Recruit list must not read per-card detail views");
      }
      if (name !== "myCarViews") throw new Error("unexpected collection: " + name);
      return { doc() { return { async get() { myCarReads += 1; return { exists: true, data: () => preparedView }; } }; } };
    }
  };
  const data = loadRecruitData(db);
  const cars = await data.getHostCarsFromMyCarViews(["viewer-1"]);
  assert.equal(cars.length, 1);
  assert.equal(myCarReads, 1);
  assert.equal(detailReads, 0);
});
