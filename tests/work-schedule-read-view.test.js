const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const view=fs.readFileSync('js/modules/work-schedule/work-schedule-read-view.js','utf8');
const dashboard=fs.readFileSync('js/modules/work-schedule/work-schedule-dashboard.js','utf8');
const hub=fs.readFileSync('js/modules/work-schedule/work-schedule-work-hub.js','utf8');
const person=fs.readFileSync('js/modules/work-schedule/work-schedule-person-create.js','utf8');
const page=fs.readFileSync('pages/work-schedule.html','utf8');

test('read-view parses and is loaded before consumers',()=>{assert.doesNotThrow(()=>new vm.Script(view));assert.match(page,/work-schedule-read-view\.js\?v=1[\s\S]*work-schedule-dashboard\.js\?v=5[\s\S]*work-schedule-staff-slots\.js\?v=4[\s\S]*work-schedule-work-hub\.js\?v=2/)});
test('normal dashboard reads month View and bootstrap is isolated in View builder',()=>{assert.match(dashboard,/V\.loadMonth\(monthKey\(month\)\)/);assert.doesNotMatch(dashboard,/shifts\.where\(['"]monthKey/);assert.match(view,/async function rebuildMonth/);assert.match(view,/shifts\.where\('monthKey','==',monthKey\)\.get\(\)/)});
test('normal Work Hub reads Work index View, not all authoritative Works',()=>{assert.match(hub,/V\.loadWorkIndex\(\)/);assert.doesNotMatch(hub,/works\.get\(\)/);assert.match(view,/async function rebuildWorkIndex/);assert.match(view,/works\.get\(\)/)});
test('repair and retry hacks are retired from normal runtime',()=>{assert.doesNotMatch(person,/repairDuplicateWorks/);assert.doesNotMatch(page,/retry=|setTimeout\(function\(\)\{if\(!host/);assert.doesNotMatch(page,/work-schedule-v2\.js/)});
test('normal runtime uses one-init guards',()=>{assert.match(dashboard,/__JLYWorkScheduleDashboardInitialized/);assert.match(hub,/__JLYWorkScheduleWorkHubInitialized/);assert.match(person,/__JLYWorkSchedulePersonCreateInitialized/)});
