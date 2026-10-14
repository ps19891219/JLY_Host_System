"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {buildMobileCalendarEvent,buildMobileCalendarDraft,buildMobileCalendarEventWithEnd,buildIcs}=require("../../services/line/mobile-calendar-event");
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
 assert.equal(res.statusCode,200);
 const result=JSON.parse(res.body);
 assert.equal(result.event,null);
 assert.equal(result.draft.canChooseEnd,true);
 assert.equal(result.draft.start,"2026-10-20T01:00:00.000Z");
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

test("manual end for an incomplete car is explicit, without modifying car data",()=>{
 const incomplete={...car,calendar:{},durationMinutes:null};
 const before=JSON.stringify(incomplete);
 const draft=buildMobileCalendarDraft(incomplete,"car-1");
 assert.equal(draft.start,"2026-10-20T01:00:00.000Z");
 assert.equal(draft.canChooseEnd,true);
 assert.equal(buildMobileCalendarEvent(incomplete,"car-1"),null);
 const event=buildMobileCalendarEventWithEnd(incomplete,"car-1","2026-10-20T12:00");
 assert.equal(event.start,"2026-10-20T01:00:00.000Z");
 assert.equal(event.end,"2026-10-20T04:00:00.000Z");
 assert.equal(event.manualEnd,true);
 assert.equal(JSON.stringify(incomplete),before);
});
test("invalid, earlier or out-of-range manual end is rejected",()=>{
 const incomplete={...car,calendar:{},durationMinutes:null};
 for(const end of ["","bogus","2026-10-20T08:00","2026-10-20T09:00","2026-10-28T10:00","2026-02-30T12:00"]){
  assert.equal(buildMobileCalendarEventWithEnd(incomplete,"car-1",end),null,end);
 }
});
test("existing official event end always takes precedence over selection",()=>{
 const event=buildMobileCalendarEventWithEnd(car,"car-1","2026-10-20T18:00");
 assert.equal(event.end,"2026-10-20T02:00:00.000Z");
 assert.equal(event.manualEnd,undefined);
});
test("incomplete start cannot be guessed or manually finalized",()=>{
 const carNoStart={...car,gameTime:"",calendar:{}};
 const draft=buildMobileCalendarDraft(carNoStart,"car-1");
 assert.equal(draft.start,null);
 assert.equal(draft.canChooseEnd,false);
 assert.equal(buildMobileCalendarEventWithEnd(carNoStart,"car-1","2026-10-20T12:00"),null);
});
test("selected end URL and ICS use one exact Prepared View document each",async()=>{
 const incomplete={...car,calendar:{},durationMinutes:null};
 const readIds=[];
 const handler=createHandler({getCarDetailViewById:async id=>{readIds.push(id);return incomplete;}});
 const response=fakeResponse();
 await handler({method:"GET",query:{id:"car-1",end:"2026-10-20T12:00"}},response);
 assert.equal(response.statusCode,200);
 assert.equal(JSON.parse(response.body).event.end,"2026-10-20T04:00:00.000Z");
 const ics=fakeResponse();
 await handler({method:"GET",query:{id:"car-1",end:"2026-10-20T12:00",format:"ics"}},ics);
 assert.equal(ics.statusCode,200);
 assert.match(ics.body,/DTEND:20261020T040000Z/);
 const noEnd=fakeResponse();
 await handler({method:"GET",query:{id:"car-1",format:"ics"}},noEnd);
 assert.equal(noEnd.statusCode,422);
 assert.deepEqual(readIds,["car-1","car-1","car-1"]);
});
