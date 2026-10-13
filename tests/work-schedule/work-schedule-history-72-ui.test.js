"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const code=fs.readFileSync("js/modules/work-schedule/work-schedule-date-search.js","utf8");
const workHub=fs.readFileSync("js/modules/work-schedule/work-schedule-work-hub.js","utf8");
const view=fs.readFileSync("js/modules/work-schedule/work-schedule-read-view.js","utf8");
const workId="HMlsoMDqVdxUMEH8apSr";
function mount(){
 const nodes=new Map(),events=[],requests=[];
 for(const id of ["scheduleDateSearch","scheduleDateQuery","scheduleDateClear","scheduleDashboard","scheduleResultsTitle"]){nodes.set(id,{innerHTML:"",value:"",hidden:false,textContent:"",addEventListener(){},setAttribute(){}})}
 const rows=Array.from({length:72},(_,i)=>["DM","NPC"].map(role=>({id:"row-"+i+"-"+role,workId,workName:"孤注",date:"2027-09-"+String(1+i%28).padStart(2,"0"),startTime:String(10+Math.floor(i/28)).padStart(2,"0")+":00",endTime:"18:00",roleName:role,status:"scheduled",staffSlots:[],people:[]}))).flat();
 const w={JLYWorkScheduleReadView:{loadWorkRows:async id=>{requests.push(id);return rows}},dispatchEvent:e=>events.push(e),JLYWorkScheduleStaffSlots:{setRows(){}}};
 const document={getElementById:id=>nodes.get(id),querySelectorAll:()=>[],createElement:()=>({src:""}),body:{appendChild(){}}};
 vm.runInNewContext(code,{window:w,document,location:{href:"https://example.com/pages/work-schedule.html?workId="+workId},URL,CustomEvent:class{constructor(type,arg){this.type=type;this.detail=arg&&arg.detail;}},console});
 return {nodes,events,requests,w};
}
test("72 unique scheduled groups produce 72 visible cards with scoped data-work-id",async()=>{
 const x=mount();await x.w.JLYWorkScheduleDateSearch.ensureWorkVisible(workId);
 const html=x.nodes.get("scheduleDashboard").innerHTML;
 assert.equal((html.match(/class="work-day-card date-search-result"/g)||[]).length,72);
 assert.equal((html.match(/data-work-id="HMlsoMDqVdxUMEH8apSr"/g)||[]).length,72);
 assert.equal(x.requests.length,1);assert.equal(x.events.at(-1).detail.rows.length,144);
});
test("monthly dashboard repaint restores complete work without another view read",async()=>{
 const x=mount();await x.w.JLYWorkScheduleDateSearch.ensureWorkVisible(workId);
 x.nodes.get("scheduleDashboard").innerHTML="月份看板已覆寫";
 await x.w.JLYWorkScheduleDateSearch.ensureWorkVisible(workId);
 assert.equal((x.nodes.get("scheduleDashboard").innerHTML.match(/class="work-day-card date-search-result"/g)||[]).length,72);
 assert.equal(x.requests.length,1);
 assert.match(workHub,/ensureWorkVisible/);
});
test("single-work Prepared View fetch is cancellable and does not scan Core",()=>{
 assert.match(view,/new AbortController\(\)/);
 assert.match(view,/controller.abort\(\),20000/);
 assert.match(view,/finally\{clearTimeout\(timer\)\}/);
 assert.match(view,/fetch\(.+cache:\x27no-store\x27,signal:controller.signal/);
});

test("selected-work monthly dashboard cannot erase the 72-event full history",async()=>{
 const x=mount();
 await x.w.JLYWorkScheduleDateSearch.ensureWorkVisible(workId);
 const host=x.nodes.get("scheduleDashboard");
 const before=host.innerHTML;
 const dashboard=fs.readFileSync("js/modules/work-schedule/work-schedule-dashboard.js","utf8");
 const start=dashboard.indexOf("function render(){");
 const end=dashboard.indexOf("function updateBatchBar(){",start);
 assert.ok(start>=0&&end>start);
 const renderFunction=dashboard.slice(start,end);
 const nodes={scheduleDashboard:host,dashboardMonthLabel:{textContent:""},batchBar:{hidden:false},batchCount:{textContent:""}};
 const signals=[];
 const w={JLYWorkScheduleDateSearch:x.w.JLYWorkScheduleDateSearch,dispatchEvent:e=>signals.push(e)};
 const environment={
   window:w,console,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},
   $:id=>nodes[id],groups:()=>[],month:new Date("2026-10-13T00:00:00Z"),
   rows:[],allRows:[],view:"all",selected:new Set(),monthKey:()=>"2026-10",
   updateBatchBar(){},esc:String
 };
 vm.runInNewContext(renderFunction+"\nrender();",environment);
 assert.equal(host.innerHTML,before,"monthly empty response must not replace the full-year cards");
 assert.equal(signals.filter(e=>e.type==="jly:work-schedule:rows").length,1);
 assert.equal(w.JLYWorkScheduleDateSearch.ownsDisplay(),true);
});

test("a direct work link shows schedule even when work index fails",async()=>{
 const hub=fs.readFileSync("js/modules/work-schedule/work-schedule-work-hub.js","utf8");
 const start=hub.indexOf("async function load(){");
 const end=hub.indexOf("function start(){",start);
 assert.ok(start>=0&&end>start);
 const calls=[],nodes=new Map();
 for(const id of ["workHub","workWorkspace","scheduleDashboard"])nodes.set(id,{hidden:false});
 const w={JLYWorkScheduleDateSearch:{async ensureWorkVisible(id){calls.push("visible:"+id);}}};
 const V={async loadWorkIndex(){calls.push("index");throw Error("index unavailable")}};
 const e={$:id=>nodes.get(id),window:w,V,
  ensureShell(){calls.push("shell");},
  dashboardNodes:()=>[nodes.get("scheduleDashboard")],
  URL,location:{href:"https://example.com/pages/work-schedule.html?workId="+workId},
  console:{warn(){}}
 };
 await vm.runInNewContext(hub.slice(start,end)+"\nload()",e);
 assert.deepEqual(calls,["shell","visible:"+workId,"index"]);
 assert.equal(nodes.get("scheduleDashboard").hidden,false);
 assert.equal(nodes.get("workHub").hidden,true);
 assert.equal(nodes.get("workWorkspace").hidden,true);
});

test("scoped scripts are cache-busted together",()=>{
 const page=fs.readFileSync("pages/work-schedule.html","utf8");
 for(const path of ["work-schedule-dashboard.js?v=12","work-schedule-date-search.js?v=15","work-schedule-work-hub.js?v=11"])assert.ok(page.includes(path),path);
});
