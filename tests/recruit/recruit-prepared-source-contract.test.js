const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../../js/recruit/recruit-data.js"), "utf8");

test("Recruit prepared source contract", () => {
  assert.match(source, /myCarViews/);
  assert.match(source, /carDetailViews/);
  assert.doesNotMatch(source, /collection\(["']cars["']\)/);
});
