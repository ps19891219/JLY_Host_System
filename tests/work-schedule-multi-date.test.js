const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'js/modules/work-schedule/work-schedule-multi-date.js'),'utf8');
const html=fs.readFileSync(path.join(root,'pages/work-schedule.html'),'utf8');

test('multi-date module parses and loads after Work Hub',()=>{assert.doesNotThrow(()=>new vm.Script(js));assert.match(html,/work-schedule-work-hub\.js\?v=2[\s\S]*work-schedule-multi-date\.js\?v=1/)});
test('one scheduling action accepts many dates and writes only Shift rows',()=>{assert.match(js,/parseDates/);assert.match(js,/可一次貼多天/);assert.match(js,/for\(const date of dates\)/);assert.match(js,/shifts\.doc\(\)/);assert.doesNotMatch(js,/works\.doc\([^)]*\)\.set/)});
test('same work date time role is treated as a conflict instead of silently duplicating role',()=>{assert.match(js,/rowMatches/);assert.match(js,/row\.workId/);assert.match(js,/row\.date===date/);assert.match(js,/rolePoolId/);assert.match(js,/已有人員排班|已有排班/);assert.match(js,/加入、R 覆蓋|A 加入、R 覆蓋/)});
test('conflict supports add replace and skip',()=>{for(const term of ["value=\"add\"","value=\"replace\"","value=\"skip\"","mergeIds","action==='replace'"])assert.match(js,new RegExp(term))});
test('multi-date creation keeps canonical Person ids and role pool identity',()=>{for(const term of ['assignedPersonIds','personIds','eligiblePersonIds','rolePoolId','rolePoolsSnapshot'])assert.match(js,new RegExp(term))});
test('writes rebuild only affected month views and avoid reload',()=>{assert.match(js,/V\.rebuildMonth\(mk\)/);assert.match(js,/reloadMonth/);assert.doesNotMatch(js,/location\.reload|MutationObserver/)});
