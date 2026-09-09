const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const js=fs.readFileSync('js/car/car-view-actions.js','utf8');
const page=fs.readFileSync('pages/car-view.html','utf8');

test('LINE group player entry still offers normal join when no existing roster name can be claimed',()=>{
  assert.match(js,/if\(!people\.length\)/);
  assert.match(js,/🎮 我要報名/);
  assert.match(js,/targetPlayerId:\"\"/);
  assert.match(js,/新的玩家報名/);
});

test('existing roster identity claim remains available when claimable people exist',()=>{
  assert.match(js,/rosterSelect\(host,\"玩家身分選擇\"/);
  assert.match(js,/targetPlayerId:select\.value/);
});

test('player join fallback does not add or auto-merge a Person in the client',()=>{
  assert.doesNotMatch(js,/collection\(["']players["']\)\.add/);
  assert.doesNotMatch(js,/findDuplicateMember/);
});

test('car view cache version is bumped',()=>{
  assert.match(page,/car-view-actions\.js\?v=5/);
});
