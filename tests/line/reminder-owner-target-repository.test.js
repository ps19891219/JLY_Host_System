"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),Module=require("node:module");
const old=Module._load;
Module._load=function(req,p,m){
  if(req==="./admin")return{getFirestore:()=>{throw Error("unexpected Firestore")}};
  if(req==="./reminder-repository")return {
    getReminderRef:()=>{throw Error("injected ref expected")},
    normalizeTargetIds(v){return [...new Set((Array.isArray(v)?v:[]).map(x=>String(x||"").trim()).filter(Boolean))].slice(0,20)},
    MAX_REMINDER_TARGETS:20
  };
  return old(req,p,m);
};
const {addPreTripReminderOwnerTarget}=require("../../services/firebase/reminder-owner-target-repository");
Module._load=old;
function fixture(start){
  let state=start;const writes=[],ref={id:"preTrip"};
  const db={runTransaction:async callback=>callback({
    get:async r=>{assert.equal(r,ref);return {exists:state!=null,data:()=>state}},
    set:(r,patch,options)=>{assert.equal(r,ref);writes.push({patch,options});state={...state,...patch}}
  })};
  return {db,ref,writes,get:()=>state};
}
test("append preserves reminder schedule, content, status, capture state",async()=>{
 const f=fixture({enabled:true,status:"scheduled",scheduledAt:"2027-01-27T07:00:00Z",targetCaptureOpen:true,
  targetLineUserIds:["Ufriend"],customMessage:"自訂通知",sendTime:"09:00"});
 const r=await addPreTripReminderOwnerTarget("car-1","Uhost",f);
 assert.equal(r.included,true);assert.equal(r.totalCount,2);
 assert.deepEqual(f.get().targetLineUserIds,["Ufriend","Uhost"]);
 assert.equal(f.get().targetCaptureOpen,true);assert.equal(f.get().customMessage,"自訂通知");
 assert.equal(f.get().scheduledAt,"2027-01-27T07:00:00Z");assert.equal(f.get().status,"scheduled");
 assert.equal(f.writes.length,1);
 assert.deepEqual(Object.keys(f.writes[0].patch).sort(),["targetLineUserIds","targetUpdatedAt","updatedAt"].sort());
});
test("already included is idempotent with zero writes",async()=>{
 const f=fixture({enabled:true,status:"scheduled",targetLineUserIds:["Uhost","Ufriend"]});
 const r=await addPreTripReminderOwnerTarget("car-1","Uhost",f);
 assert.equal(r.included,true);assert.equal(r.alreadyIncluded,true);assert.equal(f.writes.length,0);
});
test("missing disabled and sent reminders do not write",async()=>{
 for(const v of [null,{enabled:false},{enabled:true,status:"sent"},{enabled:true,status:"sending"}]){
  const f=fixture(v),r=await addPreTripReminderOwnerTarget("car-1","Uhost",f);
  assert.equal(r.included,false);assert.equal(f.writes.length,0);
 }
});
test("20 person limit blocks owner addition without altering any target",async()=>{
 const full=Array.from({length:20},(_,i)=>"U"+i);
 const f=fixture({enabled:true,status:"scheduled",targetLineUserIds:full});
 const r=await addPreTripReminderOwnerTarget("car-1","Uhost",f);
 assert.equal(r.reason,"target_limit_reached");assert.equal(f.writes.length,0);
 assert.deepEqual(f.get().targetLineUserIds,full);
});
test("bad identifiers do not touch Firestore",async()=>{
 const f=fixture({enabled:true});
 assert.equal((await addPreTripReminderOwnerTarget("","Uhost",f)).reason,"invalid_reference");
 assert.equal((await addPreTripReminderOwnerTarget("car-1","",f)).reason,"invalid_reference");
 assert.equal(f.writes.length,0);
});
