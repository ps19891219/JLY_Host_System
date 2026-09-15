(function(){
'use strict';
function install(){
  const api=window.JLYWorkScheduleStaffSlots;
  if(!api?.openDetail||api.__displayScopeOpenDetailPatched)return;
  const original=api.openDetail.bind(api);
  api.openDetail=async function(key){
    const visible=window.JLYWorkScheduleDisplayScope?.rows;
    if(Array.isArray(visible))api.setRows?.(visible);
    return original(key);
  };
  api.__displayScopeOpenDetailPatched=true;
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();