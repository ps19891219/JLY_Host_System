const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'js/modules/work-schedule/work-schedule-work-hub.js'),'utf8');
const html=fs.readFileSync(path.join(root,'pages/work-schedule.html'),'utf8');

test('Work-first hub parses and is wired after staff slots',()=>{assert.doesNotThrow(()=>new vm.Script(js));assert.match(html,/work-schedule-staff-slots\.js\?v=4[\s\S]*work-schedule-work-hub\.js\?v=2/)});
test('main workflow starts from Work then Role Pool candidates',()=>{assert.match(js,/先選要排班的劇本/);assert.match(js,/角色配置與可排班人員/);assert.match(js,/eligiblePersonIds/);assert.match(js,/data-role-search/);assert.match(js,/data-add-candidate/)});
test('direct scheduling uses only Work role candidate IDs and no reload',()=>{assert.match(js,/data-quick-person/);assert.match(js,/roleIds\(r\)/);assert.match(js,/staffSlots/);assert.match(js,/assignedPersonIds:ids/);assert.match(js,/rolePoolId:r\.id/);assert.doesNotMatch(js,/location\.reload|window\.location\.reload/)});
test('normal Hub view reads Work View, authoritative Work only when opened',()=>{assert.match(js,/V\.loadWorkIndex\(\)/);assert.match(js,/works\.doc\(id\)\.get\(\)/);assert.doesNotMatch(js,/works\.get\(\)/);assert.match(js,/async function ensurePeople/)});
test('Work Hub has no MutationObserver polling or DOM mutation loop',()=>{assert.doesNotMatch(js,/MutationObserver/);assert.match(js,/jly:work-schedule:rows/)});
test('no duplicate Person or player Seat Engine is introduced',()=>{assert.doesNotMatch(js,/collection\(['"]workActors|collection\(['"]npcMembers|collection\(['"]dmMembers/);assert.doesNotMatch(js,/js\/car\/seat|JLYSeatData|JLYSeatRender|JLYSeatDrag/);assert.match(js,/JLYMemberPickerData\.loadPersonDirectory/)});
