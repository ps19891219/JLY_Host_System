const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../../js/carCard.js"), "utf8");
const context = { console };
vm.runInNewContext(source, context, { filename: "js/carCard.js" });

test("MyCar owner renders the green host identity light", () => {
  assert.match(context.getIdentityDot({ isHost: true, isPlayer: false }), /identity-host/);
});

test("MyCar player-only membership renders the blue player identity light", () => {
  assert.match(context.getIdentityDot({ isHost: false, isPlayer: true }), /identity-player/);
});

test("owner and player dual role keeps owner precedence", () => {
  const result = context.getIdentityDot({ isHost: true, isPlayer: true });
  assert.match(result, /identity-host/);
  assert.doesNotMatch(result, /identity-player/);
});

test("recruitment status cannot create a host identity light", () => {
  assert.equal(context.getIdentityDot({ status: "招募中", isHost: false, isPlayer: false }), "");
});
