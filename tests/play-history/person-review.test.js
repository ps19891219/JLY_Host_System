// Run: node tests/play-history-person-review.test.js
'use strict';
const assert=require('node:assert/strict');
const {reviewCandidates,confirmMatch}=require('../../js/data-view/play-history-person-review.js');
const args={roster:['小明','阿華'],candidates:{小明:'person12345'}};
let review=reviewCandidates(args);
assert.equal(review.length,1);
assert.equal(review[0].verified,false);
review=reviewCandidates({...args,verifiedPeople:{person12345:{id:'person12345'}}});
assert.equal(review[0].status,'candidate-found');
assert.equal(review[0].verified,false,'查到 Person 不等於完成認領');
assert.throws(()=>confirmMatch({nickname:'小明',personId:'person12345',roster:args.roster}),/缺少/);
assert.throws(()=>confirmMatch({nickname:'小明',personId:'person12345',roster:args.roster,proof:{ownerApproved:true,identityVerified:false,personId:'person12345',nickname:'小明'}}),/缺少/);
const result=confirmMatch({nickname:'小明',personId:'person12345',roster:args.roster,proof:{ownerApproved:true,identityVerified:true,personId:'person12345',nickname:'小明',proofRef:'verified-session'}});
assert.equal(result.verified,true);
assert.throws(()=>reviewCandidates({...args,candidates:{陌生人:'person12345'}}),/不符合/);
console.log('Play-history Person review: 7 checks passed');
