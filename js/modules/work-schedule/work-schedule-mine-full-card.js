(function(){
'use strict';
if(window.__JLYWorkScheduleMineFullCardInitialized)return;
window.__JLYWorkScheduleMineFullCardInitialized=true;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const txt=v=>String(v??'').trim();
let identityIds=new Set();

function idsOf(row){return(row?.assignedPersonIds||row?.personIds||[]).map(String)}
function groupKey(row){return[row.date,row.workId||row.workName,row.startTime,row.endTime,row.studioName||''].join('|')}
function isMineView(){return document.querySelector('[data-dashboard-view="mine"]')?.classList.contains('active')===true}

async function resolveMe(){
  try{
    const identity=window.JLYIdentity;
    const profileId=identity?.getCurrentPlayerProfileId?.();
    if(profileId&&identity?.syncFromPlayerProfile&&window.db)await identity.syncFromPlayerProfile(window.db,profileId);
    identityIds=new Set((identity?.getAllPlayerIdentityIds?.()||[]).map(String));
  }catch(_){identityIds=new Set()}
}

function snapshotName(id,row){
  const person=(row?.people||[]).find(p=>String(p.personId||p.id)===String(id));
  return txt(person?.name||person?.displayName||person?.playerName)||'未命名';
}

function renderName(id,row){
  const name=esc(snapshotName(id,row));
  return identityIds.has(String(id))?`<b class="mine-person-name">${name}</b>`:name;
}

function patch(detail){
  if(!isMineView())return;
  const allRows=Array.isArray(detail?.rows)?detail.rows:[];
  const visibleRows=Array.isArray(detail?.visibleRows)?detail.visibleRows:[];
  const visibleKeys=new Set(visibleRows.map(groupKey));
  if(!visibleKeys.size)return;

  const grouped=new Map();
  allRows.forEach(row=>{
    const key=groupKey(row);
    if(!visibleKeys.has(key))return;
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(row);
  });

  grouped.forEach((groupRows,key)=>{
    const card=[...document.querySelectorAll('.work-day-card')].find(el=>el.dataset.group===key);
    const host=card?.querySelector('.role-summary-list');
    if(!host)return;
    host.innerHTML=groupRows.map(row=>{
      const ids=idsOf(row),missing=Number(row.missingCount||0);
      const names=ids.slice(0,4).map(id=>renderName(id,row)).join('、')||'尚未排人';
      const more=ids.length>4?` <b>＋${ids.length-4}</b>`:'';
      return `<div class="role-summary"><strong>${esc(row.roleName||'未設定角色')} <small>(${ids.length})</small></strong><span>${names}${more}</span>${missing?`<em>尚缺 ${missing}</em>`:''}</div>`;
    }).join('');
  });
}

window.addEventListener('jly:work-schedule:rows',async event=>{
  await resolveMe();
  patch(event.detail||{});
});
})();
