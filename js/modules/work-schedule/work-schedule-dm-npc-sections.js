(function(){
'use strict';
if(window.__JLYWorkScheduleDmNpcSectionsInitialized)return;
window.__JLYWorkScheduleDmNpcSectionsInitialized=true;
const norm=v=>String(v||'').trim().toLowerCase();
function kindFromName(name){const n=norm(name);if(n==='dm'||/(^|\s|[-_])dm($|\s|[-_])/.test(n)||n.includes('主持'))return'dm';if(n==='npc'||/(^|\s|[-_])npc($|\s|[-_])/.test(n))return'npc';return'other'}
function roleName(el){const strong=el.querySelector('strong');return String(strong?.childNodes?.[0]?.textContent||strong?.textContent||'').replace(/\(\d+\)\s*$/,'').trim()}
function sectionize(host,selector){
 if(!host)return;
 const items=[...host.querySelectorAll(':scope > '+selector)];
 const titles=[...host.querySelectorAll(':scope > .work-role-section-title')];
 if(!items.length){titles.forEach(el=>el.remove());return;}
 const order={dm:0,npc:1,other:2};
 for(const el of items)el.dataset.staffKind=kindFromName(roleName(el));
 const sorted=items.slice().sort((a,b)=>order[a.dataset.staffKind]-order[b.dataset.staffKind]);
 // Do not mutate when the role sections are already in the desired DOM order.
 // This is essential because the page observes childList changes.
 const expected=[];let previous='';
 for(const el of sorted){
  const kind=el.dataset.staffKind;
  if(kind!==previous){expected.push('title:'+kind);previous=kind}
  expected.push(el);
 }
 const current=[...host.children].filter(el=>el.matches(selector)||el.classList.contains('work-role-section-title'));
 const aligned=current.length===expected.length&&current.every((node,index)=>{
  const target=expected[index];
  return typeof target==='string'?node.classList.contains('work-role-section-title')&&node.classList.contains('is-'+target.slice(6)):node===target;
 });
 if(aligned)return;
 titles.forEach(el=>el.remove());
 sorted.forEach(el=>host.appendChild(el));
 previous='';
 for(const el of sorted){
  const kind=el.dataset.staffKind;
  if(kind===previous)continue;
  previous=kind;
  const title=document.createElement('div');
  title.className='work-role-section-title is-'+kind;
  title.textContent=kind==='dm'?'🎭 DM':kind==='npc'?'🎬 NPC':'其他工作人員';
  host.insertBefore(title,el);
 }
}
function protectBatch(){const dlg=document.getElementById('staffBatchDialog');if(!dlg||dlg.dataset.dmNpcGuard==='1')return;const role=document.getElementById('staffBatchRole'),apply=document.getElementById('staffBatchApply');if(!role||!apply)return;dlg.dataset.dmNpcGuard='1';const update=()=>{const kind=kindFromName(role.options[role.selectedIndex]?.textContent||'');dlg.dataset.staffKind=kind;apply.textContent=kind==='dm'?'套用到已選日期的 DM':kind==='npc'?'套用到已選日期的 NPC':'套用到已選日期'};role.addEventListener('change',update);update();apply.addEventListener('click',e=>{const kind=dlg.dataset.staffKind;if(!['dm','npc'].includes(kind))return;const dates=dlg.querySelectorAll('#staffBatchDates input[type="checkbox"]:checked');if(!dates.length){e.preventDefault();e.stopImmediatePropagation();alert(`請先選擇要修改 ${kind.toUpperCase()} 的日期。`);return}const label=document.getElementById('staffBatchLabelEnabled')?.checked,person=document.getElementById('staffBatchPersonEnabled')?.checked,demand=document.getElementById('staffBatchDemandEnabled')?.checked;if(!label&&!person&&!demand){e.preventDefault();e.stopImmediatePropagation();alert(`尚未勾選要修改的 ${kind.toUpperCase()} 欄位內容。`) }},true)}
const observer=new MutationObserver(refresh);
function refresh(){
 // Disconnect while changing the role sections: own DOM writes must not
 // recursively trigger more refreshes (particularly with 72+ event cards).
 observer.disconnect();
 try{
  document.querySelectorAll('.role-summary-list').forEach(h=>sectionize(h,'.role-summary'));
  sectionize(document.getElementById('groupDetailRoles'),'.staff-role-card');
  protectBatch();
 }finally{
  observer.observe(document.body,{childList:true,subtree:true});
 }
}
function init(){refresh()}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();