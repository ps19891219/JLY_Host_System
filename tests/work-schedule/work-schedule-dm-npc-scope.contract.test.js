const fs=require('fs');
const assert=require('assert');
const scope=fs.readFileSync('docs/WORK_SCHEDULE_DM_NPC_SCOPE_20260915.txt','utf8');
assert(scope.includes('MyCar #147'),'scope must explicitly exclude MyCar');
assert(scope.includes('Production Firestore recovery'),'scope must explicitly exclude production recovery');
console.log('work-schedule DM/NPC scope contract: ok');
