(function(){
'use strict';
if(window.__JLYWorkScheduleMobileTimeGuardInitialized)return;
window.__JLYWorkScheduleMobileTimeGuardInitialized=true;

function syncVisibleTimeInputs(){
  const form=document.getElementById('workSessionComposerForm');
  if(!form)return;
  form.querySelectorAll('input[data-time-start],input[data-time-end]').forEach(input=>{
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
}

/*
 * Mobile browsers can keep the visible value of <input type="time"> ahead of
 * the composer's internal timeSlots state until blur/change fires. Run in the
 * capture phase so the real visible values are committed before the existing
 * composer submit handler builds Firestore payloads. This does not rewrite old
 * shifts or change duration rules; it only prevents a newly entered time from
 * being saved as the previous value.
 */
document.addEventListener('submit',event=>{
  if(event.target?.id!=='workSessionComposerForm')return;
  syncVisibleTimeInputs();
},true);

window.JLYWorkScheduleMobileTimeGuard={syncVisibleTimeInputs};
})();
