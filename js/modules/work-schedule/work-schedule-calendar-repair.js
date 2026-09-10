(function(){
'use strict';
if(window.__JLYWorkScheduleCalendarRepairInitialized)return;window.__JLYWorkScheduleCalendarRepairInitialized=true;
const db=window.db||firebase.firestore(),shifts=db.collection('workShifts'),V=window.JLYWorkScheduleReadView,$=id=>document.getElementById(id);
let rows=[];
function needsRepair(row){const c=row?.calendar||{};return Boolean(c.syncEnabled&&(c.syncStatus==='failed'||!c.eventId||c.lastError))}
function targets(){return rows.filter(r=>r&&r.status!=='cancelled'&&needsRepair(r))}
function render(){const b=$('calendarRepair');if(!b)return;const n=targets().length;b.textContent=n?`補登 Google（${n}）`:'補登 Google';b.disabled=!n;b.title=n?'只重試尚未成功或同步失敗的班表，不會重建已成功的 Google Event。':'目前沒有需要補登的班表。'}
async function preauthorize(){if(!window.JLYCalendarAuth)throw new Error('Google Calendar 授權模組尚未載入');await window.JLYCalendarAuth.requestAccessToken()}
async function repair(){const list=targets();if(!list.length)return alert('目前沒有需要補登的 Google 行事曆。');try{await preauthorize()}catch(e){return alert(`Google 授權失敗：${e.message||e}`)}const b=$('calendarRepair');if(b)b.disabled=true;let ok=0;const fail=[];for(const row of list){const ref=shifts.doc(row.id);try{await window.JLYWorkScheduleGoogle.sync(ref,row,!row.calendar?.eventId);ok++}catch(e){fail.push(`${row.date||''} ${row.workName||''} ${row.roleName||''}：${e.message||e}`)}}const months=[...new Set(list.map(r=>r.monthKey||String(r.date||'').slice(0,7)).filter(Boolean))];for(const mk of months)try{await V?.rebuildMonth?.(mk)}catch(_){}await window.JLYWorkScheduleDashboard?.reload?.();render();alert(fail.length?`補登完成 ${ok} 筆，仍失敗 ${fail.length} 筆。\n${fail.slice(0,5).join('\n')}`:`已補登 ${ok} 筆 Google Calendar。`)}
function init(){const b=$('calendarRepair');if(b)b.onclick=()=>repair().catch(e=>alert(`補登失敗：${e.message||e}`));rows=window.JLYWorkScheduleDashboard?.getRows?.()||[];render();window.addEventListener('jly:work-schedule:rows',e=>{rows=Array.isArray(e.detail?.rows)?e.detail.rows:[];render()})}
window.JLYWorkScheduleCalendarRepair={needsRepair,repair,getPendingCount:()=>targets().length};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();