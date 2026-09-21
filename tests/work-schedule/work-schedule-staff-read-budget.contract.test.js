const fs=require('fs');
const api=fs.readFileSync('api/work-schedule-staff-context.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(!api.includes('where("studioName","==",studio).get()'),'staff context must not scan all studio memberships');
ok(!api.includes('where("type","==","work-schedule-month").get()'),'staff context must not query all month view docs by type');
ok(!api.includes('.doc("month-index").get()'),'staff context must not fan out from the complete month index');
ok(api.includes('requestedMonths(req.query)'),'staff context must use a bounded requested month window');
ok(api.includes('[-1,0,1,2]'),'default employee schedule window must remain bounded');
ok(api.includes('doc(`month-${mk}`).get()'),'staff context must fetch only deterministic prepared month snapshots');
console.log('work-schedule staff read budget guard: ok');

ok(api.includes('tentativePersonIds'),'staff context must surface tentative assignments from prepared views');
ok(api.includes('isTentativeMine'),'tentative assignment must be visible to the assigned employee without scanning workShifts');

const view=fs.readFileSync('js/modules/work-schedule/work-schedule-read-view.js','utf8');
const dashboard=fs.readFileSync('js/modules/work-schedule/work-schedule-dashboard.js','utf8');
ok(view.includes('async function upsertShift(row)'),'read view must support incremental shift upsert');
ok(dashboard.includes('V.upsertShift'),'dashboard assignment writes should incrementally update prepared month views');

const composer=fs.readFileSync('js/modules/work-schedule/work-schedule-session-composer.js','utf8');
const slots=fs.readFileSync('js/modules/work-schedule/work-schedule-staff-slots.js','utf8');
ok(composer.includes('V.upsertShift'),'session composer should incrementally update prepared views');
ok(slots.includes('changed.map(V.upsertShift)'),'staff slot writes should incrementally update prepared views');
ok(composer.includes('assignedPersonIds:formalIds'),'matching draft must not place tentative staff in formal assignment ids');
ok(composer.includes('tentativePersonIds:matchingSource?ids:[]'),'matching draft must preserve tentative assignees separately');
