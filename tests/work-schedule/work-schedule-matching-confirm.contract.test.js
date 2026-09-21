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

const confirmApi=fs.readFileSync('api/work-schedule-staff-confirmation.js','utf8');
assert(confirmApi.includes('tentativePersonIds'));
assert(confirmApi.includes('nextAssigned.add(personId)'));
assert(confirmApi.includes('nextTentative.delete(personId)'));
assert(confirmApi.includes('assignmentConfirmationByPerson'));
assert(confirmApi.includes('formal:current.status==="confirmed"'));

const dashboard=fs.readFileSync('js/modules/work-schedule/work-schedule-dashboard.js','utf8');
assert(dashboard.includes('assignmentConfirmationByPerson'));
assert(dashboard.includes('待確認 '));
assert(dashboard.includes('已確認 '));
assert(dashboard.includes('已婉拒 '));
assert(dashboard.includes('需重確認 '));

assert(lifecycle.includes("states[id]==='confirmed'"));
assert(lifecycle.includes("nextStates[id]='invalidated'"));
assert(lifecycle.includes('tentativePersonIds:nextTentative'));
assert(lifecycle.includes('assignedPersonIds:nextAssigned'));

const confirmationApi=fs.readFileSync('api/work-schedule-staff-confirmation.js','utf8');
assert(confirmationApi.includes('domain.invalidateIfChanged(a.doc.data(),shift)'),'POST must invalidate stale persisted confirmation before reconfirming');

assert(confirmationApi.includes('current.status===domain.STATUS.INVALIDATED'),'decline must handle invalidated assignments');
assert(confirmationApi.includes('domain.reopen(current,shift)'),'invalidated assignment must reopen against current shift before action');
assert(lifecycle.includes('after?.assignedPersonIds??after?.personIds??before?.assignedPersonIds'),'partial lifecycle payload must preserve formal assignments');
assert(lifecycle.includes('Array.isArray(after?.staffSlots)?after.staffSlots'),'partial lifecycle payload must preserve staff slots');

assert(composer.includes('sessionHosts={};matchingSource=null;matchingAllowedPersonIds=null;'),'normal composer open must clear stale matching state');
assert(composer.includes("assignmentConfirmationByPerson:matchingSource?Object.fromEntries(ids.map(id=>[String(id),'tentative'])):{}"),'matching draft must initialize per-person tentative confirmation state');
