const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

test("Assist-only Recruit cards use carDetailViews rather than cars Core", () => {
  const data = fs.readFileSync(path.join(root, "js/recruit/recruit-data.js"), "utf8");
  const controller = fs.readFileSync(path.join(root, "js/recruit/recruit-controller.js"), "utf8");
  assert.equal(data.includes('collection("carDetailViews")'), true);
  assert.equal(data.includes('collection("cars")'), false);
  assert.equal(controller.includes("getPreparedCarsByIds"), true);
  assert.equal(controller.includes("getCarsByIds"), false);
});
