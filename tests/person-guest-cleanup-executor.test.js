"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const X=require("../scripts/person-guest-cleanup-executor.js");
test("cleanup plan removes only dry-run approved guests from prepared view",()=>{
 const report={rows:[{personId:"g1",decision:"SAFE_TO_REMOVE_GUEST"},{personId:"g2",decision:"KEEP_HISTORY_DEPENDENCY"},{personId:"m1",decision:"KEEP_MEMBER"}]};
 const plan=X.planCleanup(report,{people:[{id:"g1"},{id:"g2"},{id:"m1"}]});
 assert.deepEqual(plan.deletePersonIds,["g1"]);assert.deepEqual(plan.preparedView.people.map(x=>x.id),["g2","m1"]);
 assert.deepEqual(plan.deleteActivities,[]);assert.deepEqual(plan.deleteMemberships,[]);
});
test("cleanup execution requires explicit confirmation",async()=>{await assert.rejects(()=>X.executeCleanup({}, {deletePersonIds:["g1"]}),/guest_cleanup_confirmation_required/);});
