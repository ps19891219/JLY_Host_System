(function(){
'use strict';
const $=id=>document.getElementById(id),db=window.db||firebase.firestore();
const studio=()=>String(new URLSearchParams(location.search).get('studio')||'').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function staffUrl(){return `${location.origin}/pages/work-schedule-staff.html?studio=${encodeURIComponent(studio())}`}
async function copy(){try{await navigator.clipboard.writeText(staffUrl());alert('已複製員工班表連結。')}catch(_){prompt('複製這個員工班表連結：',staffUrl())}}
async function loadMembers(){const host=$('staffMembers'),key=studio();if(!key){host.innerHTML='<p>缺少工作室資訊。</p>';return}try{const snap=await db.collection('studioMemberships').where('studioId','==',key).get();const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.displayName||a.name||a.personId||'').localeCompare(String(b.displayName||b.name||b.personId||''),'zh-Hant'));if(!rows.length){host.innerHTML='<p>目前還沒有工作室員工。員工完成 LINE 身分認領後會建立工作室成員關係。</p>';return}host.innerHTML=rows.map(r=>{const name=r.displayName||r.name||r.personName||r.personId||r.memberId||'未命名員工';const roles=Array.isArray(r.roles)?r.roles.join('／'):(r.role||r.roleName||'尚未設定角色');const active=r.active!==false&&r.status!=='inactive'&&r.status!=='disabled';const line=r.lineSub||r.lineUserId?'LINE 已綁定':'等待 LINE 綁定';return `<div class="card" style="margin:10px 0"><strong>${esc(name)}</strong><p>${esc(roles)}｜${esc(line)}｜${active?'啟用中':'已停用'}</p></div>`}).join('')}catch(e){console.error(e);host.innerHTML=`<p>員工資料讀取失敗：${esc(e.message||e)}</p>`}}
function init(){$('copyStaffLink').onclick=copy;$('openStaffLink').onclick=()=>location.href=staffUrl();loadMembers()}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
