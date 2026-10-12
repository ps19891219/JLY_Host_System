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
 assert.equal(buildMobileCalendarEvent({...car,gameDate:"2027-02-29"},"car-1"),null);
 assert.equal(buildMobileCalendarEvent(car,""),null);
});
test("calendar API only fetches one Prepared View by ID and returns safe payload",async()=>{
 const reads=[];
 const handler=createHandler({getCarDetailViewById:async id=>{reads.push(id);return {...car,note:"主揪私密備註",lineUserId:"secret"};}});
 let res=fakeResponse();await handler({method:"GET",query:{id:"car-1"}},res);
 assert.equal(res.statusCode,200);const data=JSON.parse(res.body);
 assert.equal(data.event.start,"2026-10-20T01:00:00.000Z");
 assert.equal(data.event.note,undefined);assert.equal(data.event.lineUserId,undefined);
 assert.deepEqual(reads,["car-1"]);
 res=fakeResponse();await handler({method:"GET",query:{id:"car-1",format:"ics"}},res);
 assert.equal(res.statusCode,200);assert.match(res.headers["content-type"],/text\/calendar/);
 assert.match(res.body,/BEGIN:VEVENT/);assert.deepEqual(reads,["car-1","car-1"]);
});
test("API refuses missing time and never assumes default duration",async()=>{
 const handler=createHandler({getCarDetailViewById:async()=>({...car,calendar:{}})});
 const res=fakeResponse();await handler({method:"GET",query:{id:"car-1"}},res);
 assert.equal(res.statusCode,422);
});
test("LINE card and mobile UI use existing Google auth, no duplicate Activity backend",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../../pages/car-calendar-add.html"),"utf8");
 const ui=fs.readFileSync(path.join(__dirname,"../../js/car/car-calendar-add.js"),"utf8");
 assert.match(html,/viewport-fit=cover/);
 assert.match(ui,/JLYCalendarAuth\.requestAccessToken/);
 assert.match(ui,/privateExtendedProperty/);
 assert.match(ui,/confirm\(/);
 assert.match(ui,/format=ics/);
 assert.doesNotMatch(ui,/\/api\/car-view-context/);
});
