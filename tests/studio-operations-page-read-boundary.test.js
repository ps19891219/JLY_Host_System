const fs=require('fs'),assert=require('assert');const page=fs.readFileSync('pages/studio-operations.html','utf8'),vm=fs.readFileSync('js/modules/studio/studio-operations-view-model.js','utf8');
assert.doesNotMatch(vm,/firebase\.firestore|\.collection\s*\(|onSnapshot|\.where\s*\(/);
assert.doesNotMatch(page,/onSnapshot|\.where\s*\(/);
const collections=[...page.matchAll(/\.collection\(['"]([^'"]+)['"]\)/g)].map(x=>x[1]);
assert.deepEqual(collections.sort(),['pendingActionStudioViews','studioBookingInboxViews']);
assert.match(page,/Promise\.all/);assert.match(page,/JLYStudioOperationsPage/);
console.log('studio operations page bounded prepared-view reads ok');
