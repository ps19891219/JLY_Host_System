"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const A=require("../scripts/person-guest-cleanup-dry-run.js");
test("formal LINE identity is never removable",()=>assert.equal(A.assessGuest({id:"p1",memberType:"guest",lineUserId:"U1"},[]).decision,"KEEP_MEMBER"));
test("guest with self-contained historical snapshot can be removed",()=>{
 const r=A.assessGuest({id:"g1",memberType:"guest"},[{id:"a1",players:[{personId:"g1",playerName:"RN",roleChoice:"A"}]}]);
 assert.equal(r.decision,"SAFE_TO_REMOVE_GUEST");assert.equal(r.activityReferences.length,1);
});
test("guest remains when historical activity only has Person pointer",()=>{
 const r=A.assessGuest({id:"g1",memberType:"guest"},[{id:"a1",players:[{personId:"g1",roleChoice:"A"}]}]);
 assert.equal(r.decision,"KEEP_HISTORY_DEPENDENCY");
});
test("dry-run never mutates and reports decisions only",()=>{
 const r=A.buildDryRun([{id:"g1",memberType:"guest"}],[]);
 assert.equal(r.mode,"dry-run");assert.equal(r.counts.SAFE_TO_REMOVE_GUEST,1);
});

test("cleanup plan contains only dry-run safe guests and preserves history",()=>{
 const report=A.buildDryRun([{id:"safe",memberType:"guest"},{id:"member",lineUserId:"U1"}],[]);
 const plan=A.removalPlan(report);
 assert.deepEqual(plan.map(x=>x.personId),["safe"]);assert.equal(plan[0].preserveActivityHistory,true);
});
test("prepared directory removal does not touch unrelated People",()=>{
 const view=A.applyDirectoryRemoval({people:[{id:"safe"},{id:"keep"}]},["safe"]);
 assert.deepEqual(view.people.map(x=>x.id),["keep"]);assert.equal(view.count,1);
});

test("cleanup plan contains only guests proven safe to remove",()=>{
 const report={rows:[{personId:"safe",decision:"SAFE_TO_REMOVE_GUEST"},{personId:"member",decision:"KEEP_MEMBER"},{personId:"history",decision:"KEEP_HISTORY_DEPENDENCY"}]};
 const plan=A.removalPlan(report);assert.deepEqual(plan.deletePersonIds,["safe"]);assert.equal(plan.mode,"plan-only");
});
test("prepared directory removes only approved guest ids",()=>{
 const view=A.applyPreparedViewRemovals({people:[{id:"safe"},{id:"keep"}]},["safe"]);
 assert.deepEqual(view.people.map(x=>x.id),["keep"]);assert.equal(view.count,1);
});
