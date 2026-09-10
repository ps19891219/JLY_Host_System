const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'js/modules/work-schedule/work-schedule-staff-slots.js'),'utf8');
const html=fs.readFileSync(path.join(root,'pages/work-schedule.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/pages/work-schedule-staff-slots.css'),'utf8');

test('staff-slot module parses and is wired after View-first dashboard',()=>{assert.doesNotThrow(()=>new vm.Script(js));assert.match(html,/work-schedule-dashboard\.js\?v=5[\s\S]*work-schedule-staff-slots\.js\?v=4/);assert.match(html,/id="bulkBoardOpen"[^>]*>批次修改</)});
test('staff slots preserve canonical Person IDs without importing Seat Engine',()=>{for(const term of ['staffSlots','assignedPersonIds','personIds','eligiblePersonIds','loadPersonDirectory'])assert.match(js,new RegExp(term));assert.doesNotMatch(js,/js\/car\/seat|JLYSeatData|JLYSeatRender|JLYSeatDrag/)});
test('detail is single-day editing and can add a main role',()=>{assert.match(js,/staffAddRole/);assert.match(js,/新增主要角色/);assert.match(js,/createRoleForShift/);assert.match(js,/這裡只修改這一天/)});
test('slot labels, person selection, add-remove and drag remain',()=>{for(const term of ['data-slot-label','data-pick-person','data-add-slot','data-remove-slot','ondragstart','ondrop','onpointerdown','onpointermove'])assert.match(js,new RegExp(term));assert.match(css,/staff-slot-handle[^}]*touch-action:none/)});
test('staff editor consumes dashboard rows instead of re-querying month',()=>{assert.match(js,/JLYWorkScheduleDashboard\?\.getRows/);assert.match(js,/jly:work-schedule:rows/);assert.doesNotMatch(js,/shifts\.where\(['"]monthKey/);assert.doesNotMatch(js,/MutationObserver/)});
test('Person Directory is lazy and picker is role-pool restricted',()=>{assert.match(js,/async function ensurePeople/);assert.match(js,/eligiblePeople\(item\)/);assert.match(js,/eligiblePersonIds/)});
test('writes rebuild only affected month View',()=>{assert.match(js,/V\.rebuildMonth\(monthKey\)/);assert.match(js,/refreshAfterWrite/)});
test('batch editing lives on dashboard and changes duty or Person',()=>{for(const term of ['openDashboardBatch','staffBatchDates','staffBatchLabelEnabled','staffBatchPersonEnabled','staffBatchCreateMissing','applyBatch'])assert.match(js,new RegExp(term));assert.doesNotMatch(js,/staffBatchSetDefault/)});
