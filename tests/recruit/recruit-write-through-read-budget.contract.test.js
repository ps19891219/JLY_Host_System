const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");

function source(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("Recruit vacancy text uses existing seatSummary without extra reads", () => {
  const render = source("js/recruit/recruit-render.js");
  assert.match(render, /seatSummary/);
  assert.match(render, /maleNeed/);
  assert.match(render, /femaleNeed/);
  assert.doesNotMatch(render, /collection\(["']cars["']\)/);
});

test("Recruit owner list stays on the single MyCar Prepared View path", () => {
  const controller = source("js/recruit/recruit-controller.js");
  assert.match(controller, /getRecruitCarsByOwner\(recruitPage\.ownerId\)/);
  assert.doesNotMatch(controller, /hostIndexCars/);
});

test("LINE identity-claim approval writes known mutation into Prepared Views without rereading Core for View sync", () => {
  const approval = source("js/modules/car/detail/application/identity-claim-approval.js");
  assert.match(approval, /syncIdentityClaimCarViews/);
  assert.match(approval, /beforeCarForView/);
  assert.match(approval, /afterCarForView/);
  assert.doesNotMatch(approval, /syncFromCore/);
});

test("rejected player application also refreshes existing Prepared View", () => {
  const actions = source("js/modules/car/detail/application/application-actions.js");
  const rejectStart = actions.indexOf("async function rejectApplication");
  assert.notEqual(rejectStart, -1);
  const rejectBlock = actions.slice(rejectStart, rejectStart + 7000);
  assert.match(rejectBlock, /syncCarPreparedViewMutation/);
});
