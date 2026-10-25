const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('staffing demand parses missing, zero and bounded integer values',()=>{
 const source=read('js/modules/work-schedule/work-schedule-staffing.js'),context={window:{}};
 vm.runInNewContext(source,context);
 const S=context.window.JLYWorkScheduleStaffing;
 assert.equal(S.count(null),null);assert.equal(S.count(''),null);assert.equal(S.count(0),0);
 assert.equal(S.count('2'),2);assert.equal(S.count(-1),null);assert.equal(S.count(1.5),null);assert.equal(S.count(31),null);
});

test('Work role demand default supports existing requiredCount and new requiredStaffCount',()=>{
 const context={window:{}};vm.runInNewContext(read('js/modules/work-schedule/work-schedule-staffing.js'),context);
 const S=context.window.JLYWorkScheduleStaffing;
 assert.equal(S.defaultForRole({requiredCount:2}),2);
 assert.equal(S.defaultForRole({requiredStaffCount:0,requiredCount:2}),0);
 assert.equal(S.defaultForRole({requiredStaffCount:null,requiredCount:2}),null);
});

test('shortage summary distinguishes unset, zero, missing and filled demands',()=>{
 const context={window:{}};vm.runInNewContext(read('js/modules/work-schedule/work-schedule-staffing.js'),context);
 const summarize=context.window.JLYWorkScheduleStaffing.summarize;
 assert.equal(summarize({roleName:'DM',personIds:[]}).label,'尚未設定需求');
 assert.equal(summarize({roleName:'DM',requiredStaffCount:0,personIds:[]}).label,'');
 assert.equal(summarize({roleName:'DM',requiredStaffCount:2,personIds:['p1']}).label,'尚缺 1 位 DM');
 assert.equal(summarize({roleName:'NPC',requiredStaffCount:2,personIds:['p1','p2']}).label,'NPC 已排滿');
 assert.equal(summarize({roleName:'DM',requiredStaffCount:1,personIds:['p1','p1']}).assigned,1);
});

test('session composer creates unassigned role rows and copies per-session demand',()=>{
 const composer=read('js/modules/work-schedule/work-schedule-session-composer.js');
 assert.match(composer,/data-session-demand/);
 assert.match(composer,/if\(existing&&!ids\.length\)continue/);
 assert.doesNotMatch(composer,/if\(!ids\.length\)continue/);
 assert.match(composer,/requiredStaffCount,/);
 assert.match(composer,/V\.syncShifts\(changes\.map/);
 assert.match(composer,/沒有新的場次可建立/);
});

test('Work role defaults and single-shift override controls share existing Work and Shift data',()=>{
 const hub=read('js/modules/work-schedule/work-schedule-work-hub.js');
 const detail=read('js/modules/work-schedule/work-schedule-staff-slots.js');
 assert.match(hub,/data-role-demand/);assert.match(hub,/requiredStaffCount:S\?\.defaultForRole/);
 assert.match(detail,/data-staff-demand/);assert.match(detail,/requiredStaffCount:requirement/);assert.match(detail,/const payload=payloadFromSlots\(item\.row,slots,required\)/);
 assert.match(detail,/V\.syncShifts\(changed\)/);
});

test('batch demand edits are restricted to checked existing role rows',()=>{
 const detail=read('js/modules/work-schedule/work-schedule-staff-slots.js');
 assert.match(detail,/staffBatchDemandEnabled/);assert.match(detail,/staffBatchDemand/);
 assert.match(detail,/const eligible=new Set\(batchRows\(\)\.map/);
 assert.match(detail,/if\(!eligible\.has\(String\(id\)\)\)continue/);
 assert.match(detail,/if\(changeDemand\)payload\.requiredStaffCount=requiredStaffCount/);
 assert.match(detail,/function meaningfulRow\(row\)\{return Boolean\(row\?\.id\)\}/);
});

test('read views normalize demand while normal schedule reads remain Prepared View based',()=>{
 const view=read('js/modules/work-schedule/work-schedule-read-view.js');
 const dashboard=read('js/modules/work-schedule/work-schedule-dashboard.js');
 assert.match(view,/requiredStaffCount:S\?\.count\(x\.requiredStaffCount\)/);
 assert.match(view,/async function syncShifts/);assert.match(view,/workScheduleViews/);
 assert.match(dashboard,/V\.loadMonth\(monthKey\(month\)\)/);
 assert.doesNotMatch(dashboard,/shifts\.where\(['"]monthKey/);
});

test('dashboard, date search and staff renderer show demand status for empty rows',()=>{
 const dashboard=read('js/modules/work-schedule/work-schedule-dashboard.js');
 assert.match(dashboard,/S\?\.summarize/);
 for(const file of ['js/modules/work-schedule/work-schedule-date-search.js','js/modules/work-schedule/work-schedule-read-renderer.js','js/modules/work-schedule/work-schedule-mine-full-card.js'])
  assert.match(read(file),/JLYWorkScheduleStaffing\?\.summarize/);
});

test('empty-staff Google sync retains existing role summary and Calendar provider path',()=>{
 const google=read('js/modules/work-schedule/work-schedule-google.js');
 assert.match(google,/names\|\|'尚未排人'/);
 assert.match(google,/provider\.createEvent/);assert.match(google,/provider\.updateEvent/);
});

test('HTML loads staffing helper before its Work Schedule consumers and bumps runtime assets',()=>{
 const page=read('pages/work-schedule.html'),staff=read('pages/work-schedule-staff.html');
 assert.match(page,/work-schedule-staffing\.js\?v=1[\s\S]*work-schedule-read-view\.js\?v=11[\s\S]*work-schedule-dashboard\.js\?v=13/);
 assert.match(page,/work-schedule-session-composer\.js\?v=9/);assert.match(page,/work-schedule-work-hub\.js\?v=12/);
 assert.match(staff,/work-schedule-staffing\.js\?v=1[\s\S]*work-schedule-read-renderer\.js\?v=2/);
});

test('staffing scope does not write Person, Identity, historical Car or LINE records',()=>{
 const changed=['js/modules/work-schedule/work-schedule-staffing.js','js/modules/work-schedule/work-schedule-session-composer.js','js/modules/work-schedule/work-schedule-staff-slots.js','js/modules/work-schedule/work-schedule-work-hub.js'];
 for(const file of changed){const src=read(file);assert.doesNotMatch(src,/collection\(['"](?:persons|personDirectory|players|cars|memberships|lineIdentities)['"]\)/);}
});
