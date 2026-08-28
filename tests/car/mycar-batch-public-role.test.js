const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(
    path.join(__dirname, "../..", relativePath),
    "utf8"
  );
}

test("MyCar identity display keeps player blue and host green", () => {
  const source = read("js/carCard.js");

  assert.match(source, /car\.role === "player"/);
  assert.match(source, /identity-player[^\n]*title="我是玩家"[^\n]*#3b82f6/);
  assert.match(source, /identity-host[^\n]*title="我是主揪"[^\n]*#22c55e/);
});

test("batch operation writes canonical car visibility to public", () => {
  const source = read("js/carCard.js");

  assert.match(source, /async function setSelectedCarsPublic/);
  assert.match(source, /visibility: "public"/);
  assert.match(source, /collection\("cars"\)/);
  assert.match(source, /非主揪車已略過/);
});

test("maintenance reset clears accounting-prefixed subcollections only on owned cars", () => {
  const source = read("api/maintenance-reset-current-accounting.js");

  assert.match(source, /where\("ownerId", "==", id\)/);
  assert.match(source, /\^accounting\/i/);
  assert.match(source, /collection\("reminders"\)\.doc\("preTrip"\)/);
  assert.match(source, /sendTime: "09:00"/);
});
