const fs=require('fs');
const test=require('node:test');
const assert=require('node:assert/strict');
const page=fs.readFileSync('pages/work-schedule.html','utf8');
const firebase=fs.readFileSync('firebase/firebase.js','utf8');

test('Work Schedule loads firebase asset version carrying REST fallback',()=>{
  assert.match(firebase,/Work Schedule 專用唯讀 fallback/);
  assert.match(firebase,/documents:runQuery/);
  assert.match(page,/\/firebase\/firebase\.js\?v=27/);
});
