(function(){
'use strict';
if(window.__JLYWorkScheduleDmNpcSectionsInitialized)return;
window.__JLYWorkScheduleDmNpcSectionsInitialized=true;

const norm=v=>String(v||'').trim().toLowerCase();
function kindFromName(name){
  const n=norm(name);
  if(/(^|\s|[-_])dm($|\s|[-_])/.test(n)||n==='dm'||n.includes('主持'))return'dm';
  if(/(^|\s|[-_])npc($|\s|[-_])/.test(n)||n==='npc'||n.includes('npc'))return'npc';
  return'other';
}
function roleName(el){
  const strong=el.querySelector('strong');
  if(!strong)return'';
  return String(strong.childNodes[0]?.textContent||strong.textContent||'').replace(/\(\d+\)\s*$/,'').trim();
}
function labelFor(kind){return kind==='dm'?'🎭 DM':kind==='npc'?'🎬 NPC':'其他工作人員'}
function sectionize(host,selector){
  if(!host)return;
  host.querySelectorAll(':scope > .work-role-section-title').forEach(x=>x.remove());
  const items=[...host.querySelectorAll(`:scope > ${selector}`)];
  if(!items.length)return;
  items.forEach(el=>{el.dataset.staffKind=kindFromName(roleName(el))});
  const order={dm:0,npc:1,other:2};
  items.sort((a,b)=>order[a.dataset.staffKind]-order[b.dataset.staffKind]).forEach(el=>host.appendChild(el));
  let last='';
  items.forEach(el=>{
    const kind=el.dataset.staffKind;
    if(kind===last)return;
    last=kind;
    const title=document.createElement('div');
    title.className=`work-role-section-title is-${kind}`;
    title.textContent=labelFor(kind);
    host.insertBefore(title,el);
  });
}
function decorateDashboard(){
  document.querySelectorAll('.role-summary-list').forEach(host=>sectionize(host,'.role-summary'));
}
function decorateDetail(){
  sectionize(document.getElementById('groupDetailRoles'),'.staff-role-card');
}
function protectBatch(){
  const dlg=document.getElementById('staffBatchDialog');
  if(!dlg||dlg.dataset.dmNpcGuard==='1')return;
  dlg.dataset.dmNpcGuard='1';
  const role=document.getElementById('staffBatchRole'),apply=document.getElementById('staffBatchApply');
  if(!role||!apply)return;
  const update=()=>{
    const kind=kindFromName(role.options[role.selectedIndex]?.textContent||'');
    dlg.dataset.staffKind=kind;
    apply.dataset.staffKind=kind;
    apply.textContent=kind==='dm'?'套用到已選日期的 DM':kind==='npc'?'套用到已選日期的 NPC':'套用到已選日期';
  };
  role.addEventListener('change',update);
  update();
  apply.addEventListener('click',function(e){
    const kind=dlg.dataset.staffKind;
    if(kind!=='dm'&&kind!=='npc')return;
    const checked=[...dlg.querySelectorAll('#staffBatchDates input[type="checkbox"]:checked')];
    if(!checked.length){e.preventDefault();e.stopImmediatePropagation();alert(`請先選擇要修改 ${kind.toUpperCase()} 的日期。`);return;}
    const labelEnabled=document.getElementById('staffBatchLabelEnabled')?.checked;
    const personEnabled=document.getElementById('staffBatchPersonEnabled')?.checked;
    if(!labelEnabled&&!personEnabled){e.preventDefault();e.stopImmediatePropagation();alert(`尚未勾選要修改的 ${kind.toUpperCase()} 欄位內容。`);}
  },true);
}
function refresh(){decorateDashboard();decorateDetail();protectBatch()}
const observer=new MutationObserver(refresh);
function init(){
  refresh();
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('jly:work-schedule:rows',refresh);
  window.addEventListener('jly:work-schedule:display-scope',refresh);
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
