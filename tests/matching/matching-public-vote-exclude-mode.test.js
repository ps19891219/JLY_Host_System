const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('js/matching/matching-public-vote.js', 'utf8');
assert(source.includes('const checked = s => selected.has(s.id);'));
assert(source.includes('const slotIds=checked;'));
assert(!source.includes('all.filter(id=>!checked.includes(id))'));
assert(!source.includes('c.checked=!c.checked'));
console.log('matching-public-vote-exclude-mode.test.js passed');
