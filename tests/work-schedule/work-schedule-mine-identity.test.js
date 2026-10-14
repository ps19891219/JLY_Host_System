"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs");
const {createHandler}=require("../../api/work-schedule-mine-identity");
const {createMemberSession}=require("../../services/line/member-session");
const {resolveCandidateIds}=require("../../services/work-schedule/staff-person-links");
const source=fs.readFileSync("js/modules/work-schedule/work-schedule-date-search.js","utf8");
function response(){return{statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.body=JSON.parse(s)}}}
async function call(handler,token,method="GET"){
 const res=response();
 await handler({method,headers:{cookie:token?"jly_member_session="+token:""}},res);
 return res;
}
test("identity endpoint requires verified LINE session and never returns public identities",async()=>{
 const old=process.env.LINE_CHANNEL_SECRET;process.env.LINE_CHANNEL_SECRET="unit-test-key";
 try{
  let reads=0;
  const handler=createHandler({getFirestore(){reads++;return {}},resolveCandidateIds:async()=>new Set(["person-id"])});
  const guest=await call(handler,"");
  assert.equal(guest.statusCode,401);assert.equal(guest.body.error,"line_login_required");
  const bad=await call(handler,"invalid.jwt");
  assert.equal(bad.statusCode,401);
  assert.equal(reads,0,"anonymous requests must not consume Firestore reads");
  const provisional=createMemberSession({lineUserId:"U-line",provisional:true},"unit-test-key");
  const needLink=await call(handler,provisional);
  assert.equal(needLink.statusCode,403);assert.equal(needLink.body.error,"person_link_required");
  assert.equal(reads,0);
  const signed=createMemberSession({lineUserId:"U-line",profileId:"profile-1"},"unit-test-key");
  const okay=await call(handler,signed);
  assert.equal(okay.statusCode,200);
  assert.deepEqual(okay.body.candidatePersonIds,["person-id"]);
  assert.equal(okay.headers["Cache-Control"],"private, no-store");
  assert.equal(reads,1);
 }finally{if(old===undefined)delete process.env.LINE_CHANNEL_SECRET;else process.env.LINE_CHANNEL_SECRET=old}
});
test("candidate Person aliases reuse formal Profile and precise LINE ID lookup",async()=>{
 const calls=[];
 const docs={
  "profile-1":{exists:true,id:"profile-1",data:()=>({personId:"formal-person",linkedPlayerIds:["previous-player"]})},
  "formal-person":{exists:false},"previous-player":{exists:false}
 };
 const db={collection(name){
  assert.equal(name,"players");
  return{doc(id){calls.push("doc:"+id);return{get:async()=>docs[id]||{exists:false}}},where(field,op,id){
   assert.equal(field,"lineUserId");assert.equal(op,"==");
   calls.push("where:"+id);
   return{limit(n){assert.equal(n,10);return{get:async()=>({docs:[]})}}};
  }};
 }};
 const ids=await resolveCandidateIds(db,{lineUserId:"U-test",profileId:"profile-1"});
 assert.ok(ids.has("formal-person"));assert.ok(ids.has("previous-player"));assert.ok(ids.has("profile-1"));
 assert.ok(calls.length<=12,"identity resolution must not scan a collection");
 assert.equal(calls.filter(x=>x.startsWith("where:")).length,1);
});
function mount(fetcher){
 const nodes=new Map(),tabs=[],requests=[];
 const ids=["scheduleDateSearch","scheduleDateQuery","scheduleDateClear","scheduleDashboard","scheduleResultsTitle"];
 for(const id of ids)nodes.set(id,{innerHTML:"",value:"",hidden:false,textContent:"",listeners:{},addEventListener(name,cb){this.listeners[name]=cb},setAttribute(){}});
 for(const view of ["all","mine"]){const t={dataset:{dashboardView:view},listeners:{},classList:{toggle(){}},addEventListener(type,cb){this.listeners[type]=cb}};tabs.push(t)}
 const rows=Array.from({length:72},(_,i)=>["DM","NPC"].map(role=>({
  workId:"work-72",workName:"孤注",date:"2027-09-"+String(1+i%28).padStart(2,"0"),
  startTime:String(10+Math.floor(i/28)).padStart(2,"0")+":00",endTime:"19:00",
  roleName:role,assignedPersonIds:role==="NPC"&&i<50?["formal-person"]:["some-other-person"],status:"scheduled",
  people:[],staffSlots:[]
 }))).flat();
 const w={JLYWorkScheduleReadView:{async loadWorkRows(id){requests.push(id);return rows}},dispatchEvent(){},JLYWorkScheduleStaffSlots:{setRows(){}},JLYLineLogin:{async start(){w.started=true}}};
 const doc={getElementById:id=>nodes.get(id),querySelectorAll:s=>s==="[data-dashboard-view]"?tabs:[],createElement:()=>({src:""}),body:{appendChild(){}}};
 const l={href:"https://example.com/pages/work-schedule.html?workId=work-72",pathname:"/pages/work-schedule.html",search:"?workId=work-72"};
 vm.runInNewContext(source,{window:w,document:doc,location:l,URL,CustomEvent:class{constructor(){}},console,fetch:fetcher});
 return{nodes,tabs,w,requests};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
test("Only Mine uses verified Person IDs, yields 50 groups without another Work API read",async()=>{
 const fetcher=async(url)=>{
  assert.equal(url,"/api/work-schedule-mine-identity");
  return{status:200,ok:true,json:async()=>({success:true,candidatePersonIds:["formal-person"]})};
 };
 const x=mount(fetcher);
 await x.w.JLYWorkScheduleDateSearch.ensureWorkVisible("work-72");
 assert.equal((x.nodes.get("scheduleDashboard").innerHTML.match(/class="work-day-card date-search-result"/g)||[]).length,72);
 x.tabs[1].listeners.click({preventDefault(){},stopImmediatePropagation(){}});
 await settle();await settle();
 const html=x.nodes.get("scheduleDashboard").innerHTML;
 assert.equal((html.match(/class="work-day-card date-search-result"/g)||[]).length,50);
 assert.equal(x.requests.length,1);
});
test("No LINE session shows login action instead of falsely reporting zero shifts",async()=>{
 const x=mount(async()=>({status:401,ok:false,json:async()=>({error:"line_login_required"})}));
 await x.w.JLYWorkScheduleDateSearch.ensureWorkVisible("work-72");
 x.tabs[1].listeners.click({preventDefault(){},stopImmediatePropagation(){}});
 await settle();await settle();
 const host=x.nodes.get("scheduleDashboard");
 assert.match(host.innerHTML,/LINE 登入確認身分/);
 assert.doesNotMatch(host.innerHTML,/目前沒有你的排班/);
 host.listeners.click({target:{closest:selector=>selector==="[data-work-mine-login]"?{}:null}});
 await settle();
 assert.equal(x.w.started,true);
 assert.equal(x.requests.length,1);
});
