const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'js/modules/work-schedule/work-schedule-shift-delete.js'),'utf8');
const html=fs.readFileSync(path.join(root,'pages/work-schedule.html'),'utf8');

test('shift delete module parses and is wired to detail',()=>{assert.doesNotThrow(()=>new vm.Script(js));assert.match(html,/id="groupDetailDelete"[^>]*>🗑 刪除這場排班/);assert.match(html,/work-schedule-shift-delete\.js\?v=1/)});
test('delete removes Google event before deleting Shift rows',()=>{const removeAt=js.indexOf('removeCalendar(row)'),batchAt=js.indexOf('batch.delete(shifts.doc(row.id))');assert.ok(removeAt>0);assert.ok(batchAt>removeAt);assert.match(js,/JLYWorkScheduleGoogle\.remove\(row\)/);assert.match(js,/requestAccessToken/)});
test('calendar delete failure preserves Shift data and reports failure',()=>{assert.match(js,/Google Calendar 刪除失敗，排班資料尚未刪除/);assert.match(js,/clearCalendarMapping/);assert.match(js,/syncStatus:'deleted'/)});
test('successful delete rebuilds affected month View without page reload',()=>{assert.match(js,/V\?\.rebuildMonth\?\./);assert.match(js,/reloadMonth\?\./);assert.doesNotMatch(js,/location\.reload/)});
