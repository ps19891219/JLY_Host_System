'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('date-search publishes the rows currently displayed to the user', () => {
  const source = read('js/modules/work-schedule/work-schedule-date-search.js');
  assert.match(source, /JLYWorkScheduleDisplayScope=\{source:'date-search',rows:Array\.isArray\(rows\)\?rows\.slice\(\):\[\]\}/);
});

test('batch edit temporarily uses displayed cross-month rows', () => {
  const source = read('js/modules/work-schedule/work-schedule-batch-display-scope.js');
  assert.match(source, /querySelector\('\.date-search-result'\)/);
  assert.match(source, /dashboard\.getRows=\(\)=>scopedRows\.slice\(\)/);
  assert.match(source, /finally\{\s*dashboard\.getRows=originalGetRows/);
});

test('work schedule page loads the display-scope bridge after staff slots', () => {
  const html = read('pages/work-schedule.html');
  const staff = html.indexOf('work-schedule-staff-slots.js?v=7');
  const bridge = html.indexOf('work-schedule-batch-display-scope.js?v=1');
  assert.ok(staff >= 0);
  assert.ok(bridge > staff);
  assert.match(html, /work-schedule-date-search\.js\?v=7/);
});
