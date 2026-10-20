"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {buildCalendarFeed,escapeText,localStamp}=require("../../services/calendar/ics-feed");
test("preserves stable UID, timezone, revision and cancellation",()=>{
  const event={carId:"car_123",gameDate:"2027-10-04",gameTime:"19:00",durationMinutes:180,scriptName:"孤注",sequence:2,updatedAt:"2026-10-20T09:00:00Z"};
  const a=buildCalendarFeed([event],{generatedAt:"2026-10-20T10:00:00Z"});
  const b=buildCalendarFeed([{...event,gameTime:"20:00",sequence:3,cancelled:true}],{generatedAt:"2026-10-20T10:00:00Z"});
  assert.match(a,/UID:car_123@calendar\.jly-host-system/);
  assert.match(b,/UID:car_123@calendar\.jly-host-system/);
  assert.match(a,/DTSTART;TZID=Asia\/Taipei:20271004T190000/);
  assert.match(a,/DTEND;TZID=Asia\/Taipei:20271004T220000/);
  assert.match(b,/SEQUENCE:3/);
  assert.match(b,/STATUS:CANCELLED/);
});
test("escapes ICS text and rejects invalid dates",()=>{
  assert.equal(escapeText("A,B;C\\D\nE"),"A\\,B\\;C\\\\D\\nE");
  assert.throws(()=>localStamp("2027-02-30","19:00"),/invalid_calendar_datetime/);
  assert.throws(()=>buildCalendarFeed([{carId:"../bad",gameDate:"2027-10-04",gameTime:"19:00"}]),/invalid_car_id/);
});
