(function(){
'use strict';
if(window.__JLYWorkScheduleDateSearchInitialized)return;window.__JLYWorkScheduleDateSearchInitialized=true;
const $=id=>document.getElementById(id),form=$('scheduleDateSearch'),input=$('scheduleDateQuery'),clear=$('scheduleDateClear'),host=$('scheduleDashboard'),title=$('scheduleResultsTitle'),V=window.JLYWorkScheduleReadView;if(!form||!input||!host||!V)return;
if(clear){clear.textContent='×';clear.setAttribute('aria-label','清除班表搜尋');clear.hidden=!input.value}
const pad=n=>String(n).padStart(2,'0'),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let currentFilter=null,currentView='all',identityIds=new Set();
function validMonth(m){return Number.isInteger(m)&&m>=1&&m<=12}
function validDate(y,m,d){const checkYear=y||2000,dt=new Date(checkYear,m-1,d);return validMonth(m)&&dt.getMonth()===m-1&&dt.getDate()===d&&(!y||dt.getFullYear()===y)}
function parseFilter(raw){
  const original=String(raw||'').trim();
  if(!original)return null;
  const normalized=original.replace(/[.\-]/g,'/').replace(/\s+/g,'');
  let match=normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if(match){const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);if(validDate(year,month,day))return{type:'date',year,month,day,monthText:pad(month),dayText:pad(day),explicitYear:true,label:`${year}/${month}/${day}`}}
  match=normalized.match(/^(\d{1,2})\/(\d{1,2})$/);
  if(match){const month=Number(match[1]),day=Number(match[2]);if(validDate(null,month,day))return{type:'date',year:null,month,day,monthText:pad(month),dayText:pad(day),explicitYear:false,label:`${month}/${day}`}}
  match=normalized.match(/^(\d{4})\/(\d{1,2})月?$/);
  if(match){const year=Number(match[1]),month=Number(match[2]);if(validMonth(month))return{type:'month',year,month,monthText:pad(month),explicitYear:true,label:`${year}/${month}`}}
  match=normalized.match(/^(\d{1,2})月$/);
  if(match){const month=Number(match[1]);if(validMonth(month))return{type:'month',year:null,month,monthText:pad(month),explicitYear:false,label:`${month} 月`}}
  return{type:'keyword',keyword:original.toLowerCase(),label:original};
}
function idsOf(r){return(r.assignedPersonIds||r.personIds||[]).map(String)}function personName(id,r){const p=(r.people||[]).find(x=>String(x.personId||x.id)===String(id));return p?.name||'未命名'}
async function resolveMe(){try{const i=window.JLYIdentity,p=i?.getCurrentPlayerProfileId?.();if(p&&i.syncFromPlayerProfile)await i.syncFromPlayerProfile(window.db||firebase.firestore(),p);identityIds=new Set((i?.getAllPlayerIdentityIds?.()||[]).map(String))}catch(_){identityIds=new Set()}}
async function applyView(rows){if(currentView!=='mine')return rows.slice();if(!identityIds.size)await resolveMe();return rows.filter(r=>idsOf(r).some(id=>identityIds.has(id)))}
function groupRows(source){const map=new Map();source.forEach(r=>{const key=[r.date,r.workId||r.workName,r.startTime,r.endTime,r.studioName||''].join('|');if(!map.has(key))map.set(key,{key,date:r.date,workName:r.workName||'未命名工作',studioName:r.studioName||'',hostName:r.hostName||'',startTime:r.startTime||'',endTime:r.endTime||'',endDate:r.endDate||r.date,rows:[]});const g=map.get(key);g.rows.push(r);if(!g.hostName&&r.hostName)g.hostName=r.hostName});return[...map.values()].sort((a,b)=>(a.date+a.startTime+a.workName).localeCompare(b.date+b.startTime+b.workName))}
function timeText(g){if(!g.endTime)return`${g.startTime}（預設 1 小時）`;return`${g.startTime}–${g.endDate!==g.date?'翌日 ':''}${g.endTime}`}
function publishDisplayScope(rows,mode){window.JLYWorkScheduleDisplayScope={source:'date-search',mode,monthKey:null,rows:Array.isArray(rows)?rows.slice():[]};window.dispatchEvent(new CustomEvent('jly:work-schedule:display-scope',{detail:window.JLYWorkScheduleDisplayScope}))}
function renderRows(rows,emptyText,mode='default'){const groups=groupRows(rows);if(!groups.length){host.innerHTML=`<div class="empty">${esc(emptyText||'目前沒有可顯示的班表。')}</div>`;publishDisplayScope(rows,mode);return}host.innerHTML=groups.map(g=>{const year=Number(g.date.slice(0,4)),roles=g.rows.map(r=>{const names=idsOf(r).map(id=>personName(id,r));return`<div class="role-summary"><strong>${esc(r.roleName||'未設定角色')} <small>(${names.length})</small></strong><span>${names.slice(0,4).map(esc).join('、')||'尚未排人'}${names.length>4?` <b>＋${names.length-4}</b>`:''}</span>${Number(r.missingCount||0)?`<em>尚缺 ${Number(r.missingCount||0)}</em>`:''}</div>`}).join(''),synced=g.rows.filter(r=>r.calendar?.eventId).length;return`<article class="work-day-card date-search-result" data-group="${esc(g.key)}"><div class="work-day-top"><label class="batch-check"><input type="checkbox" data-select-group="${esc(g.key)}"><span></span></label><button type="button" class="group-main" data-open-group="${esc(g.key)}"><div class="group-date">${year} 年 ${Number(g.date.slice(5,7))}/${Number(g.date.slice(8,10))}　${esc(timeText(g))}</div><div class="group-title">${esc(g.workName)}${g.hostName?`｜主揪：${esc(g.hostName)}`:''}</div>${g.studioName?`<div class="group-meta">${esc(g.studioName)}</div>`:''}</button></div><div class="role-summary-list">${roles}</div><div class="compact-actions"><button type="button" data-open-group="${esc(g.key)}">詳細</button><button type="button" data-sync-group="${esc(g.key)}">${synced===g.rows.length&&g.rows.length?'Google ✓':'同步 Google'}</button></div></article>`}).join('');publishDisplayScope(rows,mode)}
function rowSearchText(row){return[
  row.workName,row.studioName,row.hostName,row.roleName,row.note,row.date,row.startTime,row.endTime,
  ...(row.people||[]).map(p=>p?.name),...(row.assignedPersonNames||[])
].map(v=>String(v||'').toLowerCase()).join(' ')}
async function allActiveRows(){const keys=await V.loadMonthIndex(),monthRows=await Promise.all(keys.map(k=>V.loadMonth(k)));return monthRows.flat().filter(r=>r.status!=='cancelled')}
async function search(filter){
  currentFilter=filter;host.innerHTML='<div class="empty">搜尋班表中…</div>';let rows=[];
  if(filter.type==='date'){
    if(filter.explicitYear){const mk=`${filter.year}-${filter.monthText}`,date=`${mk}-${filter.dayText}`;rows=(await V.loadMonth(mk)).filter(r=>r.status!=='cancelled'&&r.date===date)}
    else{const keys=await V.loadMonthIndex(),months=keys.filter(k=>String(k).endsWith(`-${filter.monthText}`));const monthRows=await Promise.all(months.map(k=>V.loadMonth(k)));rows=monthRows.flat().filter(r=>r.status!=='cancelled'&&String(r.date||'').slice(5)===`${filter.monthText}-${filter.dayText}`)}
    rows=await applyView(rows);
    if(title)title.textContent=filter.explicitYear?`🔍 ${filter.label} 班表`:`🔍 所有年份 ${filter.label} 班表`;
    renderRows(rows,`找不到 ${filter.label} 的班表。`,'search');return;
  }
  if(filter.type==='month'){
    if(filter.explicitYear)rows=(await V.loadMonth(`${filter.year}-${filter.monthText}`)).filter(r=>r.status!=='cancelled');
    else{const keys=await V.loadMonthIndex(),months=keys.filter(k=>String(k).endsWith(`-${filter.monthText}`));const monthRows=await Promise.all(months.map(k=>V.loadMonth(k)));rows=monthRows.flat().filter(r=>r.status!=='cancelled')}
    rows=await applyView(rows);
    if(title)title.textContent=filter.explicitYear?`🔍 ${filter.label} 班表`:`🔍 所有年份 ${filter.label}班表`;
    renderRows(rows,`找不到 ${filter.label}的班表。`,'search');return;
  }
  rows=(await allActiveRows()).filter(r=>rowSearchText(r).includes(filter.keyword));rows=await applyView(rows);
  if(title)title.textContent=`🔍 「${filter.label}」搜尋結果`;
  renderRows(rows,`找不到包含「${filter.label}」的班表。`,'search');
}
async function loadDefault(){currentFilter=null;if(title)title.textContent='';host.innerHTML='<div class="empty">正在讀取全部班表…</div>';const rows=await applyView(await allActiveRows());renderRows(rows,currentView==='mine'?'目前沒有你的排班。':'目前沒有排班。','default')}
async function refresh(){return currentFilter?search(currentFilter):loadDefault()}async function clearFilter(){input.value='';if(clear)clear.hidden=true;await loadDefault()}
function setView(next){currentView=next==='mine'?'mine':'all';document.querySelectorAll('[data-dashboard-view]').forEach(b=>b.classList.toggle('active',b.dataset.dashboardView===currentView));window.JLYWorkScheduleDisplayScope=null;refresh().catch(err=>{console.error('[WorkScheduleDateSearch view]',err);host.innerHTML=`<div class="empty">班表讀取失敗：${esc(err.message||err)}</div>`})}
input.addEventListener('input',()=>{if(clear)clear.hidden=!input.value.trim()});form.addEventListener('submit',e=>{e.preventDefault();const filter=parseFilter(input.value);if(!filter){loadDefault();return}search(filter).catch(err=>{console.error('[WorkScheduleDateSearch]',err);host.innerHTML=`<div class="empty">搜尋失敗：${esc(err.message||err)}</div>`})});clear?.addEventListener('click',()=>clearFilter());
document.querySelectorAll('[data-dashboard-view]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();setView(b.dataset.dashboardView)},true));
window.JLYWorkScheduleDateSearch={refresh,loadDefault,searchCurrent:()=>currentFilter?search(currentFilter):loadDefault(),parseFilter};
const extra=document.createElement('script');extra.src='/js/modules/work-schedule/work-schedule-batch-v2.js?v=1';document.body.appendChild(extra);loadDefault().catch(err=>{console.error('[WorkScheduleDateSearch default]',err);host.innerHTML='<div class="empty">班表讀取失敗，請稍後再試。</div>'});
})();
