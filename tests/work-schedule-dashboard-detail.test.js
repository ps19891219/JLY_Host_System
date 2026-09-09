const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const page=fs.readFileSync('pages/work-schedule.html','utf8');
const dashboard=fs.readFileSync('js/modules/work-schedule/work-schedule-dashboard.js','utf8');

test('dashboard uses one visible dashboard instead of rendering the legacy duplicate list',()=>{
  assert.match(page,/id="scheduleDashboard"/);
  assert.doesNotMatch(page,/id="scheduleList"/);
  assert.doesNotMatch(page,/class="schedule-toolbar card"/);
});

test('tapping a work day opens the detail view from the whole card',()=>{
  assert.match(page,/id="groupDetailDialog"/);
  assert.match(dashboard,/\.work-day-card\[data-group\]/);
  assert.match(dashboard,/openGroup\(card\.dataset\.group\)/);
  assert.match(dashboard,/>詳細<\/button>/);
});

test('dashboard keeps date and time on the same compact line',()=>{
  assert.match(dashboard,/class="group-date">\$\{esc\(g\.date\)\}　\$\{esc\(timeText\(g\)\)\}/);
  assert.match(dashboard,/groupDetailMeta.*g\.date.*timeText\(g\)/s);
});
