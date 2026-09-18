(function(){
'use strict';
if(window.__JLYWorkScheduleMatchingEntryInitialized)return;
window.__JLYWorkScheduleMatchingEntryInitialized=true;
const $=id=>document.getElementById(id);
function currentWorkId(){
 const hub=window.JLYWorkScheduleWorkHub;
 return String(hub?.getActiveWorkId?.()||new URLSearchParams(location.search).get('work')||'').trim();
}
function openMatching(){
 const workId=currentWorkId();
 if(!workId){
  alert('請先選擇要安排的工作／劇本，再建立配合時間。');
  return;
 }
 location.href='/pages/matching.html?work='+encodeURIComponent(workId)+'&source=work-schedule';
}
function bind(){const b=$('dashboardMatching');if(b)b.onclick=openMatching}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',bind):bind();
window.JLYWorkScheduleMatchingEntry={open:openMatching};
})();