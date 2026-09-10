(function(){
'use strict';
const db=window.db||firebase.firestore();
const txt=v=>String(v??'').trim();
let activeWorkId='';

function roleKey(r,i){return String(r?.id||r?.name||`role-${i+1}`)}
function normalize(v){return txt(v).toLowerCase().replace(/\s+/g,'')}
function personName(p){return window.JLYMemberPickerData?.getMemberName?.(p)||txt(p?.displayName||p?.nickname||p?.playerName||p?.name)}

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
  const workRef=db.collection('workScheduleWorks').doc(activeWorkId),workSnap=await workRef.get();
  if(!workSnap.exists)throw new Error('找不到目前劇本');
  const work=workSnap.data()||{},roles=Array.isArray(work.roles)?work.roles.map(r=>({...r})):[],idx=roles.findIndex((r,i)=>roleKey(r,i)===key);
  if(idx<0)throw new Error('找不到目前角色');
  const personRef=db.collection('players').doc(),now=firebase.firestore.FieldValue.serverTimestamp();
  const eligible=[...new Set([...(roles[idx].eligiblePersonIds||roles[idx].personIds||[]).map(String),personRef.id])];
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
  const name=txt(input.value);if(!name)return;
  const existing=[...box.querySelectorAll('button')].some(b=>normalize(b.textContent)===normalize(name));
  let add=box.querySelector('[data-create-person]');
  if(existing){add?.remove();return}
  if(!add){add=document.createElement('button');add.type='button';add.dataset.createPerson='1';add.className='work-create-person';box.appendChild(add)}
  add.textContent=`＋ 新增正式人員：${name}`;
  add.onclick=()=>createAndAttach(input).catch(e=>{console.error('[WorkSchedulePersonCreate]',e);alert(`新增人員失敗：${e.message||e}`)});
}

document.addEventListener('click',e=>{
  const card=e.target.closest?.('[data-work-id]');if(card?.dataset.workId)activeWorkId=card.dataset.workId;
});
document.addEventListener('input',e=>{
  const input=e.target.closest?.('[data-role-search]');if(input)setTimeout(()=>decorate(input),0);
});
new MutationObserver(()=>{
  document.querySelectorAll('[data-role-search]').forEach(input=>{if(txt(input.value))decorate(input)});
}).observe(document.documentElement,{childList:true,subtree:true});
})();
