"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {scheduleChanged,notifySubscribedCarTimeChange}=require("../../services/calendar/car-change-line-notifier");
test("unchanged schedule never reads Firestore or sends LINE",async()=>{
 let reads=0;
 const result=await notifySubscribedCarTimeChange("carA",{gameDate:"2027-10-04",gameTime:"10:00"},{gameDate:"2027-10-04",gameTime:"10:00"},{db:{collection(){reads++;throw Error("unexpected")}}});
 assert.equal(result.changed,false);assert.equal(reads,0);
});
test("notifies only active subscribed and currently joined LINE players",async()=>{
 const messages=[];
 const records=[{data:()=>({status:"active",playerId:"p1",carIds:["carA"]})},{data:()=>({status:"revoked",playerId:"p2",carIds:["carA"]})}];
 const db={collection(name){
  if(name==="calendarSubscriptions")return {where(field,op,id){assert.deepEqual([field,op,id],["carIds","array-contains","carA"]);return{get:async()=>({docs:records})}}};
  assert.equal(name,"players");return{doc(id){assert.equal(id,"p1");return{get:async()=>({exists:true,data:()=>({lineUserId:"U1",identityId:"p1"})})}}};
 }};
 const result=await notifySubscribedCarTimeChange("carA",{gameDate:"2027-10-04",gameTime:"10:00"},{gameDate:"2027-10-04",gameTime:"11:00"},{
 db,getCarDetailViewById:async()=>({gameDate:"2027-10-04",gameTime:"11:00",scriptName:"測試",players:[{playerId:"p1",status:"approved"}]}),
 sendPushMessage:async(to,msg)=>messages.push({to,msg})
 });
 assert.equal(result.sent,1);assert.equal(messages[0].to,"U1");
 assert.equal(messages[0].msg[0].template.actions[0].label,"更新行事曆");
 assert.ok(!JSON.stringify(messages).includes("token="));
});
test("missing membership suppresses notification",async()=>{
 let pushes=0;
 const db={collection(name){if(name==="calendarSubscriptions")return{where(){return{get:async()=>({docs:[{data:()=>({status:"active",playerId:"p1"})}]})}}};return{doc(){return{get:async()=>({exists:true,data:()=>({lineUserId:"U1"})})}}}}}};
 const result=await notifySubscribedCarTimeChange("carA",{gameTime:"10:00"},{gameTime:"11:00"},{db,getCarDetailViewById:async()=>({players:[]}),sendPushMessage:async()=>pushes++});
 assert.equal(result.sent,0);assert.equal(pushes,0);
});
