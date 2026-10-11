"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {buildGoogleCalendarPrefillUrl}=require("../../services/line/google-calendar-prefill-url");
const {buildMemberWelcomeCard}=require("../../services/line/member-welcome-card");
const car={scriptName:"孤注 & 花火",gameDate:"2027-10-04",gameTime:"19:30",calendar:{eventDurationMinutes:180},studioName:"小巷劇本館",locationName:"台北市中山區",publicNote:"請提前抵達"};
function params(value){const uri=buildGoogleCalendarPrefillUrl(value);assert.ok(uri);const parsed=new URL(uri);assert.equal(parsed.hostname,"calendar.google.com");assert.equal(parsed.pathname,"/calendar/r/eventedit");return parsed.searchParams;}
test("personal Google event has Taiwan local date converted to UTC",()=>{const p=params(car);assert.equal(p.get("dates"),"20271004T113000Z/20271004T143000Z");assert.equal(p.get("stz"),"Asia/Taipei");assert.equal(p.get("etz"),"Asia/Taipei");assert.equal(p.get("text"),"劇本－孤注 & 花火");assert.equal(p.get("location"),"小巷劇本館｜台北市中山區");});
test("cross-midnight duration and explicit next-day end are exact",()=>{assert.equal(params({scriptName:"夜場",gameDate:"2027-10-04",gameTime:"23:00",durationMinutes:480}).get("dates"),"20271004T150000Z/20271004T230000Z");assert.equal(params({scriptName:"夜場",gameDate:"2027-10-04",gameTime:"20:00",endDate:"2027-10-05",endTime:"01:30"}).get("dates"),"20271004T120000Z/20271004T173000Z");});
test("���q�^