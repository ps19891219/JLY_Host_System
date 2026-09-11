const fs=require('fs'),assert=require('assert');
const view=fs.readFileSync('js/modules/work-schedule/work-schedule-read-view.js','utf8');
const page=fs.readFileSync('pages/work-schedule.html','utf8');
assert(view.includes('const WORK_HISTORY_REPAIR_VERSION=2'),'all-history repair must be versioned');
assert(view.includes('repairVersion:WORK_HISTORY_REPAIR_VERSION'),'repair marker must record its version');
assert(view.includes('Number(marker.data()?.repairVersion||0)!==WORK_HISTORY_REPAIR_VERSION'),'stale repair marker must trigger repair again');
assert(view.includes('return sortWorkRows(repaired)'),'first repaired load should render repaired rows directly instead of depending on a possibly stale month index');
assert(page.includes('work-schedule-read-view.js?v=5'),'read-view cache version should be bumped');
console.log('work-schedule-all-history-repair-v2.test.js passed');
