// Run: node tests/play-history-core.test.js
'use strict';
const assert=require('node:assert/strict');
const core=require('../js/data-view/play-history-core.js');
const base={id:'r123456789',name:'重刷劇本',date:'2026-10-21',roster:['阿華','小明'],candidates:{阿華:'person12345'}};
const view=core.buildReadView('player12345',[base,{...base,id:'r987654321'}],1);
assert.equal(view.total,2,'同劇本兩場不得合併');
assert.equal(core.validateReadView(view,'player12345'),true);
assert.equal(core.validateReadView(view,'otherPlayer'),false);
assert.equal(view.sessions[0].attendance,'unverified','排定時間已過不代表出席');
assert.throws(()=>core.buildReadView('player12345',[base,base],2),/重複/);
assert.throws(()=>core.prepareSession({...base,candidates:{陌生人:'person12345'}}),/不一致/);
assert.throws(()=>core.prepareSession({...base,date:'2026-02-30',rawDate:'2026-02-30',roster:['阿華',...Array(101).fill('其他')]}),/數量/);
assert.equal(core.date('2026-02-30'),'');
console.log('Play-history core: 8 checks passed');
