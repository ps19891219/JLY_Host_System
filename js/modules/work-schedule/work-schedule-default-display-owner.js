(function(){
'use strict';
if(window.__JLYWorkScheduleDefaultDisplayOwnerInitialized)return;
window.__JLYWorkScheduleDefaultDisplayOwnerInitialized=true;

const $=id=>document.getElementById(id);

function shouldRestoreDefaultHistory(){
  const input=$('scheduleDateQuery');
  if(!input||String(input.value||'').trim())return false;
  const mine=document.querySelector('[data-dashboard-view="mine"]');
  if(mine&&mine.classList.contains('active'))return false;
  return true;
}

function restoreDefaultHistory(){
  if(!shouldRestoreDefaultHistory())return;
  const clear=$('scheduleDateClear');
  if(clear)clear.click();
}

/*
 * The legacy month dashboard and the all-history date/search view both render
 * into #scheduleDashboard. Their initial async reads can finish in either
 * order on mobile. Whenever the month dashboard finishes while the user is
 * still in the default "全部班表" state, hand the surface back to the
 * all-history owner. Search results and "只看我的" intentionally keep their
 * own dashboard rendering.
 */
window.addEventListener('jly:work-schedule:rows',restoreDefaultHistory);

document.addEventListener('DOMContentLoaded',function(){
  setTimeout(restoreDefaultHistory,0);
});
})();
