const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

test("MyCar normal runtime is permanently view-first without Cars query fallback", () => {
  const source = read("js/mycar.js");

  assert.match(source, /const preparedView\s*=\s*await loadMyCarPreparedView/);
  assert.match(source, /function isMyCarViewFirstEnabled\(\) \{\s*return true;/);
  assert.doesNotMatch(source, /getCarsByOwner\s*\(/);
  assert.doesNotMatch(source, /getCarsByPlayerId\s*\(/);
  assert.doesNotMatch(source, /loadMyCarDataSnapshot/);
});

test("MyCar rejects missing or malformed prepared views instead of silently falling back", () => {
  const source = read("js/mycar.js");

  assert.match(source, /mycar_view_not_bootstrapped/);
  assert.match(source, /mycar_view_invalid/);
  assert.match(source, /請由管理者執行人工 Repair/);
});

test("car creation and matching completion update prepared views from known mutations", () => {
  const createSource = read("js/createcar.js");
  const matchingSource = read("js/matching/matching-createcar.js");

  assert.match(createSource, /syncCarViewsFromKnownMutation\s*\(/);
  assert.match(matchingSource, /syncCarViewsFromKnownMutation\s*\(/);
  assert.doesNotMatch(matchingSource, /syncCarViewsFromKnownMutation[\s\S]{0,500}collection\("cars"\)[\s\S]{0,100}\.get\s*\(/);
});
