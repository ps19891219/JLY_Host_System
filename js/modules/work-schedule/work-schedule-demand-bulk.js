// JLY Work Schedule: add demand-only batch operation to the existing selected-day toolbar.
// Reuses current Work / Work Shift / Prepared View / Lifecycle. No new Firestore collections.
(function(){
'use strict';
if(window.__JLYWorkScheduleDemandBulkInitialized)return;
window.__JLYWorkScheduleDemandBulkInitialized=true;
const $=id=>document.getElementById(id);
const text=v=>String(v??'').trim();
const G=window.JLYWorkScheduleDemandPlan;
const db=()=>window.db||(window.firebase&&window.firebase.firestore());
let current=null,busy=false;
function selectedKeys(){
 return new Set([...document.querySelectorAll('#scheduleDashboard .work-day-card[data-group]')]
  .filter(card=>card.querySelector('[data-select-group]')?.checked)
  .map(card=>text(card.dataset.group)).filter(Boolean));
}
function currentRows(){return window.JLYWorkScheduleDashboard?.getRows?.()||[]}
function ensureDialog(){
 let dlg=$('workDemandBulkDialog');if(dlg)return dlg;
 dlg=document.createElement('dialog');dlg.id='workDemandBulkDialog';dlg.setAttribute('aria-labelledby','workDemandBulkTitle');
 dlg.style.cssText='border:0;border-radius:18px;padding:0;width:min(94vw,680px);max-height:88vh;overflow:auto;';
 dlg.innerHTML=`<div class="dialog-shell" style="padding:18px;display:grid;gap:12px">
 <header style="display:flex;align-items:start;justify-content:space-between;gap:12px"><div><small>只更新人力需求</small><h2 id="workDemandBulkTitle">批次套用劇本預設</h2></div><button type="button" id="workDemandBulkClose" aria-label="關閉">✕</button></header>
 <p id="workDemandBulkSummary"></p>
 <label style="display:grid;gap:4px">DM 需求<input id="workDemandBulkDM" type="number" min="0" max="30" step="1" inputmode="numeric" placeholder="依劇本預設"></label>
 <label style="display:grid;gap:4px">NPC 需求<input id="workDemandBulkNPC" type="number" min="0" max="30" step="1" inputmode="numeric" placeholder="依劇本預設"></label>
 <p style="font-size:13px;opacity:.75;margin:0">留空使用劇本預設值；0 表示不需要。只針對已勾選場次中現存的 DM／NPC 角色，不新增或刪除角色。</p>
 <label style="display:flex;align-items:start;gap:8px"><input id="workDemandBulkOverride" type="checkbox">覆蓋已有的單場需求（包括已設為 0 的場次）</label>
 <p id="workDemandBulkPreview" role="status" style="font-size:13px;margin:0"></p>
 <button type="button" id="workDemandBulkApply">套用到已選場次</button>
 </div>`;
 document.body.appendChild(dlg);
 $('workDemandBulkClose').onclick=()=>{if(!busy)dlg.close()};
 $('workDemandBulkApply').onclick=apply;
 for(const id of ['workDemandBulkDM','workDemandBulkNPC','workDemandBulkOverride'])$(id).addEventListener('change',updatePreview);
 return dlg;
}
function options(){
 const values={};
 for(const [role,id] of [['DM','workDemandBulkDM'],['NPC','workDemandBulkNPC']]){
  const raw=$(id).value.trim();if(raw==='')continue;
  const n=G.count(raw);if(n===null)throw new Error(`${role} 需求只能填 0～30 的整數`);
  values[role]=n;
 }
 return{values,overrideExisting:$('workDemandBulkOverride').checked};
}
function makePlan(){
 if(!current)throw new Error('尚未選取劇本場次');
 const {values,overrideExisting}=options();
 return G.buildPlan({rows:current.rows,work:current.work,sessionKeys:current.sessionKeys,values,overrideExisting});
}
function updatePreview(){
 const host=$('workDemandBulkPreview');if(!host)return;
 try{
  const plan=makePlan(),stats=new Map();for(const e of plan.edits)stats.set(e.normalizedRole,(stats.get(e.normalizedRole)||0)+1);
  host.textContent=plan.problems.length?`⚠ 資料有衝突，無法操作：${plan.problems.join('、')}`:
   `預計更新 ${plan.edits.length} 筆角色場次（DM ${stats.get('DM')||0}、NPC ${stats.get('NPC')||0}），略過 ${plan.skipped.length} 筆已設定／非目標角色。`;
 }catch(error){host.textContent=`⚠ ${error.message}`}
}
async function open(){
 if(busy)return;
 if(!G||!window.JLYWorkScheduleLifecycle?.appendToBatch||!window.JLYWorkScheduleReadView?.syncShifts)
  return alert('排班模組尚未完整載入，不能批次套用。');
 const keys=selectedKeys();if(!keys.size)return alert('請先勾選要套用需求的工作日。');
 const rows=currentRows();
 const selected=rows.filter(r=>r?.id&&keys.has(G.key(r)));
 if(!selected.length)return alert('找不到已選工作日的 Prepared View 資料，請重新整理。');
 const workIds=new Set(selected.map(r=>text(r.workId)).filter(Boolean));
 if(workIds.size!==1)return alert('請一次只選同一個劇本的工作日。');
 const workId=[...workIds][0],firestore=db();if(!firestore)return alert('Firebase 尚未初始化。');
 try{
  const snap=await firestore.collection('workScheduleWorks').doc(workId).get();
  if(!snap.exists)return alert('劇本設定不存在，禁止批次修改。');
  const work={id:snap.id,...snap.data()};
  const allSessions=G.distinctSessions(selected,workId),sessionKeys=allSessions.map(s=>s.key);
  // If selection contains a scope we cannot see, fail rather than touching an unintended row.
  if(sessionKeys.length!==keys.size)return alert('部分已選工作日沒有對應資料，請重新整理後再試。');
  current={work,rows:selected,sessionKeys};
  const dlg=ensureDialog(),dm=(work.roles||[]).find(r=>['DM','GM'].includes(G.normalizedRole(r.name))),
   npc=(work.roles||[]).find(r=>['NPC','PC'].includes(G.normalizedRole(r.name)));
  $('workDemandBulkDM').placeholder=G.defaultOf(dm)===null?'劇本未設定':`依劇本預設 ${G.defaultOf(dm)}`;
  $('workDemandBulkNPC').placeholder=G.defaultOf(npc)===null?'劇本未設定':`依劇本預設 ${G.defaultOf(npc)}`;
  $('workDemandBulkDM').value='';$('workDemandBulkNPC').value='';$('workDemandBulkOverride').checked=false;
  $('workDemandBulkSummary').textContent=`${work.name||work.workName||'劇本'}｜已勾選 ${sessionKeys.length} 個工作日。預設只補「尚未設定」的需求，已排人員完全保留。`;
  updatePreview();dlg.showModal();
 }catch(error){console.error('open work demand batch',error);alert(`讀取劇本失敗：${error.message||error}`)}
}
async function apply(){
 if(busy)return;
 let plan;try{plan=makePlan()}catch(error){return alert(error.message)}
 if(plan.problems.length)return alert(`偵測到資料衝突，沒有寫入：${plan.problems.join('、')}`);
 if(!plan.edits.length)return alert('沒有需要更新的需求。若場次已有單場設定，必須明確勾選覆蓋。');
 if(plan.edits.length>160)return alert('一次最多處理 160 筆角色場次，請減少勾選日期後再試。');
 const counts=new Map();for(const e of plan.edits)counts.set(e.normalizedRole,(counts.get(e.normalizedRole)||0)+1);
 if(!confirm(`確認更新 ${plan.edits.length} 筆人力需求？\nDM ${counts.get('DM')||0} 筆、NPC ${counts.get('NPC')||0} 筆。\n\n不會修改排班人員、日期、Google Calendar 或其他欄位。`))return;
 const overrideExisting=options().overrideExisting;
 busy=true;$('workDemandBulkApply').disabled=true;
 const firestore=db(),V=window.JLYWorkScheduleReadView,L=window.JLYWorkScheduleLifecycle;
 const shiftRefs=plan.edits.map(edit=>firestore.collection('workShifts').doc(edit.id));
 const workRef=firestore.collection('workScheduleWorks').doc(current.work.id);
 let committed=false;
 try{
  // Read all authoritative documents first, then write only the exact selected shift documents.
  const changes=await firestore.runTransaction(async tx=>{
   const [workSnap,...snapshots]=await Promise.all([tx.get(workRef),...shiftRefs.map(ref=>tx.get(ref))]);
   if(!workSnap.exists)throw new Error('劇本設定已刪除');
   const liveWork={id:workSnap.id,...workSnap.data()};
   const next=[];
   for(let i=0;i<plan.edits.length;i++){
    const edit=plan.edits[i],snap=snapshots[i];
    const fresh=snap.exists?snap.data():null;
    const reason=G.validateFresh(edit,fresh,liveWork,{overrideExisting});
    if(reason)throw new Error(`資料變動，已取消：${edit.roleName} ${reason}`);
    const source={id:snap.id,...fresh};
    const payload=G.payload(edit,fresh,window.firebase.firestore.FieldValue.serverTimestamp());
    const after={...source,...payload};
    next.push({ref:shiftRefs[i],before:source,after,payload});
   }
   for(const item of next){tx.update(item.ref,item.payload);L.appendToBatch(tx,item.ref,item.before,item.after,{source:'work_schedule_demand_batch',conflictAcknowledged:false,conflictCount:0})}
   return next.map(({before,after})=>({before,after}));
  });
  committed=true;
  await V.syncShifts(changes);
  $('workDemandBulkDialog').close();current=null;
  await window.JLYWorkScheduleDashboard?.reload?.();
  alert(`需求更新完成：${changes.length} 筆角色場次。請確認 DM／NPC 的缺額標示。`);
 }catch(error){
  console.error('Work Schedule demand batch',error);
  alert(committed?
   `班表來源已更新，但 Prepared View 同步尚未確認：${error.message||error}。請勿立即重複操作，先檢查顯示資料。`:
   `沒有完成需求更新：${error.message||error}。請重新整理後再試。`);
 }finally{busy=false;$('workDemandBulkApply').disabled=false}
}
function init(){
 const anchor=$('batchAssignOpen'),bar=$('batchBar');if(!anchor||!bar||$('batchDemandOpen'))return;
 const button=document.createElement('button');button.type='button';button.id='batchDemandOpen';button.textContent='批次套用需求';
 anchor.insertAdjacentElement('afterend',button);
 button.addEventListener('click',open);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
