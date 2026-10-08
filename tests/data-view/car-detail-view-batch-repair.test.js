"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "../../js/modules/car/detail/car-detail-view-batch-repair.js"), "utf8");
const browser = {document:null};
vm.runInNewContext(src, {window:browser, globalThis:browser, URLSearchParams});
const {parseKnownCarIds, runKnownCarRepairs, mount, MAX_CARS} = browser.JLYCarDetailViewBatchRepair;
const ids = ["vSfmdHC7okcHKiGyJAaM","h9xHEXaDs8jCXb6hl4Ih","O7dgQYnWux16tLtgH4iM"];
const url = "?id="+ids[0]+"&viewRepairBatch=1&ids="+ids.join(",");
test("only explicit three known Car IDs accepted", ()=>{
 assert.deepEqual(Array.from(parseKnownCarIds(url)),ids);
 assert.equal(parseKnownCarIds("?id="+ids[0]).length,0);
});
test("reject malformed, overflow or wrong current car", ()=>{
 assert.equal(parseKnownCarIds("?id=wrong&viewRepairBatch=1&ids="+ids.join(",")).length,0);
 assert.equal(parseKnownCarIds("?id="+ids[0]+"&viewRepairBatch=1&ids="+ids[0]+",../bad").length,0);
 const many = Array.from({length:MAX_CARS+1},(_,i)=>"car-id-"+i+"AA");
 assert.equal(parseKnownCarIds("?id="+many[0]+"&viewRepairBatch=1&ids="+many.join(",")).length,0);
});
test("deduplicate known IDs", ()=>{
 assert.deepEqual(Array.from(parseKnownCarIds("?id="+ids[0]+"&viewRepairBatch=1&ids="+ids[0]+","+ids[0])),[ids[0]]);
});
test("sequential repairs continue after individual failure", async ()=>{
 const called=[];
 const out = await runKnownCarRepairs(ids, async id=>{
  called.push(id);if(id===ids[1])throw Error("creator_identity_mismatch");
  return {status:"repaired",gameDate:"2027-02-01",gameTime:"11:00"};
 });
 assert.deepEqual(called,ids);
 assert.deepEqual(Array.from(out.map(x=>x.status)),["repaired","failed","repaired"]);
 assert.equal(out[1].reason,"creator_identity_mismatch");
});
test("invalid batch does zero work", async ()=>{
 let calls=0;
 await assert.rejects(runKnownCarRepairs([...ids,"../bad"], async ()=>{calls++}),/invalid_bounded_car_ids/);
 assert.equal(calls,0);
});
test("inert normal page has no Firestore reads", ()=>{
 let creates=0;
 browser.location={search:"?id="+ids[0]};
 browser.db={collection(){throw Error("unexpected Firestore read")}};
 browser.document={querySelector:()=>({prepend(){}}),getElementById:()=>null,createElement:()=>{creates++;}};
 mount();assert.equal(creates,0);
 browser.document=null;
});
test("explicit batch page mounts button without reads", ()=>{
 let added=0,listener=null,reads=0;
 const el=tag=>({tag,children:[],setAttribute(){},appendChild(child){this.children.push(child)},append(...xs){this.children.push(...xs)},addEventListener(name,cb){if(tag==="button")listener=cb}});
 browser.document={querySelector:()=>({prepend(){added++}}),getElementById:()=>null,createElement:el};
 browser.location={search:url};
 browser.db={collection(){reads++;throw Error("unexpected Firestore read")}};
 mount();assert.equal(added,1);assert.equal(reads,0);assert.equal(typeof listener,"function");
 browser.document=null;
});
test("Car Detail entry loads single repair before bounded batch module", ()=>{
 const page=fs.readFileSync(path.join(__dirname,"../../pages/car-detail.html"),"utf8");
 assert.ok(page.indexOf('src="/js/modules/car/detail/car-detail-view-batch-repair.js')>
   page.indexOf('src="/js/modules/car/detail/car-detail-view-single-repair.js'));
});
