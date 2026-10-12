"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../js/car/car-calendar-add.js"),"utf8");
const event={carId:"car-1",title:"劇本－測試車車",start:"2026-10-20T01:00:00.000Z",end:"2026-10-20T02:00:00.000Z",timeZone:"Asia/Taipei",location:"台北",description:"公開活動",googleUrl:"https://calendar.google.com/calendar/r/eventedit"};
async function make(options={}){
 const elements=new Map(),calls=[];let clicked=null,grants=0;
 const ids=["google","title","times","location","ics","fallback","loading","details","actions","status"];
 for(const id of ids)elements.set(id,{textContent:"",hidden:false,disabled:false,href:"",addEventListener(_kind,fn){clicked=fn;}});
 const fetch=async(uri,opt={})=>{
  calls.push({uri:String(uri),method:opt.method||"GET",body:opt.body});
  if(String(uri).startsWith("/api/car-calendar-event"))
   return {ok:true,json:async()=>({success:true,event})};
  if(String(uri).includes("/calendars/primary/events?"))
   return {ok:true,json:async()=>({items:options.existing?[{status:"confirmed",extendedProperties:{private:{carId:"car-1"}}}]:[]})};
  if(String(uri).endsWith("/calendars/primary/events"))
   return {ok:true,json:async()=>({id:"google-event-1"})};
  throw Error("unexpected fetch: "+uri);
 };
 const sandbox={
  document:{getElementById:id=>elements.get(id)},
  location:{search:"?id=car-1"},URLSearchParams,Date,Intl,
  fetch,confirm:()=>options.confirm!==false,
  window:{JLYCalendarAuth:{requestAccessToken:async()=>{grants++;return "access-token";}}},
  console
 };
 vm.runInNewContext(source,sandbox,{filename:"car-calendar-add.js"});
 await new Promise(resolve=>setImmediate(resolve));
 return {elements,calls,clicked,grants:()=>grants};
}
test("mobile Google flow obtains consent and writes once after explicit click",async()=>{
 const ui=await make();
 assert.equal(ui.calls.length,1);
 assert.equal(ui.elements.get("title").textContent,"劇本－測試車車");
 await ui.clicked();
 assert.equal(ui.grants(),1);
 assert.equal(ui.calls.filter(x=>x.method==="POST").length,1);
 assert.match(ui.elements.get("status").textContent,/成功加入/);
});
test("Google dedupe prevents another POST for an existing JLY car",async()=>{
 const ui=await make({existing:true});
 await ui.clicked();
 assert.equal(ui.calls.filter(x=>x.method==="POST").length,0);
 assert.match(ui.elements.get("status").textContent,/沒有重複建立/);
});
test("Google confirmation cancel does not write an event",async()=>{
 const ui=await make({confirm:false});
 await ui.clicked();
 assert.equal(ui.calls.filter(x=>x.method==="POST").length,0);
 assert.match(ui.elements.get("status").textContent,/已取消/);
});
