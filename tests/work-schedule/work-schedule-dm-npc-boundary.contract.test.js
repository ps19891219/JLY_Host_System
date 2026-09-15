const fs=require('fs');
const assert=require('assert');
const dashboard=fs.readFileSync('js/modules/work-schedule/work-schedule-dashboard.js','utf8');
const slots=fs.readFileSync('js/modules/work-schedule/work-schedule-staff-slots.js','utf8');
assert(dashboard.includes("g.rows.find(r=>String(r.rolePoolId)===String(role.id)||txt(r.roleName)===txt(role.name))"),'dashboard batch assignment must target one role row');
assert(slots.includes('batch.update(ref,payload)'),'staff-slot writes must target the selected shift role document');
assert(slots.includes('staffBatchRole'),'batch field editor must require an explicit role');
assert(slots.includes('staffBatchSlot'),'batch field editor must require an explicit slot');
console.log('work-schedule DM/NPC sibling boundary contract: ok');
