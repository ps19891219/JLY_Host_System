const fs = require('fs');
const assert = require('assert');

const studio = fs.readFileSync('pages/studio.html', 'utf8');
const detail = fs.readFileSync('pages/studio-detail.html', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert(studio.includes('我的工作室'));
assert(studio.includes('凱崴私團'));
assert(studio.includes('＋ 新增工作室'));
assert(studio.includes('studio-detail.html?studio=kaiwei-private'));
assert(detail.includes('凱崴私團'));
assert(detail.includes('work-schedule.html?studio=kaiwei-private'));
assert(detail.includes('🎭 劇本'));
assert(detail.includes('＋ 新增劇本'));
assert(index.includes("pages/studio.html"));
assert(!index.includes("pages/work-schedule.html"));

console.log('work-schedule studio hierarchy regression passed');
