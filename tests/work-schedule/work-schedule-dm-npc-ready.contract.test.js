const fs=require('fs');
const assert=require('assert');
const ready=fs.readFileSync('docs/WORK_SCHEDULE_DM_NPC_READY_20260915.txt','utf8');
assert(ready.includes('Not merged'),'readiness marker must not claim merge');
assert(ready.includes('Not deployed'),'readiness marker must not claim deploy');
console.log('work-schedule DM/NPC preview marker: ok');
