(function(){
'use strict';
if(window.JLYWorkScheduleReadRenderer)return;
const txt=v=>String(v??'').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idsOf=r=>(r?.assignedPersonIds||r?.personIds||[]).map(String);
const groupKey=r=>[r.date,r.workId||r.workName,r.startTime,r.endTime,r.studioName||''].join('|');
const roleRank=name=>{const n=txt(name).toUpperCase();if(n==='DM')return 0;if(n==='NPC')return 1;return 10};
function sortRoles(rows){return(rows||[]).slice().sort((a,b)=>roleRank(a.roleName)-roleRank(b.roleName)||txt(a.roleName).localeCompare(txt(b.roleName),'zh-Hant'))}
function groups(rows){const m=new Map();(rows||[]).forEach(r=>{const k=groupKey(r);if(!m.has(k))m.set(k,{key:k,date:r.date,workId:r.workId||'',workName:r.workName||'未命名工作',startTime:r.startTime||'',endTime:r.endTime||'',endDate:r.endDate||r.date,studioName:r.studioName||'',rows:[]});m.get(k).rows.push(r)});return[...m.values()].map(g=>({...g,rows:sortRoles(g.rows)})).sort((a,b)=>(a.date+a.startTime+a.workName).localeCompare(b.date+b.startTime+b.workName))}
function nameFor(id,row){const p=(row?.people||[]).find(x=>String(x.personId||x.id)===String(id));return txt(p?.name||p?.displayName||p?.playerName)||'未命名'}
function personNameHtml(id,row,identityIds){const name=esc(nameFor(id,row));return identityIds?.has(String(id))?`<strong class="mine-person-name">${name}</strong>`:name}
function roleSummaryHtml(row,{identityIds=new Set(),highlightMine=false}={}){const ids=idsOf(row),names=ids.slice(0,4).map(id=>highlightMine?personNameHtml(id,row,identityIds):esc(nameFor(id,row))).join('、')||'尚未排人',more=ids.length>4?` <b>＋${ids.length-4}</b>`:'',missing=Number(row.missingCount||0);return`<div class="role-summary"><strong>${esc(row.roleName||'未設定角色')} <small>(${ids.length})</small></strong><span>${names}${more}</span>${missing?`<em>尚缺 ${missing}</em>`:''}</div>`}
function detailRolesHtml(rows,{identityIds=new Set(),highlightMine=false}={}){return sortRoles(rows).map(row=>{const ids=idsOf(row);return`<section class="detail-role"><div class="detail-role-head"><strong>${esc(row.roleName||'未設定角色')}</strong><span>${ids.length} 人</span></div><ol>${ids.length?ids.map(id=>`<li>${highlightMine?personNameHtml(id,row,identityIds):esc(nameFor(id,row))}</li>`).join(''):'<li>尚未排人</li>'}</ol></section>`}).join('')}
window.JLYWorkScheduleReadRenderer={esc,idsOf,groupKey,sortRoles,groups,nameFor,roleSummaryHtml,detailRolesHtml};
})();
