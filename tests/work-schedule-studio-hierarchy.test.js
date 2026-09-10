const fs = require('fs');
const assert = require('assert');

const studio = fs.readFileSync('pages/studio.html', 'utf8');
const detail = fs.readFileSync('pages/studio-detail.html', 'utf8');
const scripts = fs.readFileSync('pages/studio-scripts.html', 'utf8');
const schedule = fs.readFileSync('pages/work-schedule.html', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert(studio.includes('我的工作室'));
assert(studio.includes('凱崴私團'));
assert(studio.includes('＋ 新增工作室'));
assert(studio.includes('studio-detail.html?studio=kaiwei-private'));

assert(detail.includes('凱崴私團'));
assert(detail.includes('work-schedule.html?studio=kaiwei-private'));
assert(detail.includes('studio-scripts.html?studio=kaiwei-private'));
assert(!detail.includes('work-schedule.html?studio=kaiwei-private&view=works'));
assert(!detail.includes('返回工作室列表'));

assert(scripts.includes('劇本管理'));
assert(scripts.includes('工作室上架與維護的劇本資料'));
assert(scripts.includes('Script Master'));
assert(scripts.includes('studio-detail.html?studio=kaiwei-private'));
assert(!scripts.includes('work-schedule.html?studio=kaiwei-private&view=works'));

assert(schedule.includes('studio-detail.html?studio=kaiwei-private'));
assert(schedule.includes('返回凱崴私團'));
assert(!schedule.includes('返回工作室管理'));

assert(index.includes("pages/studio.html"));
assert(!index.includes("pages/work-schedule.html"));

console.log('work-schedule studio hierarchy regression passed');
