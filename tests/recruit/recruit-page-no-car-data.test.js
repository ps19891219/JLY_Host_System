const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.resolve(__dirname, "../../pages/recruit.html"), "utf8");

test("Recruit page does not load the Core car-data reader", () => {
  assert.equal(html.includes("js/car/car-data.js"), false);
});
