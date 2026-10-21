"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createHandler}=require("../../api/personal-calendar-change-notify");
function response(){return {statusCode:200,setHeader(){},end(v){this.body=JSON.parse(v)}};}
function setup(overrides={}){
 let claimed=false,notifies=0,reads=0;
 const car={ownerId:"p1",gameDate:"2027-10-04",gameTime:"11:00"};
 const audit={actionType:"car_edit",source:"editcar",actorId:"p1",actorProfileId:"p1",before:{gameTime:"10:00"},after:{gameTime:"11:00"},createdAt:new Date().toISOString()};
 const db={collection(name){
  reads++;
  if(name==="players")return {doc:()=>({get:async()=>({exists:true,data:()=>({lineUserId:"U1"})})})};
  assert.equal(name,"cars");
  return {doc:()=>({
   get:async()=>({exists:true,data:()=>overrides.car||car}),
   collection(sub){
    if(sub==="auditLogs")return {doc:()=>({get:async()=>({exists:true,data:()=>overrides.audit||audit})})};
    assert.equal(sub,"calendarNotificationClaims");
    return {doc:()=>({})};
   }
  })};
 },async runTransaction(callback){
  return callback({get:async()=>({exists:claimed}),create:()=>{claimed=true}});
 }};
 const handler=createHandler({db,readCookie:()=>"",verifySession:()=>overrides.session||({valid:true,data:{profileId:"p1",lineUserId:"U1"}}),notify:async()=>{notifies++;return {changed:true,sent:1}}});
 async function call(body={carId:"carA",auditId:"auditA"},origin="https://jly-host-system-eeso.vercel.app"){
  const res=response();await handler({method:"POST",headers:{origin},body},res);return res;
 }
 return {call,notifies:()=>notifies,reads:()=>reads};
}
test("rejects untrusted origin before reading Firestore",async()=>{
 const s=setup();const r=await s.call(undefined,"https://evil.example");
 assert.equal(r.statusCode,403);assert.equal(s.reads(),0);
});
test("rejects unauthenticated request",async()=>{
 const s=setup({session:{valid:false}});const r=await s.call();
 assert.equal(r.statusCode,401);assert.equal(s.reads(),0);
});
test("only one push attempt for a persisted authorized audit",async()=>{
 const s=setup();const first=await s.call(),second=await s.call();
 assert.equal(first.statusCode,200);assert.equal(first.body.sent,1);
 assert.equal(second.body.reason,"already_processed");assert.equal(s.notifies(),1);
});
test("rejects unrelated editor even if the audit names them",async()=>{
 const s=setup({car:{ownerId:"someone-else",gameTime:"11:00"}});const r=await s.call();
 assert.equal(r.statusCode,403);assert.equal(s.notifies(),0);
});
test("rejects superseded schedule and does not notify",async()=>{
 const s=setup({car:{ownerId:"p1",gameTime:"12:00"}});const r=await s.call();
 assert.equal(r.statusCode,409);assert.equal(s.notifies(),0);
});
test("rejects stale audit",async()=>{
 const s=setup({audit:{actionType:"car_edit",source:"editcar",actorId:"p1",before:{gameTime:"10:00"},after:{gameTime:"11:00"},createdAt:"2020-01-01T00:00:00Z"}});
 const r=await s.call();assert.equal(r.statusCode,409);assert.equal(s.notifies(),0);
});
