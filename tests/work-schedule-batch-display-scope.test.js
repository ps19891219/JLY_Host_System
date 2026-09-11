'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('date-search publishes displayed rows and renders the full selectable card controls', () => {
  const source = read('js/modules/work-schedule/work-schedule-date-search.js');
  assert.match(source, /JLYWorkScheduleDisplayScope=\{source:'date-search',mode,rows:Array\.isArray\(rows\)\?rows\.slice\(\):\[\]\}/);
  assert.match(source, /data-select-group/);
  assert.match(source, /data-open-group/);
  assert.match(source, /data-sync-group/);
  assert.match(source, /JLYWorkScheduleDateSearch=\{refresh/);
});

test('cross-month bridge makes existing detail, batch modify and delete modules read displayed rows', () => {
  const source = read('js/modules/work-schedule/work-schedule-batch-display-scope.js');
  assert.match(source, /dashboard\.getRows=\(\)=>externalActive\(\)\?scopeRows\(\):originalGetRows\(\)/);
  assert.match(source, /querySelector\('\.date-search-result'\)/);
});

test('cross-month actions use capture phase so legacy onclick handlers cannot override selection', () => {
  const source = read('js/modules/work-schedule/work-schedule-batch-display-scope.js');
  for (const id of ['batchSelectAll','batchAssignOpen','batchSync','batchDelete','batchClear','batchAssignApply']) {
    assert.match(source, new RegExp(`captureButton\\('${id}'`));
  }
  assert.match(source, /addEventListener\('click',e=>\{if\(!externalActive\(\)\)return;e\.preventDefault\(\);e\.stopImmediatePropagation\(\);externalHandler\(e\)\},true\)/);
  assert.match(source, /function selectAll\(\)\{groups\(\)\.forEach\(g=>selected\.add\(g\.key\)\);updateSelectionUI\(\)\}/);
});

test('role ordering keeps GM or DM above PC or NPC in schedule surfaces', () => {
  const source = read('js/modules/work-schedule/work-schedule-batch-display-scope.js');
  assert.match(source, /function roleRank\(name\)/);
  assert.match(source, /\(GM\|DM\)/);
  assert.match(source, /\(PC\|NPC\)/);
  assert.match(source, /function normalizeRoleOrder\(\)/);
  assert.match(source, /\.role-summary-list/);
  assert.match(source, /\.staff-role-card/);
  assert.match(source, /'staffBatchRole','batchAssignRole'/);
});

test('cross-month assignment conflict checks and cache rebuild use the displayed scope months', () => {
  const source = read('js/modules/work-schedule/work-schedule-batch-display-scope.js');
  assert.match(source, /rows:sourceRows/);
  assert.match(source, /const months=\[\.\.\.new Set\(gs\.map/);
  assert.match(source, /V\?\.rebuildMonth\?\.\(mk\)/);
});

test('work schedule page cache-busts the select-all and role-order fix', () => {
  const html = read('pages/work-schedule.html');
  assert.match(html, /work-schedule-date-search\.js\?v=8/);
  assert.match(html, /work-schedule-batch-display-scope\.js\?v=3/);
});
