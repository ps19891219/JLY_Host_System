const fs = require('fs');
const assert = require('assert');

const page = fs.readFileSync('pages/work-schedule.html', 'utf8');
const js = fs.readFileSync('js/modules/work-schedule/work-schedule-upcoming.js', 'utf8');

assert(page.includes('近期班表'));
assert(page.includes('指定月份'));
assert(page.includes('work-schedule-upcoming.js?v=1'));
assert(page.includes('work-schedule-upcoming.css?v=1'));
assert(js.includes('V.loadMonth'));
assert(js.includes('keys.map'));
assert(js.includes("String(r.date||'')>=today"));
assert(js.includes('slice(0,30)'));
assert(js.includes('reloadMonth'));
assert(!js.includes("db.collection('workShifts')"));
assert(!js.includes('location.reload'));

console.log('work-schedule upcoming view regression passed');
