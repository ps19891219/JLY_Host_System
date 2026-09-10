(function(){
'use strict';
if(window.__JLYWorkScheduleUpcomingInitialized)return;window.__JLYWorkScheduleUpcomingInitialized=true;
const V=window.JLYWorkScheduleReadView,$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0'),monthKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
function todayIso(){const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function idsOf(r){return(r.assignedPersonIds||r.personIds||[]).map(String)}
function personName(id,r){const p=(r.people||[]).find(x=>String(x.personId||x.id)===String(id));return p?.name||'未命名'}
function gkey(r){return[r.date,r.workId||r.workName,r.startTime,r.endTime,r.studioName||''].join('|')}
function groupRows(rows){const map=new Map();for(const r of rows){const k=gkey(r);if(!map.has(k))map.set(k,{key:k,date:r.date,monthKey:r.date.slice(0,7),workName:r.workName||'未命名工作',startTime:r.startTime||'',endTime:r.endTime||'',rows:[]});map.get(k).rows.push(r)}return[...map.values()].sort((a,b)=>(a.date+a.startTime+a.workName).localeCompare(b.date+b.startTime+b.workName))}
function timeText(g){return`${g.startTime}–${g.endTime}`}
function roleText(r){const names=idsOf(r).map(id=>personName(id,r));return`<div class="upcoming-role"><strong>${esc(r.roleName||'角色')}</strong><span>${names.slice(0,4).map(esc).join('、')||'尚未排人'}${names.length>4?` ＋${names.length-4}`:''}</span></div>`}
function render(groups){const host=$('upcomingScheduleList');if(!host)return;if(!groups.length){host.innerHTML='<div class="empty">目前沒有近期班表。</div>';return}host.innerHTML=groups.slice(0,30).map(g=>{const d=new Date(`${g.date}T00:00:00`);return`<article class="upcoming-card"><div class="upcoming-main"><div class="upcoming-date"><b>${d.getFullYear()}</b>／${d.getMonth()+1}／${d.getDate()}（${'日一二三四五六'[d.getDay()]}） <span>${esc(timeText(g))}</span></div><div class="upcoming-title">${esc(g.workName)}</div>${g.rows.map(roleText).join('')}</div><button type="button" data-upcoming-month="${esc(g.monthKey)}">查看此月</button></article>`}).join('');host.querySelectorAll('[data-upcoming-month]').forEach(b=>b.onclick=async()=>{await window.JLYWorkScheduleDashboard?.reloadMonth?.(b.dataset.upcomingMonth);$('scheduleDashboard')?.scrollIntoView({behavior:'smooth',block:'start'})})}
async function load(){const host=$('upcomingScheduleList');if(!host||!V)return;host.innerHTML='<div class="empty">正在讀取近期班表…</div>';try{const start=new Date(),keys=[];start.setDate(1);for(let i=0;i<3;i++){const d=new Date(start.getFullYear(),start.getMonth()+i,1);keys.push(monthKey(d))}const chunks=await Promise.all(keys.map(k=>V.loadMonth(k).catch(()=>[]))),today=todayIso(),rows=chunks.flat().filter(r=>r.status!=='cancelled'&&String(r.date||'')>=today);render(groupRows(rows))}catch(e){host.innerHTML=`<div class="empty">近期班表讀取失敗：${esc(e.message||e)}</div>`}}
window.addEventListener('jly:work-schedule:view-rebuilt',load);
load();
})();
