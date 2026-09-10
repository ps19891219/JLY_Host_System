const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const jsPath = path.join(root, 'js/modules/work-schedule/work-schedule-staff-slots.js');
const htmlPath = path.join(root, 'pages/work-schedule.html');
const cssPath = path.join(root, 'css/pages/work-schedule-staff-slots.css');

test('Work Schedule staff-slot enhancement parses and v3 assets are wired after dashboard', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotThrow(() => new vm.Script(js));
  assert.match(html, /work-schedule-dashboard\.js\?v=4[\s\S]*work-schedule-staff-slots\.js\?v=3/);
  assert.match(html, /work-schedule-staff-slots\.css\?v=3/);
  assert.match(html, /id="bulkBoardOpen"[^>]*>批次修改</);
});

test('staff slots preserve canonical Person IDs without importing player Seat Engine', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /staffSlots/);
  assert.match(js, /assignedPersonIds/);
  assert.match(js, /personIds/);
  assert.match(js, /eligiblePersonIds/);
  assert.match(js, /loadPersonDirectory/);
  assert.doesNotMatch(js, /js\/car\/seat|JLYSeatData|JLYSeatRender|JLYSeatDrag/);
});

test('detail is single-day editing and can add a main role', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /staffAddRole/);
  assert.match(js, /新增主要角色/);
  assert.match(js, /createRoleForShift/);
  assert.match(js, /這裡只修改這一天/);
  assert.doesNotMatch(js, /data-batch-role/);
  assert.doesNotMatch(js, /data-default-role/);
  assert.doesNotMatch(js, /saveAsDefault/);
});

test('staff-slot detail supports configurable labels, people, add-remove and desktop plus touch drag', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(js, /data-slot-label/);
  assert.match(js, /data-pick-person/);
  assert.match(js, /data-add-slot/);
  assert.match(js, /data-remove-slot/);
  assert.match(js, /ondragstart/);
  assert.match(js, /ondrop/);
  assert.match(js, /onpointerdown/);
  assert.match(js, /onpointermove/);
  assert.match(css, /staff-slot-handle[^}]*touch-action:none/);
});

test('dashboard summary renders every role row with actual assigned person names', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /rs\.map\(r=>/);
  assert.match(js, /s\.names\.join\('、'\)/);
  assert.match(js, /rowNames\(r\)/);
  assert.doesNotMatch(js, /slots\.map\(s=>s\.label\)\.join\('・'\)/);
});

test('Shift slots remain flexible overrides with stable keys and numeric default labels', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /slotKey/);
  assert.match(js, /defaultLabel\(i\)/);
  assert.match(js, /String\(i\+1\)/);
  assert.match(js, /if\(stored\)/);
  assert.match(js, /requiredCount:slots\.length/);
});

test('batch editing lives on dashboard and can change duty or Person across selected dates', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /bulkBoardOpen/);
  assert.match(js, /openDashboardBatch/);
  assert.match(js, /staffBatchDates/);
  assert.match(js, /staffBatchLabelEnabled/);
  assert.match(js, /staffBatchPersonEnabled/);
  assert.match(js, /staffBatchCreateMissing/);
  assert.match(js, /applyBatch/);
  assert.doesNotMatch(js, /staffBatchSetDefault/);
});
