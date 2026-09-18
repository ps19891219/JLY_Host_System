const fs=require('fs'),assert=require('assert');
const studio=fs.readFileSync('pages/studio-detail.html','utf8');
const schedule=fs.readFileSync('pages/work-schedule.html','utf8');
assert(studio.includes('🗓 配合時間／媒合'));
assert(studio.includes("matching.html?studio=kaiwei-private&source=studio"));
assert(studio.includes('📅 正式排班表'));
assert(!schedule.includes('id="dashboardMatching"'));
assert(!schedule.includes('work-schedule-matching-entry.js'));
console.log('studio matching is upstream of formal schedule');
