const fs=require('fs'),assert=require('assert');
const inbox=fs.readFileSync('js/data-view/studio-operations-inbox.js','utf8');
const ops=fs.readFileSync('js/modules/studio/studio-operations.js','utf8');
assert.doesNotMatch(inbox,/collection\s*\(|\.get\s*\(|onSnapshot/);
assert.doesNotMatch(ops,/collection\s*\(|\.get\s*\(|onSnapshot/);
assert.match(ops,/notification\.line\.proactive/);
console.log('studio operations read boundary ok');
