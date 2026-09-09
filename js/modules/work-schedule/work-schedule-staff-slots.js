(function(){
'use strict';
const db=window.db||firebase.firestore();
const shifts=db.collection('workShifts');
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const txt=v=>String(v??'').trim();
let people=[];
let rows=[];
let detail=null;
let dragFrom=null;
let refreshTimer=0;

function idsOf(r){return (r.assignedPersonIds||r.personIds||[]).map(String)}
function personName(id,r={}){
  const snap=(r.people||[]).find(p=>String(p.personId||p.id)===String(id));
  if(snap?.name)return snap.name;
  const p=people.find(x=>String(x.id)===String(id));
  return window.JLYMemberPickerData?.getMemberName?.(p)||p?.displayName||p?.playerName||p?.nickname||'未命名';
}
function alpha(i){let n=i+1,out='';while(n>0){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26)}return out}
function normalizeSlots(r){
  const ids=idsOf(r),stored=Array.isArray(r.staffSlots)?r.staffSlots:[];
  const count=Math.max(Number(r.requiredCount||0),ids.length,stored.length);
  const slots=[];
  for(let i=0;i<count;i++){
    const s=stored[i]||{};
    slots.push({id:String(s.id||`${r.id||r.rolePoolId||'role'}-slot-${i+1}`),label:txt(s.label)||alpha(i),personId:String(s.personId||ids[i]||'')});
  }
  const used=new Set(slots.map(s=>s.personId).filter(Boolean));
  ids.forEach(id=>{if(!used.has(id)){slots.push({id:`${r.id||'role'}-slot-${slots.length+1}`,label:alpha(slots.length),personId:id});used.add(id)}});
  return slots;
}
function groupKey(r){return [r.date,r.workId||r.workName,r.startTime,r.endTime,r.studioName||''].join('|')}
function parseMonth(){
  const m=($('dashboardMonthLabel')?.textContent||'').match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  if(m)return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}`;
  const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
async function loadPeople(){try{people=await window.JLYMemberPickerData.loadPersonDirectory()}catch(_){people=[]}}
async function refreshRows(){
  const key=parseMonth();
  try{
    const snap=await shifts.where('monthKey','==',key).get();
    rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.status!=='cancelled');
    enhanceCards();
  }catch(e){console.error('[WorkScheduleStaffSlots] refresh failed',e)}
}
function rowsForGroup(key){return rows.filter(r=>groupKey(r)===key)}
function enhanceCards(){
  document.querySelectorAll('.work-day-card[data-group]').forEach(card=>{
    const rs=rowsForGroup(card.dataset.group);if(!rs.length)return;
    const list=card.querySelector('.role-summary-list');
    if(list){
      list.innerHTML=rs.map(r=>{const slots=normalizeSlots(r),missing=slots.filter(s=>!s.personId).length;return `<div class="role-summary"><strong>${esc(r.roleName||'未設定角色')}</strong><span>${slots.length?esc(slots.map(s=>s.label).join('・')):'尚未建立欄位'}</span>${missing?`<em>缺 ${missing}</em>`:''}</div>`}).join('');
    }
    const date=card.querySelector('.group-date');
    if(date&&rs[0]?.date){
      const d=new Date(`${rs[0].date}T00:00:00`),week='日一二三四五六'[d.getDay()];
      date.textContent=`${d.getMonth()+1}/${d.getDate()}（${week}）　${rs[0].startTime||''}–${rs[0].endDate!==rs[0].date?'翌日 ':''}${rs[0].endTime||''}`;
    }
    card.classList.add('staff-slots-card');
  });
}
function ensurePicker(){
  let dlg=$('staffPersonDialog');if(dlg)return dlg;
  dlg=document.createElement('dialog');dlg.id='staffPersonDialog';dlg.className='staff-person-dialog';
  dlg.innerHTML='<div class="staff-picker-shell"><header><div><small>選擇工作人員</small><h3 id="staffPersonTitle"></h3></div><button type="button" id="staffPersonClose" class="dialog-close" aria-label="關閉">×</button></header><div id="staffPersonList" class="staff-person-list"></div></div>';
  document.body.appendChild(dlg);$('staffPersonClose').onclick=()=>dlg.close();return dlg;
}
function slotHtml(ri,s,si,row){
  return `<div class="staff-slot-row ${s.personId?'is-filled':'is-empty'}" draggable="true" data-staff-slot="${ri}|${si}"><span class="staff-slot-handle" aria-label="拖曳欄位">☰</span><input class="staff-slot-label" value="${esc(s.label)}" data-slot-label="${ri}|${si}" aria-label="欄位名稱"><button type="button" class="staff-person-button" data-pick-person="${ri}|${si}">${esc(s.personId?personName(s.personId,row):'點此選擇人員')}</button><button type="button" class="staff-slot-remove" data-remove-slot="${ri}|${si}" aria-label="刪除欄位">×</button></div>`;
}
function roleHtml(item,ri){
  return `<section class="staff-role-card"><div class="staff-role-header"><div><strong>${esc(item.row.roleName||'未設定角色')}</strong><span>${item.slots.length} 位</span></div><button type="button" class="staff-role-save" data-save-role="${ri}">儲存</button></div><p class="staff-role-help">欄位名稱可修改，拖曳整列可排序，點名字可更換人員。</p><div class="staff-slot-list">${item.slots.map((s,si)=>slotHtml(ri,s,si,item.row)).join('')}</div><button type="button" class="staff-slot-add" data-add-slot="${ri}">＋ 新增工作人員</button></section>`;
}
function renderDetail(){
  const g=detail?.group;if(!g)return;
  $('groupDetailTitle').textContent=g[0]?.workName||'工作明細';
  const r=g[0]||{};$('groupDetailMeta').textContent=`${r.date||''}　${r.startTime||''}–${r.endDate!==r.date?'翌日 ':''}${r.endTime||''}${r.studioName?' · '+r.studioName:''}`;
  $('groupDetailRoles').innerHTML=detail.roles.map(roleHtml).join('');
  bindDetail();
}
function openDetail(key){
  const g=rowsForGroup(key);if(!g.length)return;
  detail={key,group:g,roles:g.map(row=>({row,slots:normalizeSlots(row)}))};
  renderDetail();$('groupDetailDialog')?.showModal();
}
function bindDetail(){
  const host=$('groupDetailRoles');if(!host)return;
  host.querySelectorAll('[data-slot-label]').forEach(i=>i.oninput=()=>{const [ri,si]=i.dataset.slotLabel.split('|').map(Number);detail.roles[ri].slots[si].label=i.value});
  host.querySelectorAll('[data-pick-person]').forEach(b=>b.onclick=()=>{const [ri,si]=b.dataset.pickPerson.split('|').map(Number);openPicker(ri,si)});
  host.querySelectorAll('[data-remove-slot]').forEach(b=>b.onclick=()=>{const [ri,si]=b.dataset.removeSlot.split('|').map(Number);detail.roles[ri].slots.splice(si,1);renderDetail()});
  host.querySelectorAll('[data-add-slot]').forEach(b=>b.onclick=()=>{const ri=Number(b.dataset.addSlot),slots=detail.roles[ri].slots;slots.push({id:`slot-${Date.now()}-${slots.length}`,label:alpha(slots.length),personId:''});renderDetail()});
  host.querySelectorAll('[data-save-role]').forEach(b=>b.onclick=()=>saveRole(Number(b.dataset.saveRole)));
  host.querySelectorAll('[data-staff-slot]').forEach(el=>{
    el.ondragstart=()=>{dragFrom=el.dataset.staffSlot;el.classList.add('dragging')};
    el.ondragend=()=>{dragFrom=null;el.classList.remove('dragging')};
    el.ondragover=e=>e.preventDefault();
    el.ondrop=e=>{e.preventDefault();if(!dragFrom)return;const [fr,fi]=dragFrom.split('|').map(Number),[tr,ti]=el.dataset.staffSlot.split('|').map(Number);if(fr!==tr)return;const slots=detail.roles[tr].slots,[moved]=slots.splice(fi,1);slots.splice(ti,0,moved);renderDetail()};
  });
}
function openPicker(ri,si){
  const dlg=ensurePicker(),item=detail.roles[ri],slot=item.slots[si];
  const eligible=(item.row.eligiblePersonIds||item.row.personIds||[]).map(String),ids=[...new Set([...eligible,...(slot.personId?[slot.personId]:[])])];
  $('staffPersonTitle').textContent=`${item.row.roleName||'角色'} · ${slot.label}`;
  $('staffPersonList').innerHTML=`<button type="button" class="staff-person-option ${slot.personId?'':'selected'}" data-person-id="">清空此欄位</button>${ids.map(id=>`<button type="button" class="staff-person-option ${id===slot.personId?'selected':''}" data-person-id="${esc(id)}">${esc(personName(id,item.row))}</button>`).join('')}`;
  $('staffPersonList').querySelectorAll('[data-person-id]').forEach(b=>b.onclick=()=>{slot.personId=b.dataset.personId;dlg.close();renderDetail()});
  dlg.showModal();
}
async function saveRole(ri){
  const item=detail.roles[ri],row=item.row,slots=item.slots.map((s,i)=>({id:s.id||`${row.id}-slot-${i+1}`,label:txt(s.label)||alpha(i),personId:String(s.personId||'')}));
  const personIds=slots.map(s=>s.personId).filter(Boolean),persons=personIds.map(id=>({personId:id,name:personName(id,row)})),missing=slots.filter(s=>!s.personId).length;
  try{
    await shifts.doc(row.id).update({staffSlots:slots,assignedPersonIds:personIds,personIds,people:persons,requiredCount:slots.length,missingCount:missing,staffingStatus:missing?'pending':'complete',updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    row.staffSlots=slots;row.assignedPersonIds=personIds;row.personIds=personIds;row.people=persons;row.requiredCount=slots.length;row.missingCount=missing;
    renderDetail();enhanceCards();
    const btn=document.querySelector(`[data-save-role="${ri}"]`);if(btn){btn.textContent='已儲存 ✓';setTimeout(()=>{if(btn.isConnected)btn.textContent='儲存'},1200)}
  }catch(e){alert(`儲存工作人員失敗：${e.message||e}`)}
}
function intercept(e){
  const card=e.target.closest?.('.work-day-card[data-group]');if(!card)return;
  if(e.target.closest('input,label'))return;
  e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();openDetail(card.dataset.group);
}
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshRows,80)}
async function init(){
  await loadPeople();await refreshRows();
  document.addEventListener('click',intercept,true);
  const host=$('scheduleDashboard');if(host)new MutationObserver(()=>{enhanceCards();scheduleRefresh()}).observe(host,{childList:true,subtree:true});
  const label=$('dashboardMonthLabel');if(label)new MutationObserver(scheduleRefresh).observe(label,{childList:true,characterData:true,subtree:true});
}
function start(){init().catch(e=>console.error('[WorkScheduleStaffSlots] init failed',e))}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
