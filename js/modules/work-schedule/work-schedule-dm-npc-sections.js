(function(){
'use strict';
if(window.__JLYWorkScheduleDmNpcSectionsInitialized)return;
window.__JLYWorkScheduleDmNpcSectionsInitialized=true;
const norm=v=>String(v||'').trim().toLowerCase();
function kindFromName(name){const n=norm(name);if(n==='dm'||/(^|\s|[-_])dm($|\s|[-_])/.test(n)||n.includes('主持'))return'dm';if(n==='npc'||/(^|\s|[-_])npc($|\s|[-_])/.test(n))return'npc';return'other'}
function roleName(el){const strong=el.querySelector('strong');return String(strong?.childNodes?.[0]?.textContent||strong?.textContent||'').replace(/\(\d+\)\s*$/,'').trim()}
function sectionize(host,selector){if(!host)return;const items=[...host.querySelectorAll(`:scope > ${selector}`)];if(!items.length)return;host.querySelectorAll(':scope > .work-role-section-title').forEach(x=>x.remove());items.forEach(el=>el.dataset.staffKind=kindFromName(roleName(el)));const order={dm:0,npc:1,other:2};items.sort((a,b)=>order[a.dataset.staffKind]-order[b.dataset.staffKind]).forEach(el=>host.appendChild(el));let last='';for(const el of items){const kind=el.dataset.staffKind;if(kind===last)continue;last=kind;const title=document.createElement('div');title.className=`work-role-section-title is-${kind}`;title.textContent=kind==='dm'?'🎭 DM':kind==='npc'?'🎬 NPC':'其他工作人員';host.insertBefore(title,el)}}
function protectBatch(){const dlg=document.getElementById('staffBatchDialog');if(!dlg||dlg.dataset.dmNpcGuard==='1')return;const role=document.getElementById('staffBatchRole'),apply=document.getElementById('staffBatchApply');if(!role||!apply)return;dlg.dataset.dmNpcGuard='1';const update=()=>{const kind=kindFromName(role.options[role.selectedIndex]?.textContent||'');dlg.dataset.staffKind=kind;apply.textContent=kind==='dm'?'套用到已選日期的 DM':kind==='npc'?'套用到已選日期的 NPC':'套用到已選日期'};role.addEventListener('change',update);update();apply.addEventListener('click',e=>{const kind=dlg.dataset.staffKind;if(!['dm','npc'].includes(kind))return;const dates=dlg.querySelectorAll('#staffBatchDates input[type="checkbox"]:checked');if(!dates.length){e.preventDefault();e.stopImmediatePropagation();alert(`請先選擇要修改 ${kind.toUpperCase()} 的日期。`);return}const label=document.getElementById('staffBatchLabelEnabled')?.checked,person=document.getElementById('staffBatchPersonEnabled')?.checked;if(!label&&!person){e.preventDefault();e.stopImmediatePropagation();alert(`尚未勾選要修改的 ${kind.toUpperCase()} 欄位內容。`) }},true)}
let observing=false;
const observer=new MutationObserver(()=>refresh());
function observe(){if(observing)return;observer.observe(document.body,{childList:true,subtree:true});observing=true}
function refresh(){if(observing){observer.disconnect();observing=false}try{document.querySelectorAll('.role-summary-list').forEach(h=>sectionize(h,'.role-summary'));sectionize(document.getElementById('groupDetailRoles'),'.staff-role-card');protectBatch()}finally{observe()}}
function init(){refresh()}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();