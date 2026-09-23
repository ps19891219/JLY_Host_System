const fs=require('fs');
const api=fs.readFileSync('api/work-schedule-staff-confirmation.js','utf8');
const domain=fs.readFileSync('shared/work-schedule/staff-assignment-confirmation.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(!api.includes('collection("pendingActions")'),'employee confirmation must not invent a Pending Action collection before the shared core is identified');
ok(domain.includes('buildPendingAction'),'domain may expose a projection for the shared Pending Action core');
ok(api.includes('workScheduleViews'),'employee confirmation must write through Prepared Views');
ok(api.includes('work-')&&api.includes('-all'),'employee confirmation must sync the Work Prepared View');
ok(api.includes('-person-'),'employee confirmation must sync affected person Prepared Views');
console.log('staff confirmation pending-action boundary: ok');
