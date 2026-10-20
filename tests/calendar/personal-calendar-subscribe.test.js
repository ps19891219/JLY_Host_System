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
