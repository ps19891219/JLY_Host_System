const fs=require('fs'),assert=require('assert');
const view=fs.readFileSync('js/modules/work-schedule/work-schedule-read-view.js','utf8');
const search=fs.readFileSync('js/modules/work-schedule/work-schedule-date-search.js','utf8');
assert(view.includes("where('date','>=',start)"),'month rebuild should have targeted date-range fallback');
assert(view.includes("where('date','<',end)"),'month rebuild should cap targeted date range');
assert(view.includes('ensureMonthSnapshot'),'read model should expose one-time snapshot repair helper');
assert(search.includes('ensureMonthSnapshot(currentMonth)'),'default view should repair missing or empty current-month snapshot');
assert(!search.includes("collection('workShifts')"),'date search module must not directly scan formal shifts');
console.log('work-schedule-view-repair.test.js passed');
