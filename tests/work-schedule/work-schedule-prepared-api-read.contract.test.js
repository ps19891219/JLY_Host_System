"use strict";
const fs=require("node:fs"),assert=require("node:assert");
const view=fs.readFileSync("js/modules/work-schedule/work-schedule-read-view.js","utf8");
const api=fs.readFileSync("api/work-schedule-read-view.js","utf8");
const page=fs.readFileSync("pages/work-schedule.html","utf8");

const start=view.indexOf("async function loadWorkRows");
const end=view.indexOf("async function loadWorkMine");
const fn=view.slice(start,end);
assert(fn.includes("/api/work-schedule-read-view?workId="),"selected-work rows must use prepared-view API");
assert(fn.includes("cache:'no-store'"),"prepared-view API read must bypass stale cache");
assert(!fn.includes("views.doc(workRowsDocId"),"selected-work normal reads must not directly call client Firestore");
assert(api.includes('collection("workScheduleViews")'),"API must read only Work Schedule Prepared Views");
assert(api.includes('doc("work-"+workId+"-all")'),"API must target exactly one work prepared document");
assert(!api.includes('collection("workShifts")'),"API must not scan Source of Truth");
assert(page.includes("/js/modules/work-schedule/work-schedule-read-view.js?v=9"),"Work Schedule must load refreshed prepared-read asset");
console.log("work schedule prepared API read contract ok");
