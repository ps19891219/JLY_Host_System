"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");
}

test("car view loads the unified entry action layer without blocking anonymous rendering", () => {
  const html = source("pages/car-view.html");
  const controller = source("js/car/car-view.js");
  const actions = source("js/car/car-view-actions.js");

  assert.match(html, /\/js\/car\/car-view-actions\.js/);
  assert.match(html, /\/js\/line\.js/);
  assert.match(controller, /\/api\/car-view-context\?id=/);
  assert.doesNotMatch(controller, /location\.href\s*=\s*["'][^"']*login/i);
  assert.match(actions, /\/api\/car-entry/);
  assert.match(actions, /identity_required|response\.status === 401/);
  assert.match(actions, /車團資訊可直接查看/);
});

test("formal car view action layer no longer routes player or DM writes to legacy join pages", () => {
  const actions = source("js/car/car-view-actions.js");
  assert.doesNotMatch(actions, /join\.html/);
  assert.doesNotMatch(actions, /dm-join\.html/);
  assert.match(actions, /entry=\$\{encodeURIComponent\(entry\)\}/);
});

test("legacy join pages remain present but are no longer the LINE or car-view action target", () => {
  assert.equal(fs.existsSync(path.join(__dirname, "../../pages/join.html")), true);
  assert.equal(fs.existsSync(path.join(__dirname, "../../pages/dm-join.html")), true);

  const welcome = source("services/line/member-welcome-card.js");
  const renderer = source("js/car/car-view-render.js");
  assert.doesNotMatch(welcome, /dm-join\.html/);
  assert.doesNotMatch(welcome, /pages\/join\.html/);
  // The legacy renderer link is intercepted by car-view-actions until the
  // renderer itself can be simplified in a later cleanup without UI churn.
  assert.match(renderer, /pages\/join\.html/);
});
