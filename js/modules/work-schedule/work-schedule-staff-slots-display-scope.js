(function(){
'use strict';
function sync(scope){
  const rows=scope?.rows;
  if(!Array.isArray(rows))return;
  window.JLYWorkScheduleStaffSlots?.setRows?.(rows);
}
function init(){
  sync(window.JLYWorkScheduleDisplayScope);
  window.addEventListener('jly:work-schedule:display-scope',e=>sync(e.detail));
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
