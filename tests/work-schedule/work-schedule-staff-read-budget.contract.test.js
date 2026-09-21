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
ok(view.includes('async function syncShifts(changes)'),'read view must group prepared-view changes by month');
ok(view.includes('new Set([oldMk,newMk].filter(Boolean))'),'prepared view sync must handle month moves');
ok(dashboard.includes('V.syncShifts'),'dashboard assignment writes should batch prepared month view updates');

const composer=fs.readFileSync('js/modules/work-schedule/work-schedule-session-composer.js','utf8');
const slots=fs.readFileSync('js/modules/work-schedule/work-schedule-staff-slots.js','utf8');
ok(composer.includes('V.syncShifts'),'session composer should batch prepared view updates');
ok(slots.includes('V.syncShifts'),'staff slot writes should batch prepared view updates');
ok(!dashboard.includes('Promise.all(changes.map(c=>V.upsertShift'),'dashboard must not race same-month view writes');
ok(!composer.includes('Promise.all(changes.map(c=>V.upsertShift'),'composer must not race same-month view writes');
ok(composer.includes('assignedPersonIds:formalIds'),'matching draft must not place tentative staff in formal assignment ids');
ok(composer.includes('tentativePersonIds:matchingSource?ids:[]'),'matching draft must preserve tentative assignees separately');

const staffPage=fs.readFileSync('js/modules/work-schedule/work-schedule-staff-page.js','utf8');
const calendarRemove=fs.readFileSync('js/modules/work-schedule/work-schedule-staff-calendar-remove.js','utf8');
ok(staffPage.includes('&month=${encodeURIComponent(new Date().toISOString().slice(0,7))}'),'employee page must request one deterministic month');
ok(calendarRemove.includes('&month=${encodeURIComponent(new Date().toISOString().slice(0,7))}'),'Calendar removal must request one deterministic month');

const staffHtml=fs.readFileSync('pages/work-schedule-staff.html','utf8');
ok(staffHtml.includes('staffMonthPrev')&&staffHtml.includes('staffMonthNext'),'employee schedule needs explicit month navigation');
ok(staffPage.includes('encodeURIComponent(activeMonth)'),'month navigation must keep reads to one deterministic snapshot');
ok(staffPage.includes('function moveMonth(delta)'),'employee schedule must switch month without broad reads');

ok(view.includes('async function rememberMonths(monthKeys)'),'prepared view batch must update month index in one grouped operation');
ok(view.includes('await rememberMonths(remembered)'),'syncShifts must not reread month-index once per affected month');

ok(!staffPage.includes('fetch(`/api/work-schedule-staff-confirmation?'),'opening employee shift detail must not issue per-shift confirmation GET reads');
ok(staffPage.includes('assignmentConfirmationByPerson'),'employee confirmation state should render from prepared month view');
ok(staffPage.includes('(r.assignedPersonIds||r.personIds||[]).some'),'formal employee rows must be detected from formal assignment ids, not tentative flags');

ok(personLinks.includes('{maxReads=8}={}'),'formal person alias expansion must have a hard read budget');
ok(personLinks.includes('reads<maxReads')&&personLinks.includes('if(reads>=maxReads)break'),'alias traversal must stop at the configured Firestore read budget');
