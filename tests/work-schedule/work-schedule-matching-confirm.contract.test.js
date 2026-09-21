const fs=require('fs'),assert=require('assert');
const bridge=fs.readFileSync('js/modules/work-schedule/work-schedule-matching-bridge.js','utf8');
const composer=fs.readFileSync('js/modules/work-schedule/work-schedule-session-composer.js','utf8');
assert(bridge.includes("responseState"));
assert(bridge.includes("applyToComposer"));
assert(bridge.includes("openMatchingDraft"));
assert(composer.includes("async function openMatchingDraft"));
assert(composer.includes("selectedDates=new Set([draft.date])"));
assert(composer.includes("const allowed=new Set((draft.availablePersonIds||[]).map(String))"));
assert(composer.includes("只有按下「建立全部排班」後才成為正式排班"));
assert(composer.includes("L.findConflicts"));
assert(composer.includes("batch.set(c.ref,data)"));
assert(composer.includes("JLYWorkScheduleSessionComposer={open,openMatchingDraft}"));
console.log('matching confirm to formal schedule contract ok');

const policy=fs.readFileSync('js/modules/work-schedule/work-schedule-change-policy.js','utf8'),lifecycle=fs.readFileSync('js/modules/work-schedule/work-schedule-lifecycle.js','utf8');
assert(policy.includes('confirmationInvalidated'));
assert(lifecycle.includes("assignmentConfirmationStatus:'invalidated'"));
