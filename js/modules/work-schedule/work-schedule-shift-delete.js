(function(){
'use strict';
if(window.__JLYWorkScheduleShiftDeleteInitialized)return;
window.__JLYWorkScheduleShiftDeleteInitialized=true;
const db=window.db||firebase.firestore(),shifts=db.collection('workShifts'),V=window.JLYWorkScheduleReadView,$=id=>document.getElementById(id);
let activeGroupKey='';
function groupKey(r){return[r.date,r.workId||r.workName,r.startTime,r.endTime,r.studioName||''].join('|')}
function groupRows(){return(window.JLYWorkScheduleDashboard?.getRows?.()||[]).filter(r=>groupKey(r)===activeGroupKey&&r.id)}
function monthOf(rows){return rows[0]?.monthKey||rows[0]?.date?.slice(0,7)||window.JLYWorkScheduleDashboard?.getMonthKey?.()||''}
function goneError(e){return/404|not found|already deleted|resource has been deleted/i.test(String(e?.message||e||''))}
async function authorizeCalendar(){if(!window.JLYCalendarAuth)throw new Error('Google Calendar 授權模組尚未載入');await window.JLYCalendarAuth.requestAccessToken()}
async function clearCalendarMapping(row){const calendar={...(row.calendar||{}),eventId:'',eventUrl:'',syncStatus:'deleted',lastSyncAt:new Date().toISOString(),lastError:''};await shifts.doc(row.id).update({calendar,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});row.calendar=calendar}
async function removeCalendar(row){if(!row.calendar?.eventId)return;try{await window.JLYWorkScheduleGoogle.remove(row)}catch(e){if(!goneError(e))throw e}await clearCalendarMapping(row)}
async function deleteActiveGroup(){const rows=groupRows();if(!rows.length)return alert('找不到這場排班，請關閉後重新開啟。');const first=rows[0],hasCalendar=rows.some(r=>r.calendar?.eventId),label=`${first.date||''} ${first.workName||'這場排班'}`;if(!confirm(`確定刪除 ${label}？${hasCalendar?'\n已同步的 Google Calendar 行程也會一起刪除。':''}\n此操作無法復原。`))return;const button=$('groupDetailDelete');if(button){button.disabled=true;button.textContent='刪除中…'}try{if(hasCalendar)await authorizeCalendar();for(const row of rows){if(!row.calendar?.eventId)continue;try{await removeCalendar(row)}catch(e){await V?.rebuildMonth?.(monthOf(rows));await window.JLYWorkScheduleDashboard?.reload?.();alert(`Google Calendar 刪除失敗，排班資料尚未刪除。\n${e.message||e}`);return}}const batch=db.batch();rows.forEach(row=>batch.delete(shifts.doc(row.id)));await batch.commit();const monthKey=monthOf(rows);if(monthKey)await V?.rebuildMonth?.(monthKey);$('groupDetailDialog')?.close();activeGroupKey='';await window.JLYWorkScheduleDashboard?.reloadMonth?.(monthKey);alert('這場排班與已同步的 Google Calendar 行程已刪除。')}catch(e){alert(`刪除排班失敗：${e.message||e}`)}finally{if(button){button.disabled=false;button.textContent='🗑 刪除這場排班'}}}
function rememberGroup(e){const open=e.target.closest?.('[data-open-group]');if(open?.dataset?.openGroup){activeGroupKey=open.dataset.openGroup;return}const card=e.target.closest?.('.work-day-card[data-group]');if(card?.dataset?.group)activeGroupKey=card.dataset.group}
function init(){document.addEventListener('click',rememberGroup,true);$('groupDetailDelete')?.addEventListener('click',deleteActiveGroup)}
window.JLYWorkScheduleShiftDelete={deleteActiveGroup,getActiveGroupKey:()=>activeGroupKey};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
