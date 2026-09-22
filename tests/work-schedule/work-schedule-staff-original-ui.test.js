const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'pages/work-schedule-staff.html'),'utf8');
const js=fs.readFileSync(path.join(root,'js/modules/work-schedule/work-schedule-staff-page.js'),'utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(html.includes('scheduleDateSearch'),'employee page must keep original schedule search UI');
ok(html.includes('全部班表')&&html.includes('只看我的'),'employee page must keep original view tabs');
ok(html.includes('staffDetailDialog'),'employee cards must have readonly detail dialog');
ok(!html.includes('批次修改')&&!html.includes('＋ 排班'),'employee page must not expose schedule writes');
ok(!html.includes('studio-detail.html'),'employee page must not navigate to Studio admin');
ok(js.includes('data-open-group')&&js.includes('openDetail'),'employee cards must open details');
ok(!js.includes('.update(')&&!js.includes('.set(')&&!js.includes('workShifts'),'employee UI must not write official Work Schedule');\nok(html.includes('staffConfirmActions'),'employee detail must expose assignment confirmation surface');\nok(js.includes('/api/work-schedule-staff-confirmation'),'employee confirmation must go through authenticated server boundary');
console.log('work-schedule staff original UI readonly guard: ok');
ok(js.includes('g.mineRows.filter(r=>r.assignmentConfirmationRequired===true)'),'employee confirmation must handle every own role shift requiring confirmation');
ok(js.includes('Promise.all(targetRows.map'),'employee detail must load confirmation state per role shift');

assert(js.includes('formalMineRows'),'employee Calendar must distinguish formal shifts from tentative assignments');
assert(js.includes('待確認班次尚未進入正式班表'),'tentative assignments must not sync to Google Calendar');
assert(js.includes('await load()'),'confirmation action must reload prepared staff context after mutation');
