"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const api = fs.readFileSync(
  path.join(__dirname, "../../api/maintenance-reset-current-accounting.js"),
  "utf8"
);
const mycar = fs.readFileSync(
  path.join(__dirname, "../../pages/mycar.html"),
  "utf8"
);

test("accounting reset resolves current LINE session through canonical historical Person component", () => {
  assert.match(api, /listPlayersForIdentityResolution/);
  assert.match(api, /buildIdentityComponent\(players, lineUserId\)/);
  assert.match(api, /component\.ids\.forEach/);
  assert.match(api, /owner_identity_conflict/);
});

test("accounting reset recognizes all supported formal car owner fields without name matching", () => {
  assert.match(api, /getCarOwnerIds\(car\.data\)/);
  assert.match(api, /ids\.has\(ownerId\)/);
  assert.doesNotMatch(api, /playerName|displayName|nickname/);
});

test("accounting-only reset remains scoped to accounting-prefixed subcollections", () => {
  assert.match(api, /\^accounting\/i/);
  assert.match(api, /RESET_ACCOUNTING_ONLY/);
  assert.match(api, /remindersMigrated: 0/);
});

test("My Car menu exposes the accounting reset entry", () => {
  assert.match(mycar, /帳務重新歸零/);
  assert.match(mycar, /accounting-reset\.html/);
});
