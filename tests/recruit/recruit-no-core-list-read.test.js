const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Recruit list modules do not read cars Core or hydrate through JLYCarData", () => {
  const data = read("js/recruit/recruit-data.js");
  const controller = read("js/recruit/recruit-controller.js");
  const page = read("pages/recruit.html");

  assert.equal(data.includes('collection("cars")'), false);
  assert.equal(data.includes("collection('cars')"), false);
  assert.equal(controller.includes("JLYCarData"), false);
  assert.equal(page.includes("js/car/car-data.js"), false);
});

test("Recruit identity resolution uses prepared alias/view indexes instead of players reverse scans", () => {
  const data = read("js/recruit/recruit-data.js");
  assert.equal(data.includes('collection("players")'), false);
  assert.equal(data.includes("linkedPlayerIds lookup"), false);
  assert.equal(data.includes("myCarViewAliases"), true);
  assert.equal(data.includes("myCarViews"), true);
});
