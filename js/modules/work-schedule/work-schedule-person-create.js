(function(){
'use strict';
const db=window.db||firebase.firestore();
const works=db.collection('workScheduleWorks');
const shifts=db.collection('workShifts');
const txt=v=>String(v??'').trim();
let activeWorkId='';

function roleKey(r,i){return String(r?.id||r?.name||`role-${i+1}`)}
function normalize(v){return txt(v).toLowerCase().replace(/\s+/g,'')}
function personName(p){return window.JLYMemberPickerData?.getMemberName?.(p)||txt(p?.displayName||p?.nickname||p?.playerName||p?.name)}
function roleIds(r){return (r?.eligiblePersonIds||r?.personIds||[]).map(String)}
function endDate(date,start,end){if(!date)return date;if(end&&start&&end<start){const d=new Date(`${date}T00:00:00`);d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)}return date}
function candidateCount(work){return (work.roles||[]).reduce((n,r)=>n+roleIds(r).length,0)}

async function duplicateNames(name){
  const list=await window.JLYMemberPickerData.loadPersonDirectory();
  return list.filter(p=>normalize(personName(p))===normalize(name));
}

async function createAndAttach(input){
  const name=txt(input.value),key=String(input.dataset.roleSearch||'');
  if(!name||!key||!activeWorkId)return;
  const same=await duplicateNames(name);
  if(same.length){
    const names=same.map(p=>`${personName(p)} (${String(p.id).slice(0,6)})`).join('\n');
    if(!confirm(`已有同名 Person：\n${names}\n\n仍要建立另一位「${name}」嗎？\n取消後可直接選上方既有人員。`))return;
  }
  if(!confirm(`建立正式 Person「${name}」，並加入這個角色的可排班名單？`))return;
  const workRef=works.doc(activeWorkId),workSnap=await workRef.get();
  if(!workSnap.exists)throw new Error('找不到目前劇本');
  const work=workSnap.data()||{},roles=Array.isArray(work.roles)?work.roles.map(r=>({...r})):[],idx=roles.findIndex((r,i)=>roleKey(r,i)===key);
  if(idx<0)throw new Error('找不到目前角色');
  const personRef=db.collection('players').doc(),now=firebase.firestore.FieldValue.serverTimestamp();
  const eligible=[...new Set([...roleIds(roles[idx]),personRef.id])];
  roles[idx].eligiblePersonIds=eligible;
  const batch=db.batch();
  batch.set(personRef,{displayName:name,playerName:name,status:'active',isCanonicalPerson:true,source:'work-schedule-role-pool',createdAt:now,updatedAt:now});
  batch.set(workRef,{roles,updatedAt:now},{merge:true});
  await batch.commit();
  input.value='';
  window.location.reload();
}

function decorate(input){
  const box=input.parentElement?.querySelector('[data-role-results]');if(!box)return;
  const name=txt(input.value);
  let add=box.querySelector('[data-create-person]');
  if(!name){add?.remove();return}
  const existing=[...box.querySelectorAll('button:not([data-create-person])')].some(b=>normalize(b.textContent)===normalize(name));
  if(existing){add?.remove();return}
  if(!add){add=document.createElement('button');add.type='button';add.dataset.createPerson='1';add.className='work-create-person';box.appendChild(add)}
  const label=`＋ 新增正式人員：${name}`;
  if(add.textContent!==label)add.textContent=label;
  add.onclick=()=>createAndAttach(input).catch(e=>{console.error('[WorkSchedulePersonCreate]',e);alert(`新增人員失敗：${e.message||e}`)});
}

async function repairDuplicateWorks(){
  const snap=await works.get(),list=snap.docs.map(d=>({id:d.id,...d.data()})),groups=new Map();
  list.forEach(w=>{const key=`${normalize(w.name||w.workName)}|${normalize(w.studioName)}`;if(!key.startsWith('|')){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(w)}});
  for(const same of groups.values()){
    if(same.length<2)continue;
    same.sort((a,b)=>candidateCount(b)-candidateCount(a));
    const canonical=same[0];
    if(candidateCount(canonical)===0)continue;
    for(const duplicate of same.slice(1)){
      if(candidateCount(duplicate)!==0)continue;
      const shiftSnap=await shifts.where('workId','==',duplicate.id).get();
      const batch=db.batch(),now=firebase.firestore.FieldValue.serverTimestamp();
      shiftSnap.docs.forEach(d=>batch.update(d.ref,{workId:canonical.id,workName:canonical.name||canonical.workName||d.data().workName||'',studioName:canonical.studioName||d.data().studioName||'',updatedAt:now}));
      batch.delete(works.doc(duplicate.id));
      await batch.commit();
      document.querySelector(`[data-work-id="${CSS.escape(duplicate.id)}"]`)?.remove();
      if(activeWorkId===duplicate.id)activeWorkId=canonical.id;
    }
  }
}

async function saveQuickWithoutReload(form){
  if(!activeWorkId)return false;
  const workSnap=await works.doc(activeWorkId).get();
  if(!workSnap.exists)return false;
  const work={id:workSnap.id,...workSnap.data()},date=document.getElementById('workQuickDate')?.value,start=document.getElementById('workQuickStart')?.value,end=document.getElementById('workQuickEnd')?.value,note=txt(document.getElementById('workQuickNote')?.value);
  if(!date||!start||!end)return false;
  const batch=db.batch(),now=firebase.firestore.FieldValue.serverTimestamp();let created=0;
  (work.roles||[]).filter(r=>txt(r.name)).forEach((r,i)=>{
    const key=roleKey(r,i),section=form.querySelector(`[data-quick-role="${CSS.escape(key)}"]`);if(!section)return;
    const ids=[...section.querySelectorAll('[data-quick-person].selected')].map(b=>String(b.dataset.quickPerson||'').slice(String(b.dataset.quickPerson||'').lastIndexOf('|')+1));
    const required=Math.max(0,Number(section.querySelector('[data-quick-count]')?.value||0));if(required===0&&!ids.length)return;
    const ref=shifts.doc(),slots=Array.from({length:Math.max(required,ids.length)},(_,si)=>({id:`${ref.id}-slot-${si+1}`,slotKey:`slot-${si+1}`,label:String(si+1),personId:ids[si]||''}));
    const people=ids.map(id=>{const button=section.querySelector(`[data-quick-person$="|${CSS.escape(id)}"]`);return {personId:id,name:txt(button?.textContent)||'未命名'}});
    batch.set(ref,{workId:work.id,workName:work.name||work.workName||'',studioName:work.studioName||'',roleName:r.name,rolePoolId:r.id||key,eligiblePersonIds:roleIds(r),rolePoolsSnapshot:(work.roles||[]).map(x=>({id:x.id,name:x.name,eligiblePersonIds:roleIds(x)})),date,monthKey:date.slice(0,7),startTime:start,endTime:end,endDate:endDate(date,start,end),requiredCount:slots.length,staffSlots:slots,assignedPersonIds:ids,personIds:ids,people,missingCount:slots.filter(s=>!s.personId).length,staffingStatus:slots.some(s=>!s.personId)?'pending':'complete',note,calendar:{syncEnabled:false,autoUpdate:false,provider:'google',calendarId:'primary'},schemaVersion:6,createdAt:now,updatedAt:now});created++;
  });
  if(!created){alert('請至少設定一個角色的人數或人員。');return true}
  await batch.commit();
  document.getElementById('workQuickScheduleDialog')?.close();
  const activeView=document.querySelector('[data-dashboard-view].active')||document.querySelector('[data-dashboard-view="all"]');
  activeView?.click();
  return true;
}

document.addEventListener('click',e=>{
  const card=e.target.closest?.('[data-work-id]');if(card?.dataset.workId)activeWorkId=card.dataset.workId;
  if(e.target.closest?.('#dashboardCreate')&&!document.getElementById('workWorkspace')?.hidden){e.preventDefault();e.stopImmediatePropagation();document.getElementById('workWorkspaceSchedule')?.click()}
},true);
document.addEventListener('input',e=>{const input=e.target.closest?.('[data-role-search]');if(input)decorate(input)});
document.addEventListener('submit',e=>{
  if(e.target?.id!=='workQuickScheduleForm')return;
  e.preventDefault();e.stopImmediatePropagation();
  saveQuickWithoutReload(e.target).catch(err=>{console.error('[WorkScheduleQuickSave]',err);alert(`排班儲存失敗：${err.message||err}`)});
},true);

function start(){repairDuplicateWorks().catch(e=>console.error('[WorkScheduleIntegrity] duplicate repair failed',e))}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
