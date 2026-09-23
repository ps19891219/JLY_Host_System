const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("MyCar page does not auto-load legacy full recovery on every visit", () => {
  const html = read("pages/mycar.html");
  assert.doesNotMatch(
    html,
    /<script\s+src="\/js\/modules\/car\/identity\/mycar-legacy-identity-repair\.js\?v=13"><\/script>/
  );
  assert.doesNotMatch(html, /mycar-prepared-view-upgrade\.js/);
  assert.doesNotMatch(html, /loadLegacyRecovery/);
});

test("prepared view upgrader migrates only IDs already indexed in the view", () => {
  const source = read("js/modules/car/identity/mycar-prepared-view-upgrade.js");
  assert.match(source, /getCarsByIds\(carIds\)/);
  assert.doesNotMatch(source, /collection\(["']cars["']\)\.get\(/);
  assert.doesNotMatch(source, /getCarsByOwner\(/);
  assert.doesNotMatch(source, /getCarsByPlayerId\(/);
});

test("prepared view upgrader aborts instead of dropping missing historical cars", () => {
  const source = read("js/modules/car/identity/mycar-prepared-view-upgrade.js");
  assert.match(source, /core_rows_missing/);
  assert.match(source, /if \(missingIds\.length\)/);
});