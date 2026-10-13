"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const code=fs.readFileSync("js/modules/work-schedule/work-schedule-dm-npc-sections.js","utf8");
const page=fs.readFileSync("pages/work-schedule.html","utf8");

test("72 rendered DM/NPC groups do not enter a recursive DOM mutation loop",async()=>{
 const observers=[];
 let changes=0,callbacks=0,active=false;
 class FakeElement{
  constructor(cls,text=""){this.className=cls;this.textContent=text;this.children=[];this.parentNode=null;this.dataset={};}
  get classList(){return {contains:cls=>this.className.split(" ").includes(cls)};}
  matches(s){return s.startsWith(".")&&this.classList.contains(s.slice(1));}
  querySelector(s){if(s==="strong")return {childNodes:[{textContent:this.textContent}],textContent:this.textContent};return null;}
  querySelectorAll(s){if(!s.startsWith(":scope > "))return [];return this.children.filter(child=>child.matches(s.slice(9)));}
  appendChild(el){if(el.parentNode){el.parentNode.children=el.parentNode.children.filter(x=>x!==el);}this.children.push(el);el.parentNode=this;this.changed();return el;}
  insertBefore(el,target){if(el.parentNode)el.parentNode.children=el.parentNode.children.filter(x=>x!==el);const i=this.children.indexOf(target);assert.notEqual(i,-1);this.children.splice(i,0,el);el.parentNode=this;this.changed();}
  remove(){if(this.parentNode){const p=this.parentNode;p.children=p.children.filter(x=>x!==this);this.parentNode=null;p.changed()}}
  changed(){changes++;if(active)queueMicrotask(()=>{callbacks++;if(callbacks>5)throw Error("observer self-loop");for(const o of observers)o.callback()})}
 }
 class FakeMutationObserver{
  constructor(callback){this.callback=callback;observers.push(this);}
  observe(){active=true}
  disconnect(){active=false}
 }
 const lists=Array.from({length:72},()=>{
  const list=new FakeElement("role-summary-list");
  const npc=new FakeElement("role-summary","NPC");
  const dm=new FakeElement("role-summary","DM");
  list.appendChild(npc);list.appendChild(dm);
  return list;
 });
 const fakeDocument={
  readyState:"complete",body:new FakeElement("body"),
  querySelectorAll(s){return s===".role-summary-list"?lists:[]},
  getElementById(){return null},
  createElement(){return new FakeElement("div")}
 };
 const fakeWindow={};
 vm.runInNewContext(code,{window:fakeWindow,document:fakeDocument,MutationObserver:FakeMutationObserver,console});
 assert.equal(observers.length,1);
 for(const list of lists){
  assert.deepEqual(list.children.map(e=>e.className),
   ["work-role-section-title is-dm","role-summary","work-role-section-title is-npc","role-summary"]);
  assert.equal(list.children[1].textContent,"DM");
  assert.equal(list.children[3].textContent,"NPC");
 }
 const before=changes;
 fakeDocument.body.appendChild(new FakeElement("unrelated"));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(callbacks,1,"observer should run once for an unrelated DOM change");
 assert.equal(changes,before+1,"refresh of already grouped 72 event cards must not change their DOM");
 assert.match(page,/work-schedule-dm-npc-sections\.js\?v=2/);
});
