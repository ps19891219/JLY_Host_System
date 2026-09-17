const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

test("MyCar Prepared View stores Recruit card fields", () => {
  const window = {};
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "js/data-view/mycar-view.js"), "utf8"),
    { window, console, Date, Set },
    { filename: "mycar-view.js" }
  );

  const compact = window.JLYMyCarView.compactCar({
    id: "car-1",
    ownerId: "viewer-1",
    myRole: "host",
    visibility: "public",
    scriptName: "Test",
    coverImageUrl: "cover.jpg",
    totalPeople: 6,
    players: []
  }, ["viewer-1"]);

  assert.equal(window.JLYMyCarView.SCHEMA_VERSION, 6);
  assert.equal(compact.visibility, "public");
  assert.equal(compact.coverImageUrl, "cover.jpg");
  assert.equal(compact.myRole, "host");
  assert.equal(compact.isHost, true);
});
