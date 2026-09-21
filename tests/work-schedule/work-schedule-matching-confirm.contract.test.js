const fs=require('fs'),assert=require('assert');
const bridge=fs.readFileSync('js/modules/work-schedule/work-schedule-matching-bridge.js','utf8');
const composer=fs.readFileSync('js/modules/work-schedule/work-schedule-session-composer.js','utf8');
assert(bridge.includes("responseState"));
assert(bridge.includes("applyToComposer"));
assert(bridge.includes("openMatchingDraft"));
assert(composer.includes("async function openMatchingDraft"));
assert(composer.includes("selectedDates=new Set([draft.date])"));
assert(composer.includes("const allowed=new Set((draft.availablePersonIds||[]).map(String))"));
assert(composer.includes("員工確認後才進入正式班表"));
assert(composer.includes("L.findConflicts"));
assert(composer.includes("batch.set(c.ref,data)"));\nassert(composer.includes("const formalIds=matchingSource?[]:ids"));\nassert(composer.includes("tentativePersonIds:matchingSource?ids:[]"));\nassert(composer.includes("assignedPersonIds:formalIds"));
assert(composer.includes("JLYWorkScheduleSessionComposer={open,openMatchingDraft}"));
console.log('matching tentative assignment boundary contract ok');

const policy=fs.readFileSync('js/modules/work-schedule/work-schedule-change-policy.js','utf8'),lifecycle=fs.readFileSync('js/modules/work-schedule/work-schedule-lifecycle.js','utf8');
assert(policy.includes('confirmationInvalidated'));
assert(lifecycle.includes("assignmentConfirmationStatus:'invalidated'"));
