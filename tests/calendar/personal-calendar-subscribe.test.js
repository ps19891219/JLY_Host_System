"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createHandler}=require("../../api/personal-calendar-subscribe");
function res(){return{statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}}}
test("requires verified LINE session",async()=>{
 const response=res();
 await createHandler({verifySession:()=>({valid:false}),readCookie:()=>""})({method:"POST"},response);
 assert.equal(response.statusCode,401);
});
test("rejects provisional LINE identity",async()=>{
 const response=res();
 await createHandler({verifySession:()=>({valid:true,data:{profileId:"x",lineUserId:"U1",provisional:true}}),readCookie:()=>""})({method:"POST"},response);
 assert.equal(response.statusCode,401);
});
test("rejects mismatch between signed session and linked player",async()=>{
 let writes=0;
 const db={collection(name){assert.equal(name,"players");return{doc(id){assert.equal(id,"p1");return{get:async()=>({exists:true,data:()=>({lineUserId:"U-other"})})}}}}};
 const response=res();
 await createHandler({db,verifySession:()=>({valid:true,data:{profileId:"p1",lineUserId:"U1"}}),readCookie:()=>""})({method:"POST"},response);
 assert.equal(response.statusCode,403);
 assert.equal(writes,0);
});

test("per-car authorization reuses a token only for a verified joined player",async()=>{
 const {hashSubscriptionToken}=require("../../services/calendar/subscription-token");
 const token="a".repeat(43), digest=hashSubscriptionToken(token);
 const record={playerId:"p1",status:"active",carIds:["carA"]};
 const updated=[];
 const db={collection(name){return{doc(id){
  if(name==="players")return{get:async()=>({exists:true,data:()=>({lineUserId:"U1",identityId:"p1"})})};
  assert.equal(name,"calendarSubscriptions");assert.equal(id,digest);
  return{get:async()=>({exists:true,data:()=>record}),update:async value=>updated.push(value)};
 }}}};
 const handler=createHandler({db,readCookie:()=>"",verifySession:()=>({valid:true,data:{profileId:"p1",lineUserId:"U1"}}),getCarDetailViewById:async()=>({players:[{playerId:"p1",status:"approved"}]})});
 const response=res();
 await handler({method:"POST",body:{carId:"carB",token}},response);
 assert.equal(response.statusCode,200);
 assert.equal(updated.length,1);
 assert.match(response.body.url,/personal-calendar-feed/);
});
test("refuses to add another car when player is not on that roster",async()=>{
 const db={collection(){return {doc(){return {get:async()=>({exists:true,data:()=>({lineUserId:"U1",identityId:"p1"})})};}};}};
 const handler=createHandler({db,readCookie:()=>"",verifySession:()=>({valid:true,data:{profileId:"p1",lineUserId:"U1"}}),getCarDetailViewById:async()=>({players:[]})});
 const response=res();
 await handler({method:"POST",body:{carId:"carB"}},response);
 assert.equal(response.statusCode,403);
});

test("rejects cross-origin subscription requests before any database reads",async()=>{
 let reads=0;
 const handler=createHandler({db:{collection(){reads++;throw Error("unexpected read")}},readCookie:()=>"",verifySession:()=>({valid:true,data:{profileId:"p1",lineUserId:"U1"}})});
 const response=res();
 await handler({method:"POST",headers:{origin:"https://untrusted.example"},body:{carId:"carA"}},response);
 assert.equal(response.statusCode,403);
 assert.equal(reads,0);
});
