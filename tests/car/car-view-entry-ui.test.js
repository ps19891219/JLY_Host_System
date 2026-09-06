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

  assert.match(html, /\/js\/car\/car-view-actions\.js\?v=3/);
  assert.match(controller, /\/api\/car-view-context\?id=/);
  assert.doesNotMatch(controller, /location\.href\s*=\s*["'][^"']*login/i);
  assert.match(actions, /fetch\("\/api\/car-view-context"/);
  assert.match(actions, /response\.status === 401/);
  assert.match(actions, /車團資訊可直接查看/);
});

test("formal car view action layer launches LINE OAuth with the proven group-assistant path", () => {
  const actions = source("js/car/car-view-actions.js");
  assert.doesNotMatch(actions, /join\.html/);
  assert.doesNotMatch(actions, /dm-join\.html/);
  assert.doesNotMatch(actions, /JLYLineLogin\.start/);
  assert.match(actions, /fetch\("\/api\/line-login-state"/);
  assert.match(actions, /client_id:\s*"2010653666"/);
  assert.match(actions, /redirect_uri:\s*`\$\{location\.origin\}\/pages\/line-callback\.html`/);
  assert.match(actions, /location\.assign\(`https:\/\/access\.line\.me\/oauth2\/v2\.1\/authorize\?/);
  assert.match(actions, /returnPath/);
  assert.match(actions, /車團報名 LINE OAuth 啟動失敗/);
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
