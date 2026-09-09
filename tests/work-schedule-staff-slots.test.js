const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const jsPath = path.join(root, 'js/modules/work-schedule/work-schedule-staff-slots.js');
const htmlPath = path.join(root, 'pages/work-schedule.html');
const cssPath = path.join(root, 'css/pages/work-schedule-staff-slots.css');

test('Work Schedule staff-slot enhancement parses and is wired after dashboard', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotThrow(() => new vm.Script(js));
  assert.match(html, /work-schedule-dashboard\.js\?v=4[\s\S]*work-schedule-staff-slots\.js\?v=1/);
  assert.match(html, /work-schedule-staff-slots\.css\?v=1/);
});

test('staff slots preserve canonical Person IDs and do not import player Seat Engine modules', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /staffSlots/);
  assert.match(js, /assignedPersonIds/);
  assert.match(js, /personIds/);
  assert.match(js, /eligiblePersonIds/);
  assert.doesNotMatch(js, /js\/car\/seat|JLYSeatData|JLYSeatRender|JLYSeatDrag/);
});

test('staff-slot UI supports editable labels, person replacement, add-remove and drag ordering', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(js, /data-slot-label/);
  assert.match(js, /data-pick-person/);
  assert.match(js, /data-add-slot/);
  assert.match(js, /data-remove-slot/);
  assert.match(js, /ondragstart/);
  assert.match(js, /ondrop/);
  assert.match(css, /staff-slot-handle/);
  assert.match(css, /staff-person-button/);
});

test('dashboard summary is enhanced to role plus slot labels rather than full names', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /slots\.map\(s=>s\.label\)\.join\('・'\)/);
  assert.match(js, /role-summary/);
});
