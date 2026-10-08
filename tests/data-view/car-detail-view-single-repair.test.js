"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../../js/modules/car/detail/car-detail-view-single-repair.js"),"utf8");
const browser = {document:null};
vm.runInNewContext(source, {window:browser, URLSearchParams, globalThis:browser});
const {repairSingleCarView,sameCarSnapshot} = browser.JLYCarDetailViewSingleRepair;
const carId="mRNxEFlvWEDg59GIXFVn";
const core={id:carId,ownerId:"host-one",scriptName:"知因",gameDate:"2027-01-28",gameTime:"09:00",updatedAt:"2026-10-08T00:00:00.000Z",players:[]};
function fixture(view){
  const calls=[];let stored=view;
  const db={collection(name){
    calls.push(["collection",name]);
    if(!["cars","carDetailViews"].includes(name))throw Error("unexpected collection");
    return {doc(id){
      calls.push(["doc",id]);assert.equal(id,carId);
      return {async get(){
        calls.push(["get",name]);
        if(name==="cars")return {exists:true,id,data:()=>({...core})};
        return {exists:Boolean(stored),data:()=>stored};
      }};
    }};
  }};
  return {db,calls,getView:()=>stored,write:next=>{stored=next}};
}
function runtime(f){
  return async()=>({carDetail:{writeFromCar:async car=>f.write({
    car:{...car},ownerId:car.ownerId,sourceUpdatedAt:car.updatedAt
  })}});
}
test("only the known car is read, missing view is repaired and verified",async()=>{
  const f=fixture(null);
  const r=await repairSingleCarView(carId,{db:f.db,canEditCar:c=>c.ownerId==="host-one",ensureRuntime:runtime(f)});
  assert.equal(r.status,"repaired");
  assert.equal(f.getView().car.gameDate,"2027-01-28");
  assert.deepEqual(f.calls.filter(x=>x[0]==="collection").map(x=>x[1]),["cars","carDetailViews"]);
  assert.equal(f.calls.filter(x=>x[0]==="get"&&x[1]==="cars").length,1);
  assert.equal(f.calls.filter(x=>x[0]==="get"&&x[1]==="carDetailViews").length,2);
});
test("an up-to-date view is never rewritten",async()=>{
  const f=fixture({car:{...core},ownerId:core.ownerId,sourceUpdatedAt:core.updatedAt});
  const r=await repairSingleCarView(carId,{db:f.db,canEditCar:()=>true,ensureRuntime:async()=>{throw Error("should not rebuild")}});
  assert.equal(r.status,"current");
});
test("stale game date and time are repaired",async()=>{
  const f=fixture({car:{...core,gameDate:"2026-01-28",gameTime:"10:00"},ownerId:core.ownerId,sourceUpdatedAt:"old"});
  const r=await repairSingleCarView(carId,{db:f.db,canEditCar:()=>true,ensureRuntime:runtime(f)});
  assert.equal(r.status,"repaired");
  assert.equal(f.getView().car.gameDate,"2027-01-28");
  assert.equal(f.getView().car.gameTime,"09:00");
});
test("non-owner cannot read or write any prepared view",async()=>{
  const f=fixture(null);
  await assert.rejects(repairSingleCarView(carId,{db:f.db,canEditCar:()=>false,ensureRuntime:runtime(f)}),/owner_required/);
  assert.deepEqual(f.calls.filter(x=>x[0]==="collection").map(x=>x[1]),["cars"]);
});
test("invalid car ID never causes a Firestore request",async()=>{
  await assert.rejects(repairSingleCarView("../other",{db:{collection(){throw Error("unwanted read")}}}),/car_id_invalid/);
});
test("builder write error leaves existing data untouched",async()=>{
  const f=fixture(null);
  await assert.rejects(repairSingleCarView(carId,{db:f.db,canEditCar:()=>true,ensureRuntime:async()=>({carDetail:{writeFromCar:async()=>{throw Error("permission-denied")}}})}),/permission-denied/);
  assert.equal(f.getView(),null);
});
test("incomplete or mismatching prepared view is not counted as current",()=>{
  assert.equal(sameCarSnapshot(null,core),false);
  assert.equal(sameCarSnapshot({car:{...core,gameTime:"18:00"},ownerId:core.ownerId,sourceUpdatedAt:core.updatedAt},core),false);
});
test("normal page never displays or executes maintenance UI",()=>{
  let reads=0;const children=[];
  const element=tag=>({tag,children:[],attrs:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,cb){this.click=cb},append(...els){this.children.push(...els)}});
  const container={prepend(child){children.push(child)}};
  browser.db={collection(){reads++;throw Error("unexpected read")}};
  browser.document={getElementById:()=>null,querySelector:sel=>sel===".container"?container:null,createElement:element};
  browser.location={search:"?id="+carId};
  browser.JLYCarDetailViewSingleRepair.mountMaintenanceAction();
  assert.equal(children.length,0);
  browser.location={search:"?id="+carId+"&viewRepair=1"};
  browser.JLYCarDetailViewSingleRepair.mountMaintenanceAction();
  assert.equal(children.length,1);assert.equal(reads,0);
  assert.equal(typeof children[0].children[1].click,"function");
  browser.document=null;
});
test("car-detail entry wires existing permission module before the repair action",()=>{
  const page=fs.readFileSync(path.join(__dirname,"../../pages/car-detail.html"),"utf8");
  const perm=page.indexOf('src="/js/modules/car/detail/core/permissions.js');
  const action=page.indexOf('src="/js/modules/car/detail/car-detail-view-single-repair.js');
  assert.ok(perm>=0&&action>perm);
});
test("createcar checks both MyCar and Car Detail View result",()=>{
  const source=fs.readFileSync(path.join(__dirname,"../../js/createcar.js"),"utf8");
  assert.match(source,/myCarViewSync\.ok !== true/);
  assert.match(source,/detailViewSync\.ok !== true/);
  assert.match(source,/請勿重新建立車團/);
});
