"use strict";
const fs=require("node:fs");
const test=require("node:test");
const assert=require("node:assert/strict");

const read=fs.readFileSync("js/modules/work-schedule/work-schedule-read-view.js","utf8");
const runtime=[
 "js/modules/work-schedule/work-schedule-dashboard.js",
 "js/modules/work-schedule/work-schedule-session-composer.js",
 "js/modules/work-schedule/work-schedule-staff-slots.js",
 "js/modules/work-schedule/work-schedule-batch-v2.js",
 "js/modules/work-schedule/work-schedule-date-search.js",
 "js/modules/work-schedule/work-schedule-shift-delete.js"
].map(p=>[p,fs.readFileSync(p,"utf8")]);

test("normal Work Schedule reads consume prepared views only",()=>{
 assert.match(read,/async function loadMonth\(monthKey\)\{return loadMonthSnapshot\(monthKey\)\}/);
 assert.match(read,/async function ensureMonthSnapshot\(monthKey\)\{return loadMonthSnapshot\(monthKey\)\}/);
 assert.match(read,/async function loadWorkMonth[\s\S]*?const rows=await loadMonthSnapshot\(monthKey\)/);
 assert.match(read,/async function loadMonthIndex\(\)\{const doc=await views\.doc\('month-index'\)\.get\(\)/);
 assert.match(read,/async function loadWorkIndex\(\)\{const doc=await views\.doc\('work-index'\)\.get\(\)/);
});

test("normal Work Schedule UI never invokes repair rebuilds",()=>{
 for(const [path,src] of runtime){
  assert.doesNotMatch(src,/\.rebuildMonth\s*\(/,path);
  assert.doesNotMatch(src,/\.rebuildMonthIndex\s*\(/,path);
  assert.doesNotMatch(src,/\.rebuildWorkIndex\s*\(/,path);
 }
});

test("write paths update prepared views incrementally",()=>{
 assert.match(read,/async function syncShifts\(changes\)/);
 assert.match(read,/work-schedule-work-all/);
 assert.match(read,/work-schedule-work-person/);
 assert.match(read,/async function applyRowChange\(before,after\)/);
 assert.match(read,/async function removeRow\(row\)/);
});
