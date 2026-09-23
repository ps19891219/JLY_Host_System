"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("host request approval must use owning lifecycle command",()=>{
  const src=fs.readFileSync("services/studio/studio-operations-command-service.js","utf8");
  assert.match(src,/lifecycle\.approveCancellation/);
  assert.match(src,/host_request_reschedule_requires_activity_change_command/);
  assert.doesNotMatch(src,/status:d==="approve"\?"accepted":"rejected"/);
});

test("activity cancellation preserves history and removes recruitment without deleting Activity",()=>{
  const src=fs.readFileSync("services/studio/studio-activity-lifecycle-service.js","utf8");
  assert.match(src,/status:"cancelled"/);
  assert.match(src,/recruitment\.syncActivity\(afterActivity\)/);
  assert.doesNotMatch(src,/\.delete\(/);
});
