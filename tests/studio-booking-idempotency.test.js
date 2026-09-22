"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const service=require("../services/studio/studio-booking-activity-service");

test("booking-created Activity id is deterministic per booking",()=>{
  assert.equal(service.activityIdForBooking("abc123"),"studio-booking-abc123");
  assert.equal(service.activityIdForBooking("abc123"),service.activityIdForBooking("abc123"));
  assert.notEqual(service.activityIdForBooking("abc123"),service.activityIdForBooking("def456"));
});

test("confirmBooking reuses the deterministic booking Activity instead of allocating a random Car",()=>{
  const src=fs.readFileSync("services/studio/studio-booking-activity-service.js","utf8");
  assert.match(src,/activityIdForBooking\(booking\.id\)/);
  assert.match(src,/prior=await r\.get\(\)/);
  assert.match(src,/booking_activity_id_collision/);
  assert.doesNotMatch(src,/collection\("cars"\)\.doc\(\)/);
});
