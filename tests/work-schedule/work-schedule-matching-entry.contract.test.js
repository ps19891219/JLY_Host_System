const fs=require('fs'),assert=require('assert');
const page=fs.readFileSync('pages/work-schedule.html','utf8');
const studio=fs.readFileSync('pages/studio-detail.html','utf8');
assert(!page.includes('id="dashboardMatching"'));
assert(!page.includes('work-schedule-matching-entry.js'));
assert(studio.includes('studio-matching.html?studio=kaiwei-private'));
assert(studio.includes('🗓 配合時間／媒合'));
console.log('matching remains upstream of formal Work Schedule');
