const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('js/matching/matching-public-vote.js', 'utf8');
assert(source.includes('const checked = s => existing ? selected.has(s.id) : mode==="exclude";'), 'exclude mode should start fully checked for a new response');
assert(source.includes('c.checked=mode==="exclude"'), 'switching to exclude should select all; switching to available should clear all');
assert(source.includes('const slotIds=checked;'), 'checked slots must always be stored as available slots');
assert(!source.includes('all.filter(id=>!checked.includes(id))'), 'submit must never invert checked slots');
console.log('matching-public-vote-exclude-mode.test.js passed');
