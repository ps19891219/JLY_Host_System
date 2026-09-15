const fs=require('fs');
const assert=require('assert');
const mod=fs.readFileSync('js/modules/work-schedule/work-schedule-dm-npc-sections.js','utf8');
for(const token of ['firebase.firestore','db.collection','batch.commit','batch.update','batch.set'])assert(!mod.includes(token),`presentation guard must not perform Firestore writes: ${token}`);
console.log('work-schedule DM/NPC read-only presentation contract: ok');
