"use strict";
const fs=require("node:fs"),assert=require("node:assert");
const view=fs.readFileSync("js/modules/work-schedule/work-schedule-read-view.js","utf8");
const page=fs.readFileSync("pages/work-schedule.html","utf8");

assert(view.includes("const snapshots=db.collection('workScheduleViewSnapshots')"),"snapshot collection must be defined");
assert(view.includes("async function snapshotPreparedView"),"snapshot helper must exist");
assert(view.includes("async function restorePreparedViewSnapshot"),"restore helper must exist");
assert(view.includes("snapshot_target_mismatch"),"restore must validate target");
assert(view.includes("snapshot_has_no_restorable_data"),"restore must fail closed when source did not previously exist");

const rebuildMonth=view.slice(view.indexOf("async function rebuildMonth"),view.indexOf("async function loadMonthSnapshot"));
assert(rebuildMonth.includes("snapshotPreparedView(targetId,'rebuildMonth',target)"),"rebuildMonth must snapshot before overwrite");

const repair=view.slice(view.indexOf("async function repairWorkHistory"),view.indexOf("function sortWorkRows"));
assert(repair.includes("snapshotPreparedView(`month-${mk}`,'repairWorkHistory',doc)"),"repairWorkHistory must snapshot each month before overwrite");

const rebuildMonthIndex=view.slice(view.indexOf("async function rebuildMonthIndex"),view.indexOf("async function loadMonthIndex"));
assert(rebuildMonthIndex.includes("snapshotPreparedView('month-index','rebuildMonthIndex',indexDoc)"),"month-index rebuild must snapshot before overwrite");

const rebuildWorkIndex=view.slice(view.indexOf("async function rebuildWorkIndex"),view.indexOf("async function loadWorkIndex"));
assert(rebuildWorkIndex.includes("snapshotPreparedView('work-index','rebuildWorkIndex',indexDoc)"),"work-index rebuild must snapshot before overwrite");

assert(page.includes("/js/modules/work-schedule/work-schedule-read-view.js?v=8"),"Work Schedule must load refreshed snapshot-safe asset");
console.log("work schedule repair snapshot contract ok");
