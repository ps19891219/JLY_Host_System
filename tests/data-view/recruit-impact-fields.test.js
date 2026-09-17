const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

test("Recruit-visible car mutations invalidate MyCar Prepared View", () => {
  const window = {};
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "js/data-view/view-impact-resolver.js"), "utf8"),
    { window, console, Set, Array, String },
    { filename: "view-impact-resolver.js" }
  );
  for (const field of ["visibility", "coverImageUrl", "myRole", "totalPeople", "players"]) {
    assert.equal(window.JLYViewImpactResolver.resolveCarViews([field]).includes("mycar"), true, field);
  }
});
