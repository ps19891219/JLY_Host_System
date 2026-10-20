"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {buildAuthorizedCarFeed}=require("../../services/calendar/authorized-car-feed");
test("authorized feed uses existing car event resolution without a database query",()=>{
 const ics=buildAuthorizedCarFeed([{carId:"abc123",car:{scriptName:"測試劇本",gameDate:"2027-10-04",gameTime:"19:00",gameEndTime:"22:00",gameEndDate:"2027-10-04"}}],{generatedAt:"2026-10-20T10:00:00Z"});
 assert.match(ics,/UID:abc123@calendar\.jly-host-system/);
 assert.match(ics,/DTSTART;TZID=Asia\/Taipei:20271004T190000/);
 assert.match(ics,/DTEND;TZID=Asia\/Taipei:20271004T220000/);
});
test("missing formal event is skipped rather than inventing a duration",()=>{
 const ics=buildAuthorizedCarFeed([{carId:"abc123",car:{scriptName:"測試劇本",gameDate:"2027-10-04",gameTime:"19:00"}}],{generatedAt:"2026-10-20T10:00:00Z"});
 assert.doesNotMatch(ics,/BEGIN:VEVENT/);
});
