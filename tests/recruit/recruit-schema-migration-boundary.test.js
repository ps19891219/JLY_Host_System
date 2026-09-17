const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

test("Recruit does not assume missing prepared visibility is public", () => {
  const controller = fs.readFileSync(
    path.join(root, "js/recruit/recruit-controller.js"),
    "utf8"
  );
  assert.match(controller, /car\.visibility\s*\|\|\s*""/);
  assert.match(controller, /===\s*"public"/);
});
