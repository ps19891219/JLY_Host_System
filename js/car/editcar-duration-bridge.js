(function(){
'use strict';
if(window.__JLYEditCarDurationBridge)return;
window.__JLYEditCarDurationBridge=true;

const text=v=>String(v??'').trim();
function durationFromTimes(start,end){
  if(!start||!end)return 60;
  const [sh,sm]=start.split(':').map(Number);
  const [eh,em]=end.split(':').map(Number);
  if(![sh,sm,eh,em].every(Number.isFinite))return 60;
  let minutes=(eh*60+em)-(sh*60+sm);
  if(minutes<=0)minutes+=24*60;
  return minutes||60;
}
function endFromDuration(start,minutes){
  if(!start||!(Number(minutes)>60))return'';
  const [h,m]=start.split(':').map(Number);
  const total=(h*60+m+Number(minutes))%(24*60);
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
function currentDuration(){
  const start=document.getElementById('gameTime')?.value||'';
  const end=document.getElementById('gameEndTime')?.value||'';
  return durationFromTimes(start,end);
}
function updateHint(){
  const hint=document.getElementById('editGameEndTimeHint');
  if(!hint)return;
  const end=document.getElementById('gameEndTime')?.value||'';
  const minutes=currentDuration();
  if(!end){hint.textContent='未填結束時間時預設 1 小時。';return}
  const hours=Math.floor(minutes/60),rest=minutes%60;
  hint.textContent=`目前時長：${hours?hours+' 小時':''}${rest?' '+rest+' 分鐘':''}。結束早於開始會視為隔日。`;
}

const originalRender=window.renderEditForm||renderEditForm;
function bridgedRender(car){
  originalRender(car);
  const start=document.getElementById('gameTime');
  if(!start||document.getElementById('gameEndTime'))return;
  const saved=Number(car?.eventDurationMinutes||car?.calendar?.eventDurationMinutes||60)||60;
  const label=document.createElement('label');
  label.htmlFor='gameEndTime';
  label.textContent='結束時間';
  const input=document.createElement('input');
  input.id='gameEndTime';
  input.type='time';
  input.value=endFromDuration(start.value,saved);
  const hint=document.createElement('small');
  hint.id='editGameEndTimeHint';
  hint.style.display='block';
  hint.style.marginBottom='14px';
  hint.style.color='#777';
  start.insertAdjacentElement('afterend',label);
  label.insertAdjacentElement('afterend',input);
  input.insertAdjacentElement('afterend',hint);
  start.addEventListener('input',updateHint);
  input.addEventListener('input',updateHint);
  updateHint();
}
window.renderEditForm=bridgedRender;
renderEditForm=bridgedRender;

const originalHasChanges=window.hasEditCalendarChanges||hasEditCalendarChanges;
function bridgedHasChanges(car,updatedData){
  if(originalHasChanges(car,updatedData))return true;
  const previous=Number(car?.eventDurationMinutes||car?.calendar?.eventDurationMinutes||60)||60;
  return previous!==currentDuration();
}
window.hasEditCalendarChanges=bridgedHasChanges;
hasEditCalendarChanges=bridgedHasChanges;

const audit=window.JLYAudit;
if(audit&&typeof audit.updateCarWithAudit==='function'){
  const originalAudit=audit.updateCarWithAudit.bind(audit);
  audit.updateCarWithAudit=async function(config){
    if(config?.source==='editcar'&&config.updateData){
      config={...config,updateData:{...config.updateData,eventDurationMinutes:currentDuration()}};
    }
    return originalAudit(config);
  };
}

const originalSave=window.saveEditCar||saveEditCar;
async function bridgedSave(){
  const minutes=currentDuration();
  if(typeof currentEditingCar!=='undefined'&&currentEditingCar){
    currentEditingCar.eventDurationMinutes=minutes;
    currentEditingCar.calendar={...(currentEditingCar.calendar||{}),eventDurationMinutes:minutes};
  }
  return originalSave();
}
window.saveEditCar=bridgedSave;
saveEditCar=bridgedSave;

window.JLYEditCarDurationBridge={durationFromTimes,endFromDuration,currentDuration};
})();