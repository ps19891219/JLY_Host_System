"use strict";
const test=require("node:test");const assert=require("node:assert/strict");
const V=require("../services/firebase/person-directory-view-repository.js");
test("multiple claimed legacy identities collapse to one canonical Person row",()=>{
 let view={people:[
  {id:"rn",displayName:"RN"},
  {id:"east",displayName:"東"},
  {id:"other",displayName:"另一人"}
 ]};
 view=V.applyPersonMutation(view,{id:"person1",displayName:"RN",aliases:["RN","東"],linkedPlayerIds:["rn","east"],lineUserId:"U1",status:"active"},"person1");
 assert.equal(view.count,2);
 assert.equal(view.people.filter(x=>x.id==="person1").length,1);
 assert.deepEqual(view.people.find(x=>x.id==="person1").aliases,["RN","東"]);
 assert.ok(view.people.some(x=>x.id==="other"));
});
test("same display name alone never merges different People",()=>{
 let view={people:[{id:"p1",displayName:"小白"}]};
 view=V.applyPersonMutation(view,{id:"p2",displayName:"小白",status:"active"},"p2");
 assert.equal(view.count,2);
});
test("merged legacy row is removed instead of becoming a second visible Person",()=>{
 let view={people:[{id:"canonical",displayName:"RN"},{id:"legacy",displayName:"東"}]};
 view=V.applyPersonMutation(view,{id:"legacy",displayName:"東",canonicalPersonId:"canonical",mergedIntoPersonId:"canonical",status:"merged"},"legacy");
 assert.equal(view.people.some(x=>x.id==="legacy"),false);
 assert.equal(view.people.some(x=>x.id==="canonical"),true);
});

test("LINE rename preserves the previous LINE display name as searchable alias",()=>{
 let view={people:[{id:"p1",displayName:"RN",lineDisplayName:"東",aliases:["RN","東"],lineUserId:"U1"}]};
 view=V.applyPersonMutation(view,{id:"p1",displayName:"RN",lineDisplayName:"阿東",aliases:["RN"],lineUserId:"U1",status:"active"},"p1");
 const row=view.people.find(x=>x.id==="p1");
 assert.equal(row.lineDisplayName,"阿東");
 assert.ok(row.aliases.includes("東"));
 assert.ok(row.aliases.includes("阿東"));
 assert.ok(row.aliases.includes("RN"));
});

test("merged legacy processed after canonical must not delete the canonical Person",()=>{
 let view={people:[]};
 view=V.applyPersonMutation(view,{id:"canonical",displayName:"RN",linkedPlayerIds:["legacy"],status:"active"},"canonical");
 view=V.applyPersonMutation(view,{id:"legacy",displayName:"東",canonicalPersonId:"canonical",mergedIntoPersonId:"canonical",status:"merged"},"legacy");
 assert.equal(view.people.length,1);
 assert.equal(view.people[0].id,"canonical");
});
