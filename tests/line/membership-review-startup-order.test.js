"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../../js/line/membership-review-page.js"),
  "utf8"
);

test("LINE membership review renders existing snapshots before one-time repair", () => {
  const startup = source.match(/document\.addEventListener\("DOMContentLoaded",async\(\)=>\{([^}]*)\}\);/);
  assert.ok(startup, "DOMContentLoaded startup handler should exist");
  const body = startup[1];
  const firstRender = body.indexOf("await render()");
  const repair = body.indexOf("await repairMissingSnapshotsOnce()");
  assert.ok(firstRender >= 0, "startup should render existing review data");
  assert.ok(repair > firstRender, "one-time repair must run only after the first render");
});

test("one-time LINE repair failure cannot suppress the normal review render", () => {
  assert.match(source, /async function repairMissingSnapshotsOnce\(\)\{try\{/);
  assert.match(source, /catch\(e\)\{console\.warn\("LINE membership one-time repair skipped",e\);return false;\}/);
  assert.match(source, /if\(repaired\)await render\(\)/);
});
