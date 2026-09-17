const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

function loadPermissions(identity) {
  const window = {
    JLYIdentity: identity,
    localStorage: { getItem() { return ""; } },
    sessionStorage: { getItem() { return null; } }
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "js/modules/car/detail/core/permissions.js"), "utf8"),
    { window, console, localStorage: window.localStorage, sessionStorage: window.sessionStorage },
    { filename: "permissions.js" }
  );
  return window.JLYPermissions;
}

test("creator can edit even when participant role is player", () => {
  const permissions = loadPermissions({
    getCurrentPlayerId: () => "current",
    getAllPlayerIdentityIds: () => ["current", "creator-alias"],
    isSystemAdminMode: () => false
  });
  const car = {
    ownerId: "creator-alias",
    myRole: "player",
    isHost: false,
    isPlayer: true
  };
  assert.equal(permissions.canEditCar(car), true);
  assert.equal(permissions.explainCarPermission(car).reason, "car_owner");
});

test("player role alone does not grant ownership edit permission", () => {
  const permissions = loadPermissions({
    getCurrentPlayerId: () => "me",
    getAllPlayerIdentityIds: () => ["me"],
    isSystemAdminMode: () => false
  });
  const car = {
    ownerId: "someone-else",
    myRole: "player",
    isHost: false,
    isPlayer: true
  };
  assert.equal(permissions.canEditCar(car), false);
});

test("host role alone is not silently treated as ownership", () => {
  const permissions = loadPermissions({
    getCurrentPlayerId: () => "me",
    getAllPlayerIdentityIds: () => ["me"],
    isSystemAdminMode: () => false
  });
  const car = {
    ownerId: "someone-else",
    myRole: "host",
    isHost: true,
    isPlayer: false
  };
  assert.equal(permissions.canEditCar(car), false);
});
