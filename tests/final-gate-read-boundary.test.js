"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const read=fs.readFileSync("js/modules/work-schedule/work-schedule-read-view.js","utf8");
const dashboard=fs.readFileSync("js/modules/work-schedule/work-schedule-dashboard.js","utf8");
const composer=fs.readFileSync("js/modules/work-schedule/work-schedule-session-composer.js","utf8");
const matching=fs.readFileSync("js/modules/work-schedule/studio-matching-workspace.js","utf8");
const vote=fs.readFileSync("api/studio-matching-vote-context.js","utf8");

function body(name){
  const marker="async function "+name;
  const start=read.indexOf(marker);
  assert.notEqual(start,-1,name+" missing");
  const next=read.indexOf("\nasync function ",start+marker.length);
  return read.slice(start,next<0?read.length:next);
}

test("normal Work Schedule reads fail closed on missing Prepared Views",()=>{
  for(const name of ["ensureMonthSnapshot","loadWorkMonth","loadMonth","loadMonthIndex","loadWorkIndex"]){
    const src=body(name);
    assert.doesNotMatch(src,/rebuildMonth\s*\(|rebuildMonthIndex\s*\(|rebuildWorkIndex\s*\(|shifts\.where\s*\(|shifts\.get\s*\(/,name+" must not rebuild or scan SoT");
  }
});

test("Work Schedule writes use incremental Prepared View writer",()=>{
  assert.match(read,/async function applyRowChange/);
  assert.match(read,/async function syncShifts/);
  assert.match(read,/async function upsertShift/);
  assert.match(dashboard,/V\.syncShifts/);
  assert.match(composer,/V\.syncShifts/);
  assert.doesNotMatch(dashboard,/rebuildMonth\s*\(/);
  assert.doesNotMatch(composer,/rebuildMonth\s*\(/);
});

test("Employee Confirmation fields survive Prepared View normalization",()=>{
  for(const field of ["tentativePersonIds","assignmentConfirmationRequired","assignmentConfirmationStatus","assignmentConfirmationByPerson"])assert.match(read,new RegExp(field));
});

test("Studio Matching normal reads use Prepared Views",()=>{
  assert.match(matching,/studioMatchingViews/);
  assert.match(vote,/studioMatchingViews/);
  assert.doesNotMatch(matching,/\.get\(\)[^\n]*studioMatchings/);
  assert.match(vote,/matching_view_not_ready/);
});

console.log("final gate read boundary contract passed");
