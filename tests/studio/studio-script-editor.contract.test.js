"use strict";const assert=require("node:assert/strict"),fs=require("node:fs"),test=require("node:test");
const page=fs.readFileSync("pages/studio-scripts.html","utf8"),js=fs.readFileSync("js/studio/studio-script.js","utf8");
test("studio script editor reuses Work Schedule source",()=>{assert.match(js,/collection\("workScheduleWorks"\)/);assert.match(js,/V\.loadWorkIndex\(\)/);assert.match(js,/V\.updateWork/);assert.doesNotMatch(js,/collection\("scripts"\)/);});
test("editing routes actor qualification back to existing Work Schedule",()=>{assert.match(page,/work-schedule\.html\?workId=/);assert.match(page,/排班／演員資格/);assert.match(js,/roles:merged\.roles/);});
test("studio editor owns booking and deposit settings",()=>{assert.match(page,/allowHostRequest/);assert.match(page,/depositRequired/);assert.match(page,/depositType/);assert.match(js,/depositAmount/);});
