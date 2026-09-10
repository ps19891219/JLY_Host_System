const fs=require('fs'),assert=require('assert');
const js=fs.readFileSync('js/modules/work-schedule/work-schedule-date-search.js','utf8');
const page=fs.readFileSync('pages/work-schedule.html','utf8');
assert(js.includes("currentRows=V.ensureMonthSnapshot?await V.ensureMonthSnapshot(currentMonth):await V.loadMonth(currentMonth)"),'default view should load current month snapshot');
assert(!js.includes("String(r.date||'')>=today"),'default view must not hide already-scheduled earlier dates in the current month');
assert(js.includes("filter(r=>r.status!=='cancelled')"),'default view should only exclude cancelled rows');
assert(page.includes('work-schedule-date-search.js?v=4'),'date search cache version should be bumped');
console.log('work-schedule-current-month-all.test.js passed');
