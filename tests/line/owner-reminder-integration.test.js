"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {routeEvent}=require("../../services/line/event-router");
const car={id:"car-one",ownerId:"owner-profile",gameDate:"2027-01-28",gameTime:"09:00",scriptName:"知因"};
function event(text="新增女位 @甲"){return {type:"message",timestamp:1,replyToken:"token",
 source:{type:"group",groupId:"group-one",userId:"Uhost"},
 message:{id:"m1",type:"text",text,mention:{mentionees:[{type:"user",userId:"Ufriend",index:5,length:2}]}}};}
const deps=extra=>({resolveGroupBinding:async()=>({bound:true,binding:{groupId:"group-one",carId:"car-one"}}),...extra});
test("authorized female roster also adds host without @self",async()=>{
 let called=[],reply="";
 const r=await routeEvent(event(),deps({
   addMentionedRosterMembers:async()=>({changed:true,addedCount:1,seatedCount:1,afterCar:car}),
   syncRosterReminderTargets:async()=>({enabled:true,captured:true,totalCount:1,addedCount:1}),
   syncOwnerReminderTarget:async(id,c,ctx)=>{called.push([id,c.id,ctx.source.userId]);return {included:true,totalCount:2}},
   sendTextReply:async(_t,s)=>{reply=s}
 }));
 assert.equal(r.route,"assistant_roster_added");assert.deepEqual(called,[["car-one","car-one","Uhost"]]);
 assert.match(reply,/主揪已列入提醒名單/);assert.match(reply,/提醒名單：2 人/);
});
test("unauthorized roster cannot add host or enable reminder",async()=>{
 let count=0;
 const r=await routeEvent(event(),deps({
   addMentionedRosterMembers:async()=>({changed:false,reason:"owner_or_manager_required"}),
   syncOwnerReminderTarget:async()=>{count++;return{included:true}},
   sendTextReply:async()=>{}
 }));
 assert.equal(r.route,"assistant_roster_add_failed");assert.equal(count,0);
});
test("explicit enable adds host and reports updated target count",async()=>{
 let count=0,reply="";
 const r=await routeEvent(event("開啟行前通知"),deps({
   getCarById:async()=>car,
   enableGroupPreTripReminder:async()=>({enabled:true,alreadyEnabled:true,reminder:{targetLineUserIds:["Ufriend"]}}),
   syncOwnerReminderTarget:async()=>{count++;return{included:true,totalCount:2}},
   sendTextReply:async(_t,s)=>{reply=s}
 }));
 assert.equal(count,1);assert.equal(r.handled,true);
 assert.match(reply,/主揪加入提醒名單/);assert.match(reply,/目前提醒名單：2 人/);
});
test("read-only reminder status never writes owner",async()=>{
 let ownerWrites=0,reply="";
 const r=await routeEvent(event("JLY 提醒"),deps({
   getReminderStatus:async()=>({configured:true,enabled:true,reminder:{status:"scheduled",scheduledAt:"2027-01-27T07:00:00Z",targetLineUserIds:[]}}),
   syncOwnerReminderTarget:async()=>{ownerWrites++},
   sendTextReply:async(_t,s)=>{reply=s}
 }));
 assert.equal(r.route,"assistant_reminder_status");assert.equal(ownerWrites,0);assert.match(reply,/行前通知狀態/);
});
test("owner resolution failure keeps successful roster reply and does not claim inclusion",async()=>{
 let reply="";
 const r=await routeEvent(event(),deps({
  addMentionedRosterMembers:async()=>({changed:true,addedCount:1,seatedCount:1,afterCar:car}),
  syncRosterReminderTargets:async()=>({enabled:true,captured:true,totalCount:1}),
  syncOwnerReminderTarget:async()=>{throw Error("simulated unavailable")},
  sendTextReply:async(_t,s)=>{reply=s}
 }));
 assert.equal(r.route,"assistant_roster_added");assert.doesNotMatch(reply,/主揪已列入提醒名單/);
});
