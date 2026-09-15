const fs=require('fs');
const assert=require('assert');
const doc=fs.readFileSync('docs/WORK_SCHEDULE_DM_NPC_FIELDS_20260915.md','utf8');
assert(doc.includes('修改 NPC 不得清除 DM'),'architecture must preserve DM when editing NPC');
assert(doc.includes('修改 DM 不得清除 NPC'),'architecture must preserve NPC when editing DM');
assert(doc.includes('不做任何 Production Firestore 資料回填或重建'),'change must not imply production recovery');
console.log('work-schedule DM/NPC architecture contract: ok');
