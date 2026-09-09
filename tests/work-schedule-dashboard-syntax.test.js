const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('Work Schedule dashboard parses as JavaScript',()=>{
  const source=fs.readFileSync('js/modules/work-schedule/work-schedule-dashboard.js','utf8');
  assert.doesNotThrow(()=>new vm.Script(source));
});
