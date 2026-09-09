const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('dashboard source parses before browser execution',()=>{
  const source=fs.readFileSync('js/modules/work-schedule/work-schedule-dashboard.js','utf8');
  assert.doesNotThrow(()=>new vm.Script(source,{filename:'work-schedule-dashboard.js'}));
  assert.doesNotMatch(source,/if\(!g\)return,dlg=/);
});
