const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

test("Recruit host list read cost is not proportional to host car count", () => {
  const data = fs.readFileSync(path.join(root, "js/recruit/recruit-data.js"), "utf8");
  assert.equal(data.includes("getCarsByIds"), false);
  assert.equal(data.includes("getCarsByOwner"), false);
  assert.equal(data.includes("reverseFields"), false);
  assert.equal(data.includes("preparedViewCache"), true);
});
