"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

test("replacement on confirmation-required shift stays tentative until employee confirms",()=>{
  const src=fs.readFileSync("js/modules/work-schedule/work-schedule-lifecycle.js","utf8");
  assert.match(src,/summary\.classification\.assignment/);
  assert.match(src,/states\[id\]='tentative'/);
  assert.match(src,/nextAssigned=nextAssigned\.filter\(id=>!added\.includes\(id\)\)/);
  assert.match(src,/nextTentative=ids\(\[\.\.\.nextTentative,\.\.\.added\]\)/);
  assert.match(src,/assignmentConfirmationRequired:true/);
});

test("lifecycle mutates the final after row before Prepared View sync",()=>{
  const src=fs.readFileSync("js/modules/work-schedule/work-schedule-lifecycle.js","utf8");
  assert.match(src,/Object\.assign\(after,patch\)/);
  assert.match(src,/finalAfter:after/);
});

test("removed replacement assignees are not left in active confirmation map",()=>{
  const src=fs.readFileSync("js/modules/work-schedule/work-schedule-lifecycle.js","utf8");
  assert.match(src,/removed\.forEach\(id=>delete states\[id\]\)/);
});
