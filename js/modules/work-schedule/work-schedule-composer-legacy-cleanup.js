(function(){
'use strict';
if(window.__JLYWorkScheduleComposerLegacyCleanupInitialized)return;
window.__JLYWorkScheduleComposerLegacyCleanupInitialized=true;

function removeLegacyOuterHost(){
  const input=document.getElementById('workSessionHost');
  if(!input)return false;
  const label=input.closest('label');
  if(label)label.remove();
  else input.remove();
  return true;
}

removeLegacyOuterHost();
document.addEventListener('click',event=>{
  if(!event.target.closest?.('#dashboardCreate,#workWorkspaceSchedule'))return;
  queueMicrotask(removeLegacyOuterHost);
  setTimeout(removeLegacyOuterHost,0);
},true);

window.addEventListener('pageshow',removeLegacyOuterHost);
window.JLYWorkScheduleComposerLegacyCleanup={removeLegacyOuterHost};
})();
