const fs=require('fs'),assert=require('assert');
const home=fs.readFileSync('index.html','utf8');
const mycar=fs.readFileSync('pages/mycar.html','utf8');
const studio=fs.readFileSync('pages/studio.html','utf8');
const schedule=fs.readFileSync('pages/work-schedule.html','utf8');

assert.ok(home.includes("pages/studio.html"),'home exposes dedicated studio management entry');
assert.ok(!home.includes("location.href='pages/work-schedule.html'"),'home no longer jumps directly into studio schedule');
assert.ok(!mycar.includes('work-schedule.html'),'My Car does not expose the studio scheduling backend');
assert.ok(studio.includes("location.href='work-schedule.html'"),'studio management owns the work schedule entry');
assert.ok(schedule.includes('工作室排班'),'schedule is explicitly framed as studio/admin scheduling');
assert.ok(schedule.includes('href="studio.html"'),'schedule returns to studio management, not My Car');
console.log('work-schedule studio entry separation ok');
