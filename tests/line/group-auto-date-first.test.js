"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "./group-membership-client") return {getGroupSummary: async () => {throw Error("unexpected network summary")}};
  if (request === "../firebase/line-auto-binding-repository") return {
    findCarDetailViewsByScriptName: async () => {throw Error("unexpected repository")},
    findCarDetailViewsByDate: async () => {throw Error("unexpected repository")}
  };
  if (request === "./admin") return {getFirestore: () => {throw Error("unexpected Firestore init")}};
  return originalLoad(request, parent, isMain);
};
const service = require("../../services/line/group-auto-binding-service");
const repo = require("../../services/firebase/line-auto-binding-repository");
Module._load = originalLoad;
const now = new Date("2026-10-08T00:00:00Z");
const summary = groupName => async () => ({groupId: "test-group", groupName});
const car = (id, date, time, scriptName, status = "招募中") => ({id,gameDate:date,gameTime:time,scriptName,status});

test("parse date/time with decorated group titles",()=>{
  assert.deepEqual(service.extractDateHint("10/30 19:00暗喰@星球旗艦"),{year:"",month:"10",day:"30"});
  assert.deepEqual(service.extractDateHint("2026/10/30 1900 測試車車"),{year:"2026",month:"10",day:"30"});
  assert.deepEqual(service.extractDateHint("１０月３０日　１９：００"),{year:"",month:"10",day:"30"});
  assert.equal(service.extractTimeHint("10/30 19:00暗喰@星球旗艦"),"19:00");
  assert.equal(service.extractTimeHint("2026/10/30 1900 測試車車"),"19:00");
  assert.equal(service.extractTimeHint("10/30 1900暗喰@星球旗艦"),"19:00");
  assert.equal(service.extractScriptHint("10/30 1900暗喰@星球旗艦"),"暗喰@星球旗艦");
});

test("infer only one Taiwan date and reject invalid/leap cases",()=>{
  assert.equal(service.dateForLookup({year:"",month:"10",day:"30"},now),"2026-10-30");
  assert.equal(service.dateForLookup({year:"",month:"01",day:"20"},now),"2027-01-20");
  assert.equal(service.dateForLookup({year:"2027",month:"10",day:"30"},now),"2027-10-30");
  assert.equal(service.dateForLookup({year:"",month:"02",day:"29"},now),"");
  assert.equal(service.dateForLookup({year:"",month:"01",day:"01"},new Date("2026-12-31T16:10:00Z")),"2027-01-01");
  assert.equal(service.extractDateHint("2027/02/29 19:00"),null);
});

test("real-world decorated title queries only by date and strictly by time",async()=>{
  let calls=[];
  const found=await service.detectGroupCar("group",{
    now,getGroupSummary:summary("10/30 19:00暗喰@星球旗艦"),
    findCarDetailViewsByDate:async(date,opts)=>{
      calls.push(["date",date,opts.limit]);
      return [car("wrong-time",date,"20:00","暗喰"),car("other",date,"19:00","其他本"),car("right",date,"19:00","暗喰")];
    },
    findCarDetailViewsByScriptName:async()=>{throw Error("unexpected script read")}
  });
  assert.deepEqual(calls,[["date","2026-10-30",12]]);
  assert.deepEqual(found.candidates.map(x=>x.carId),["right","other"]);
  assert.equal(found.reason,"multiple_candidates");
});

test("date/time without script shows matching candidates",async()=>{
  const found=await service.detectGroupCar("group",{
    now,getGroupSummary:summary("10/30 19:00"),
    findCarDetailViewsByDate:async()=>[car("a","2026-10-30","19:00","本甲"),car("b","2026-10-30","19:00","本乙")],
    findCarDetailViewsByScriptName:async()=>{throw Error("unexpected")}
  });
  assert.equal(found.candidates.length,2);
  assert.equal(found.reason,"multiple_candidates");
});

test("strictly reject wrong hour/year and closed cars",async()=>{
  const found=await service.detectGroupCar("group",{
    now,getGroupSummary:summary("10/30 19:00 旗艦"),
    findCarDetailViewsByDate:async()=>[
      car("wrong-hour","2026-10-30","19:30","旗艦"),
      car("wrong-year","2027-10-30","19:00","旗艦"),
      car("cancel","2026-10-30","19:00","旗艦","已取消")
    ]
  });
  assert.equal(found.detected,false);
  assert.equal(found.candidates.length,0);
});

test("no date retains bounded exact script fallback",async()=>{
  let requested="";
  const found=await service.detectGroupCar("group",{
    now,getGroupSummary:summary("《新月舊事》19:00"),
    findCarDetailViewsByScriptName:async(name,opts)=>{
      requested=name; assert.equal(opts.limit,12);
      return [car("a","2026-10-30","18:00",name),car("b","2026-10-30","19:00",name)];
    },
    findCarDetailViewsByDate:async()=>{throw Error("unexpected date")}
  });
  assert.equal(requested,"新月舊事");
  assert.deepEqual(found.candidates.map(x=>x.carId),["b"]);
});

test("invalid dates and clock time fail closed without reads",async()=>{
  for(const [title,expected] of [
    ["2027/02/29 19:00 暗喰","invalid_date_hint"],
    ["2/29 19:00 暗喰","invalid_inferred_date"],
    ["10/30 19:90 暗喰","invalid_time_hint"]
  ]){
    let count=0;
    const found=await service.detectGroupCar("group",{
      now,getGroupSummary:summary(title),
      findCarDetailViewsByDate:async()=>{count++;return[]},
      findCarDetailViewsByScriptName:async()=>{count++;return[]}
    });
    assert.equal(found.reason,expected);
    assert.equal(count,0);
  }
});

test("Prepared View date lookup is bounded and requires standard key",async()=>{
  let calls=[];
  const db={collection(name){calls.push(["collection",name]);return{
    where(field,op,value){calls.push(["where",field,op,value]);return{
      limit(n){calls.push(["limit",n]);return{async get(){calls.push(["get"]);return{
        docs:[{id:"car1",data:()=>({carId:"car1",car:{gameDate:"2026-10-30",scriptName:"暗喰"}})}]
      }}}}
    }}
  }}};
  const rows=await repo.findCarDetailViewsByDate("2026-10-30",{db,limit:999});
  assert.equal(rows.length,1);
  assert.deepEqual(calls,[["collection","carDetailViews"],["where","car.gameDate","==","2026-10-30"],["limit",12],["get"]]);
  assert.deepEqual(await repo.findCarDetailViewsByDate("10/30",{db}),[]);
  assert.equal(calls.length,4);
});