"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("LINE membership review diagnostics render group names and use the refreshed asset", function () {
  const root = path.resolve(__dirname, "../..");
  const js = fs.readFileSync(path.join(root, "js/line/membership-review-page.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "pages/line-membership-review.html"), "utf8");

  assert.match(js, /sample&&sample\.groupName/);
  assert.match(js, /LINE 群組：/);
  assert.match(html, /membership-review-page\.js\?v=4/);
});
