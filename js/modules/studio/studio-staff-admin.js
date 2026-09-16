(function(){
'use strict';
const txt=v=>String(v??'').trim();
const db=window.db||firebase.firestore();
const params=new URLSearchParams(location.search);
const studio=txt(params.get('studio')||'kaiwei-private');
const listEl=document.getElementById('studioStaffList');
const search=document.getElementById('studioStaffSearch');
const results=document.getElementById('studioStaffResults');
let directory=[];
const nameOf=p=>window.JLYMemberPickerData?.getMemberName?.(p)||txt(p.displayName||p.playerName||p.name)||'未命名人員';
const canonicalId=p=>window.JLYMemberPickerData?.getCanonicalMemberId?.(p)||txt(p.id);
function aliasesOf(p){const ids=new Set([p.id,p.personId,p.profileId,p.canonicalPersonId,p.identityId,...(Array.isArray(p.linkedPlayerIds)?p.linkedPlayerIds:[])]);return [...ids].map(txt).filter(Boolean)}
async function loadMemberships(){const snap=await db.collection('studioMemberships').where('studioName','==',studio).get();const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>txt(x.status||'active')==='active').sort((a,b)=>txt(a.displayName).localeCompare(txt(b.displayName),'zh-Hant'));listEl.innerHTML=rows.length?rows.map(x=>`<div class="card" style="margin:8px 0"><strong>${escapeHtml(x.displayName||x.personId)}</strong><div style="font-size:13px;color:#666;margin-top:4px">${escapeHtml((x.roles||['staff']).join('、'))}</div><button type="button" class="gray" data-disable-membership="${escapeHtml(x.id)}" style="margin-top:8px">停用員工關係</button></div>`).join(''):'<p>目前尚未建立正式員工關係。</p>'}
function escapeHtml(v){const d=document.createElement('div');d.textContent=txt(v);return d.innerHTML}
async function addPerson(p){const personId=canonicalId(p);if(!personId)return;const id=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${studio}:${personId}`)).then(b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,40));const ref=db.collection('studioMemberships').doc(id);const old=await ref.get();const now=firebase.firestore.FieldValue.serverTimestamp();await ref.set({studioName:studio,personId,personIds:aliasesOf(p),displayName:nameOf(p),roles:['staff'],permissions:[],status:'active',source:'studio_staff_admin',updatedAt:now,...(!old.exists?{createdAt:now}:{})},{merge:true});search.value='';results.innerHTML='';await loadMemberships()}
async function disable(id){if(!confirm('停用這位人員在此工作室的員工關係？'))return;await db.collection('studioMemberships').doc(id).set({status:'inactive',updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});await loadMemberships()}
function renderResults(){const q=txt(search.value);if(!q){results.innerHTML='';return}const rows=window.JLYMemberPickerData.searchMembers(directory,q).slice(0,20);results.innerHTML=rows.map(p=>`<button type="button" data-person-id="${escapeHtml(p.id)}" style="width:100%;margin-top:6px;text-align:left">＋ ${escapeHtml(nameOf(p))} <small>${escapeHtml(window.JLYMemberPickerData.getIdentityLabel(p))}</small></button>`).join('')||'<p>找不到既有 Person。</p>'}
search.addEventListener('input',renderResults);
results.addEventListener('click',e=>{const b=e.target.closest('[data-person-id]');if(!b)return;const p=directory.find(x=>String(x.id)===b.dataset.personId);if(p)addPerson(p).catch(err=>alert(`新增員工失敗：${err.message||err}`))});
listEl.addEventListener('click',e=>{const b=e.target.closest('[data-disable-membership]');if(b)disable(b.dataset.disableMembership).catch(err=>alert(`停用失敗：${err.message||err}`))});
(async()=>{directory=await window.JLYMemberPickerData.loadPersonDirectory();await loadMemberships()})().catch(err=>{console.error('[StudioStaffAdmin]',err);listEl.innerHTML=`<p>讀取失敗：${escapeHtml(err.message||err)}</p>`});
})();
