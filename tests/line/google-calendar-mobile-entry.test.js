"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {buildMobileCalendarEvent,buildIcs}=require("../../services/line/mobile-calendar-event");
const {createHandler}=require("../../api/car-calendar-event");
const car={id:"car-1",scriptName:"測試車車",gameDate:"2026-10-20",gameTime:"09:00",calendar:{eventDurationMinutes:60},locationName:"台北",publicNote:"群組見"};
function fakeResponse(){return {headers:{},setHeader(key,v){this.headers[key.toLowerCase()]=v;},end(body){this.body=body;}};}
test("mobile event exact Taiwan timestamps and ICS download",()=>{
 const ev=buildMobileCalendarEvent(car,"car-1");
 assert.equal(ev.start,"2026-10-20T01:00:00.000Z");
 assert.equal(ev.end,"2026-10-20T02:00:00.000Z");
 assert.match(ev.title,/測試車車/);
 const ics=buildIcs(ev);
 assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,/DTSTART:20261020T010000Z/);
 assert.match(ics,/DTEND:20261020T020000Z/);assert.match(ics,/UID:jly-car-/);
});
test("cross-midnight ICS correctly ends on next day",()=>{
 const ev=buildMobileCalendarEvent({...car,gameDate:"2027-10-04",gameTime:"23:00",calendar:{eventDurationMinutes:240}},"overnight");
 assert.equal(ev.start,"2027-10-04T15:00:00.000Z");
 assert.equal(ev.end,"2027-10-04T19:00:00.000Z");
});
test("unsafe or incomplete schedule never generates ICS",()=>{
 assert.equal(buildMobileCalendarEvent({...car,calendar:{},durationMinutes:null},"car-1"),null);
 ���q�^