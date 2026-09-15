const fs=require('fs');
const assert=require('assert');
const page=fs.readFileSync('pages/work-schedule.html','utf8');
const staff=page.indexOf('/js/modules/work-schedule/work-schedule-staff-slots.js?v=7');
const guard=page.indexOf('/js/modules/work-schedule/work-schedule-dm-npc-sections.js?v=1');
assert(staff>=0&&guard>staff,'DM/NPC guard must load after staff-slot runtime');
console.log('work-schedule DM/NPC page load contract: ok');
