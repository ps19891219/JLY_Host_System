"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {routeEvent} = require("../../services/line/event-router");
const {syncRosterReminderTargets} = require("../../services/line/reminder-service");
const baseCar = {id:"car-one",ownerId:"owner-person",gameDate:"2027-01-28",gameTime:"09:00",scriptName:"知因"};
function ev(text="新增女位 @甲 @乙") {
  return {type:"message",timestamp:1,replyToken:"token",source:{type:"group",groupId:"group-one",userId:"host-line"},
    message:{id:"msg",type:"text",text,mention:{mentionees:[
      {type:"user",userId:"U1",index:5,length:2},{type:"user",userId:"U2",index:8,length:2}
    ]}}};
}
function options(override={}) {return {
  resolveGroupBinding:async()=>({bound:true,binding:{carId:"car-one",groupId:"group-one"}}),
  addMentionedRosterMembers:async()=>({changed:true,addedCount:2,seatedCount:2,afterCar:baseCar}),
  ...override
};}
test("female roster command auto registers reminder targets in same message",async()=>{
  let text="",given;
  const r=await routeEvent(ev(),options({
    syncRosterReminderTargets:async(carId,car,mentions)=>{given={carId,car,mentions};return {captured:true,totalCount:2,addedCount:2}},
    sendTextReply:async(_t,reply)=>{text=reply}
  }));
  assert.equal(r.route,"assistant_roster_added");
  assert.equal(given.carId,"car-one");
  assert.deepEqual(given.mentions.map(x=>x.userId),["U1","U2"]);
  assert.match(text,/已開啟行前通知/);
  assert.match(text,/提醒名單：2 人/);
});
test("male command syncs reminders but DM does not",async()=>{
  for(const [phrase,expected] of [["新增男位 @甲 @乙",1],["新增DM @甲 @乙",0]]) {
    let count=0;
    await routeEvent(ev(phrase),options({
      syncRosterReminderTargets:async()=>{count++;return {captured:true,totalCount:2}},
      sendTextReply:async()=>{}
    }));
    assert.equal(count,expected);
  }
});
test("authorized roster already containing players can add reminders idempotently",async()=>{
  let count=0,text="";
  const r=await routeEvent(ev(),options({
    addMentionedRosterMembers:async()=>({changed:false,reason:"no_roster_change",beforeCar:baseCar}),
    syncRosterReminderTargets:async()=>{count++;return {captured:true,totalCount:2}},
    sendTextReply:async(_t,v)=>{text=v}
  }));
  assert.equal(count,1);
  assert.match(text,/不需要重複新增/);
  assert.match(text,/提醒名單：2 人/);
  assert.equal(r.rosterReminderResult.captured,true);
});
test("failed permission does not activate reminders",async()=>{
  let count=0;
  const r=await routeEvent(ev(),options({
    addMentionedRosterMembers:async()=>({changed:false,reason:"owner_or_manager_required"}),
    syncRosterReminderTargets:async()=>{count++},
    sendTextReply:async()=>{}
  }));
  assert.equal(count,0);
  assert.equal(r.route,"assistant_roster_add_failed");
});
test("failed reminder sync leaves successful roster but warns instead of claiming success",async()=>{
  let text="";
  const r=await routeEvent(ev(),options({
    syncRosterReminderTargets:async()=>{throw new Error("write failed")},
    sendTextReply:async(_t,v)=>{text=v}
  }));
  assert.equal(r.route,"assistant_roster_added");
  assert.equal(r.rosterReminderResult.reason,"reminder_sync_failed");
  assert.match(text,/提醒名單未同步成功/);
  assert.doesNotMatch(text,/已開啟行前通知/);
});
test("service uses same mentioned userIds and existing enable/capture implementation",async()=>{
  let calls=[];
  const result=await syncRosterReminderTargets("car-one",baseCar,[{type:"user",userId:"U1"},{type:"user",userId:"U2"}],{
    enableGroupPreTripReminder:async(id,car)=>{calls.push(["enable",id,car.id]);return {enabled:true,alreadyEnabled:false,reminder:{status:"scheduled"}}},
    captureGroupReminderTargets:async(id,mentions)=>{calls.push(["capture",id,mentions.map(x=>x.userId)]);return {captured:true,totalCount:2,addedCount:2}}
  });
  assert.equal(result.captured,true);
  assert.equal(result.enabled,true);
  assert.deepEqual(calls,[["enable","car-one","car-one"],["capture","car-one",["U1","U2"]]]);
});
test("no @all, unavailable userIds, or disabled reminder may be falsely reported as captured",async()=>{
  assert.equal((await syncRosterReminderTargets("car-one",baseCar,[{type:"all"}],{})).reason,"mention_all_not_supported");
  assert.equal((await syncRosterReminderTargets("car-one",baseCar,[{type:"user"}],{})).reason,"mention_user_id_unavailable");
  let calls=0;
  const r=await syncRosterReminderTargets("car-one",baseCar,[{type:"user",userId:"U1"}],{
    enableGroupPreTripReminder:async()=>({enabled:false,reason:"car_date_required"}),
    captureGroupReminderTargets:async()=>{calls++}
  });
  assert.equal(r.captured,false);
  assert.equal(r.reason,"car_date_required");
  assert.equal(calls,0);
});
