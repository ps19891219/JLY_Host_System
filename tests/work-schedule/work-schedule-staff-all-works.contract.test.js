const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const api=fs.readFileSync(path.join(root,'api/work-schedule-staff-context.js'),'utf8');
const page=fs.readFileSync(path.join(root,'js/modules/work-schedule/work-schedule-staff-page.js'),'utf8');
const renderer=fs.readFileSync(path.join(root,'js/modules/work-schedule/work-schedule-read-renderer.js'),'utf8');
function ok(v,m){if(!v)throw new Error(m)}

// Employee entry is studio-scoped, but it must consume every monthly Read View row
// for that studio instead of being tied to one work/script.
ok(api.includes('loadReadViewRows(db)'),'staff context must load the shared Work Schedule Read View');
ok(api.includes('snapshotRows.filter(row=>studioMatches(row,studio))'),'staff context must filter by studio, not by one work/script');
ok(!api.includes('req.query&&req.query.workId')&&!api.includes('req.query&&req.query.workName'),'employee entry must not require a work/script query parameter');

// Distinct works remain distinct schedule groups and can coexist in the same list.
ok(renderer.includes('r.workId||r.workName'),'group identity must include workId/workName');
ok(renderer.includes('a.date+a.startTime+a.workName'),'groups must keep chronological ordering across works');

// All/My are filters over the same complete studio result set; search includes work name.
ok(page.includes("view='all'"),'employee schedule must default to the all-work view');
ok(page.includes("if(view==='mine')gs=gs.filter(g=>g.isMine)"),'My view must filter the complete grouped schedule');
ok(page.includes('r.workName,r.hostName,r.studioName,r.date,r.monthKey'),'search must include work/script name');
ok(!page.includes('selectedWorkId')&&!page.includes('selectedWorkName'),'employee UI must not introduce a script-picker state');

console.log('work-schedule staff all-work studio contract: ok');
