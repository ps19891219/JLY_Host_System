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

test('cross-month selection restores original select all, assign, sync, delete and clear actions', () => {
  const source = read('js/modules/work-schedule/work-schedule-batch-display-scope.js');
  for (const id of ['batchSelectAll','batchAssignOpen','batchSync','batchDelete','batchClear']) {
    assert.match(source, new RegExp(`wrapButton\\('${id}'`));
  }
  assert.match(source, /selectedGroups\(\)/);
  assert.match(source, /applyAssignments\(gs,role,personIds,mode\)/);
  assert.match(source, /WorkScheduleShiftDelete\?\.deleteGroups/);
});

test('cross-month assignment conflict checks and cache rebuild use the displayed scope months', () => {
  const source = read('js/modules/work-schedule/work-schedule-batch-display-scope.js');
  assert.match(source, /rows:sourceRows/);
  assert.match(source, /const months=\[\.\.\.new Set\(gs\.map/);
  assert.match(source, /V\?\.rebuildMonth\?\.\(mk\)/);
});

test('work schedule page cache-busts the restored cross-month interaction scripts', () => {
  const html = read('pages/work-schedule.html');
  assert.match(html, /work-schedule-date-search\.js\?v=8/);
  assert.match(html, /work-schedule-batch-display-scope\.js\?v=2/);
});
