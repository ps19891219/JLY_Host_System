"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function(req,parent,main) {
  if (req === "../firebase/admin") return {getFirestore(){throw Error("inject_db_required")}};
  if (req === "../firebase/car-prepared-view-write-through") {
    return {buildCarDetailView(car){return {carId:car.id,ownerId:car.ownerId,
      sourceUpdatedAt:car.updatedAt,car:{...car}}}};
  }
  if (req === "./group-car-binding-service") {
    return {getIdentityIds(row){return new Set(
      [row.id,row.identityId,...(row.linkedPlayerIds||[])].filter(Boolean))}};
  }
  return originalLoad(req,parent,main);
};
const service = require("../../services/line/known-three-car-view-repair-service");
Module._load = originalLoad;
const ids=service.KNOWN_CAR_IDS;
const admin="f89pkJbkmFLu4ZOw2fXh";
function dbFor(playerData,cars,initialViews={}) {
  const views={...initialViews},history=[];
  function read(name,id){
    const value=name==="players"?playerData:name==="cars"?cars:views;
    return {id,exists:Object.hasOwn(value,id),data:()=>({...value[id]})};
  }
  const db={
    collection(name){
      if(!["players","cars","carDetailViews"].includes(name))throw Error("unbounded_collection");
      return {doc(id){
        history.push("ref:"+name+"/"+id);
        if(name!=="players"&&!ids.includes(id))throw Error("unbounded_car");
        return {name,id,async get(){return read(name,id)}};
      }};
    },
    async runTransaction(fn){
      return fn({
        get:async ref=>read(ref.name,ref.id),
        set(ref,data){history.push("write:"+ref.name+"/"+ref.id);views[ref.id]=data;}
      });
    }
  };
  return {db,history,views};
}
const cars=Object.fromEntries(ids.map((id,i)=>[id,{
  id,ownerId:"another-host",scriptName:["極點","四季物語2","膽小鬼的殺人狂想"][i],
  gameDate:["2027-01-29","2027-02-01","2027-02-12"][i],
  gameTime:["09:00","11:00","19:00"][i],updatedAt:"date-v1"
}]));
test("verified existing system admin profile repairs only three exact docs",async()=>{
  const f=dbFor({[admin]:{lineUserId:"Uadmin",identityId:"old"}},cars);
  const r=await service.repairThreeKnownCarViews({profileId:admin,lineUserId:"Uadmin",identityId:"old"},{db:f.db});
  assert.equal(r.authorized,true);
  assert.deepEqual(r.results.map(v=>v.status),["repaired","repaired","repaired"]);
  assert.deepEqual(f.history.filter(x=>x.startsWith("write:")),ids.map(id=>"write:carDetailViews/"+id));
});
test("an already current Prepared View is not rewritten",async()=>{
  const row=cars[ids[0]];
  const f=dbFor({[admin]:{lineUserId:"Uadmin"}},cars,{
    [ids[0]]:{carId:row.id,ownerId:row.ownerId,sourceUpdatedAt:row.updatedAt,car:{...row}}
  });
  const r=await service.repairThreeKnownCarViews({profileId:admin,lineUserId:"Uadmin"},{db:f.db});
  assert.equal(r.results[0].status,"current");
  assert.equal(f.history.includes("write:carDetailViews/"+ids[0]),false);
});
test("unrelated formally linked user cannot alter any of the three cars",async()=>{
  const f=dbFor({other:{lineUserId:"Uother"}},cars);
  const r=await service.repairThreeKnownCarViews({profileId:"other",lineUserId:"Uother"},{db:f.db});
  assert.deepEqual(r.results.map(x=>x.reason),ids.map(()=>"creator_identity_mismatch"));
  assert.equal(f.history.some(x=>x.startsWith("write:")),false);
});
test("a real owner who chose role player retains permission",async()=>{
  const mine={...cars,[ids[0]]:{...cars[ids[0]],ownerId:"other",myRole:"player"}};
  const f=dbFor({other:{lineUserId:"Uother"}},mine);
  const r=await service.repairThreeKnownCarViews({profileId:"other",lineUserId:"Uother"},{db:f.db});
  assert.equal(r.results[0].status,"repaired");
  assert.equal(r.results[1].status,"failed");
});
test("invalid or provisional LINE account fails before any Core reads",async()=>{
  const f=dbFor({[admin]:{lineUserId:"Uadmin"}},cars);
  for(const session of [
    {profileId:admin,lineUserId:"Uwrong"},
    {profileId:"line:synthetic",lineUserId:"Utemp",provisional:true}
  ]) {
    const r=await service.repairThreeKnownCarViews(session,{db:f.db});
    assert.equal(r.authorized,false);
  }
  assert.equal(f.history.some(x=>x.startsWith("ref:cars/")),false);
});
test("incomplete Core data blocks only that car",async()=>{
  const wrong={...cars,[ids[1]]:{...cars[ids[1]],gameTime:""}};
  const f=dbFor({[admin]:{lineUserId:"Uadmin"}},wrong);
  const r=await service.repairThreeKnownCarViews({profileId:admin,lineUserId:"Uadmin"},{db:f.db});
  assert.equal(r.results[1].reason,"core_date_time_incomplete");
  assert.equal(r.results[0].status,"repaired");
});
test("batch page is explicitly server-authorized and uses no local direct write",()=>{
  const fs=require("node:fs"),path=require("node:path");
  const source=fs.readFileSync(path.join(__dirname,"../../js/modules/car/detail/car-detail-view-batch-repair.js"),"utf8");
  assert.match(source,/repair_three_known_car_views/);
  assert.match(source,/credentials: "same-origin"/);
  assert.match(source,/EXACT_REPAIR_IDS/);
});
test("existing LINE pairing path remains while new action uses origin and signed session",()=>{
  const fs=require("node:fs"),path=require("node:path");
  const source=fs.readFileSync(path.join(__dirname,"../../api/line-group-pairing-code.js"),"utf8");
  assert.match(source,/repair_three_known_car_views/);
  assert.match(source,/verifyMemberSession\(readCookie\(req\)\)/);
  assert.match(source,/const \[car, players\] = await Promise\.all/);
});
