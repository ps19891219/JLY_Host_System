const fs=require('fs');
const api=fs.readFileSync('api/work-schedule-staff-context.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(!api.includes('where("studioName","==",studio).get()'),'staff context must not scan all studio memberships');
ok(!api.includes('where("type","==","work-schedule-month").get()'),'staff context must not query all month view docs by type');
ok(api.includes('.doc("month-index").get()'),'staff context must use prepared month index');
ok(api.includes('doc(`month-${mk}`).get()'),'staff context must fetch prepared month snapshots by deterministic id');
console.log('work-schedule staff read budget guard: ok');
