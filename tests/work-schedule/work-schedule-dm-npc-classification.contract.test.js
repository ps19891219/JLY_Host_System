const fs=require('fs');
const assert=require('assert');
const mod=fs.readFileSync('js/modules/work-schedule/work-schedule-dm-npc-sections.js','utf8');
assert(mod.includes("n==='dm'||n.includes('主持')"),'DM aliases must classify as DM');
assert(mod.includes("n==='npc'||n.includes('npc')"),'NPC aliases must classify as NPC');
assert(mod.includes("const order={dm:0,npc:1,other:2}"),'display order must keep DM before NPC before other staff');
console.log('work-schedule DM/NPC classification contract: ok');
