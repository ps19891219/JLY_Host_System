"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const bridge=require("../../js/studio/script-work-bridge");
test("existing Work id is reused as script identity when scriptId is absent",()=>{
 const row=bridge.fromWork({id:"work-1",name:"孤注",roles:[{id:"gm",name:"GM",eligiblePersonIds:["p1"]}]});
 assert.equal(row.scriptId,"work-1");assert.equal(row.workId,"work-1");assert.deepEqual(row.roles[0].eligiblePersonIds,["p1"]);
});
test("studio metadata update preserves existing role qualification by default",()=>{
 const next=bridge.mergeScriptIntoWork({id:"w1",name:"舊名",roles:[{id:"gm",name:"GM",eligiblePersonIds:["a","b"]}]},{scriptId:"w1",name:"新名",coverUrl:"cover.jpg",playerCount:6});
 assert.equal(next.name,"新名");assert.equal(next.coverUrl,"cover.jpg");assert.equal(next.playerCount,6);assert.deepEqual(next.roles[0].eligiblePersonIds,["a","b"]);
});
test("public projection excludes performer qualification",()=>{
 const row=bridge.toPublicScript({id:"w1",name:"劇本",roles:[{id:"gm",eligiblePersonIds:["secret-person"]}]});
 assert.equal(row.scriptId,"w1");assert.equal("roles" in row,false);assert.equal(JSON.stringify(row).includes("secret-person"),false);
});
