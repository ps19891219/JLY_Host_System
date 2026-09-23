const fs=require('fs'),assert=require('assert');
const ui=fs.readFileSync('js/modules/studio/studio-operations-task-ui.js','utf8'),page=fs.readFileSync('pages/studio-operations.html','utf8');
assert.doesNotMatch(ui,/firebase\.firestore|\.collection\s*\(|\.where\s*\(|onSnapshot/);
assert.doesNotMatch(page,/\.where\s*\(|onSnapshot/);
assert.match(page,/jly:studio-operation-command/);
assert.match(page,/studioBookingInboxViews/);assert.match(page,/pendingActionStudioViews/);
console.log('studio task ui keeps actions pure and page reads prepared views only');
