'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','js','modules','work-schedule','work-schedule-mobile-time-guard.js'),'utf8');

test('Work Schedule mobile time guard runs before composer submit handler',()=>{
  assert.match(source,/document\.addEventListener\('submit',[\s\S]*,true\);/);
  assert.match(source,/workSessionComposerForm/);
});

test('Work Schedule mobile time guard flushes both visible start and end inputs',()=>{
  assert.match(source,/input\[data-time-start\],input\[data-time-end\]/);
  assert.match(source,/dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/);
});
