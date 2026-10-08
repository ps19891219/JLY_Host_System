"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const src = fs.readFileSync(path.join(__dirname,"../../js/modules/car/detail/car-detail-view-single-repair.js"),"utf8");
const browser = {document:null};
vm.runInNewContext(src,{window:browser,globalThis:browser,URLSearchParams});
const check = browser.JLYCarDetailViewSingleRepair.assertCreatorCanRepair;
const car = {id:"test-car",ownerId:"legacy-owner",myRole:"player",isHost:false};
test("creator is authorized regardless of player role",async ()=>{
 const allowed=await check(car,{}, {canEditCar:c=>c.ownerId==="legacy-owner"});
 assert.equal(allowed.proof,"confirmed_creator_identity");
});
test("rehydrate only known profile then recheck creator alias",async ()=>{
 let ids=["new-id"],lookups=0;
 const identity={getCurrentPlayerProfileId:()=>"known-profile",
  syncFromPlayerProfile:async(db,id)=>{lookups++;assert.equal(id,"known-profile");ids.push("legacy-owner");}};
 const allowed=await check(car,{}, {identity,canEditCar:()=>ids.includes(car.ownerId)});
 assert.equal(allowed.proof,"confirmed_creator_alias");assert.equal(lookups,1);
});
test("unrelated player cannot repair car",async ()=>{
 const identity={getCurrentPlayerProfileId:()=>"",syncFromPlayerProfile:async()=>{throw Error("unexpected")}};
 await assert.rejects(check(car,{}, {identity,canEditCar:()=>false}),/creator_identity_mismatch/);
});
test("missing owner does not grant ownership to anyone",async ()=>{
 await assert.rejects(check({...car,ownerId:""},{},{canEditCar:()=>false}),/creator_record_missing/);
});
test("known system-admin override for missing owner preserved",async ()=>{
 const allowed=await check({...car,ownerId:""},{},{canOverride:()=>true,canEditCar:()=>true});
 assert.equal(allowed.proof,"system_admin");
});
