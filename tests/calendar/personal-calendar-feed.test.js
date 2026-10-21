"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createHandler}=require("../../api/personal-calendar-feed");
function response(){
 const headers={};
 return {statusCode:200,headers,body:"",setHeader(k,v){headers[k]=v},end(v=""){this.body=v;return this}};
}
test("rejects missing token without reading data",async()=>{
 let reads=0;
 const handler=createHandler({loadFeed:async()=>{reads++;return "private"}});
 const res=response();
 await handler({method:"GET",query:{}},res);
 assert.equal(res.statusCode,404);
 assert.equal(reads,0);
});
test("returns a calendar for a valid authorized token",async()=>{
 const handler=createHandler({loadFeed:async()=> "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"});
 const res=response();
 await handler({method:"GET",query:{token:"a".repeat(43)}},res);
 assert.equal(res.statusCode,200);
 assert.match(res.headers["Content-Type"],/text\/calendar/);
 assert.match(res.body,/BEGIN:VCALENDAR/);
});
test("revoked subscription is not exposed",async()=>{
 const handler=createHandler({loadFeed:async()=>null});
 const res=response();
 await handler({method:"GET",query:{token:"a".repeat(43)}},res);
 assert.equal(res.statusCode,404);
 assert.equal(res.body,"");
});
