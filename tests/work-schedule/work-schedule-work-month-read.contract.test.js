"use strict";
const fs=require("node:fs"),assert=require("node:assert");
const view=fs.readFileSync("js/modules/work-schedule/work-schedule-read-view.js","utf8");
const page=fs.readFileSync("pages/work-schedule.html","utf8");

assert(view.includes("async function loadWorkMonth(workId,monthKey)"),"loadWorkMonth must exist");
assert(view.includes("const rows=await loadMonthSnapshot(monthKey)"),"work-month reads must use the bounded month Prepared View");
assert(view.includes("txt(r.workId)===id"),"work-month reads must filter by workId");
assert(!/async function loadWorkMonth[\s\S]{0,250}loadWorkRows\(id\)/.test(view),"work-month reads must not depend on the all-history work view");
assert(page.includes("/js/modules/work-schedule/work-schedule-read-view.js?v=8"),"Work Schedule must load the refreshed read-view asset");
console.log("work schedule work-month prepared-view contract ok");
