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
