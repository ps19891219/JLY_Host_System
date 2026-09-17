const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

test("Prepared-only Recruit keeps explicit public visibility gate", () => {
  const source = fs.readFileSync(
    path.join(root, "js/recruit/recruit-controller.js"),
    "utf8"
  );
  assert.match(source, /visibility/);
  assert.match(source, /public/);
  assert.equal(source.includes("missing visibility as public"), false);
});
