"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),Module=require("node:module");
const old=Module._load;
Module._load=function(req,p,m){
  if(req==="../firebase/line-accounting-authorization-repository") return {findPlayerByLineUserId:async()=>{throw Error("unexpected real lookup")}};
  if(req==="../firebase/admin") return {getFirestore:()=>{throw Error("unexpected Firestore")}};
  if(req==="./group-car-binding-service") return {isCarOwner(profile,car){
    const ids=[profile.id,profile.identityId,...(profile.linkedPlayerIds||[])];
    return Boolean((car.ownerId&&ids.includes(car.ownerId))||(car.ownerPersonId&&ids.includes(car.ownerPersonId)));
  }};
  if(req==="../firebase/reminder-owner-target-repository") return {addPreTripReminderOwnerTarget:async()=>{throw Error("unexpected real write")}};
  return old(req,p,m);
};
const service=require("../../services/line/owner-reminder-target-service");
Module._load=old;
const car={id:"car-1",ownerId:"owner-profile"};
const actor=userId=>({source:{userId}});
test("verified owner sender auto-enrolled from formal LINE identity",async()=>{
  let count=0;
  const r=await service.syncOwnerReminderTarget("car-1",car,actor("Uhost"),{
    findPlayerByLineUserId:async()=>({id:"owner-profile",lineUserId:"Uhost"}),
    readPlayerByExactId:async()=>{throw Error("should not read fallback")},
    addPreTripReminderOwnerTarget:async(id,uid)=>{count++;assert.equal(id,"car-1");assert.equal(uid,"Uhost");return {included:true,totalCount:2}}
  });
  assert.equal(count,1);assert.equal(r.included,true);assert.equal(r.identitySource,"verified_sender");
});
test("manager command includes linked owner using one known owner ID",async()=>{
  let ids=[];
  const r=await service.syncOwnerReminderTarget("car-1",car,actor("Umanager"),{
    findPlayerByLineUserId:async()=>({id:"manager",lineUserId:"Umanager"}),
    readPlayerByExactId:async id=>{ids.push(id);return {id,lineUserId:"Uowner"}},
    addPreTripReminderOwnerTarget:async(_id,uid)=>{assert.equal(uid,"Uowner");return {included:true,totalCount:2}}
  });
  assert.deepEqual(ids,["owner-profile"]);assert.equal(r.included,true);
});
test("unlinked owner cannot be inserted",async()=>{
  let writes=0;
  const r=await service.syncOwnerReminderTarget("car-1",car,actor("Uother"),{
    findPlayerByLineUserId:async()=>null,
    readPlayerByExactId:async()=>({id:"owner-profile",lineUserId:""}),
    addPreTripReminderOwnerTarget:async()=>{writes++}
  });
  assert.equal(r.included,false);assert.equal(writes,0);
});
test("conflicting owner reference LINE identities fail closed",async()=>{
  const mixed={...car,ownerPersonId:"person-2"};let writes=0;
  const r=await service.syncOwnerReminderTarget("car-1",mixed,actor("Umanager"),{
    findPlayerByLineUserId:async()=>null,
    readPlayerByExactId:async id=>({id,lineUserId:id==="owner-profile"?"Uone":"Utwo"}),
    addPreTripReminderOwnerTarget:async()=>{writes++}
  });
  assert.equal(r.reason,"owner_identity_conflict");assert.equal(writes,0);
});
test("mismatched known car id causes zero identity lookups",async()=>{
  let reads=0;
  const r=await service.syncOwnerReminderTarget("other-car",car,actor("Uhost"),{findPlayerByLineUserId:async()=>{reads++}});
  assert.equal(r.reason,"car_mismatch");assert.equal(reads,0);
});
