(function(){
'use strict';
const $=id=>document.getElementById(id);
const txt=v=>String(v??'').trim();
let context=null;
let view='all';
let selected=new Set();

function studio(){return txt(new URLSearchParams(location.search).get('studio'))}
function html(v){return txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function groupKey(r){return[r.date,r.workId||r.workName,r.startTime,r.endTime,r.studioName].join('|')}
function rows(){return (context?.rows||[]).filter(r=>view==='all'||r.isMine)}
function groups(){
  const map=new Map();
  rows().forEach(r=>{const key=groupKey(r);if(!map.has(key))map.set(key,{key,first:r,rows:[]});map.get(key).rows.push(r)});
  return [...map.values()];
}
function formatPeople(group){
  return group.rows.map(r=>{const names=(r.people||[]).map(p=>p.name).filter(Boolean).join('、');return `${r.roleName||'工作人員'}：${names||'尚未排人'}`}).join('｜');
}
function render(){
  $('staffStudioTitle').textContent=context?.studioName?`${context.studioName}｜工作室班表`:'工作室班表';
  $('staffIdentity').textContent=context?.displayName?`LINE：${context.displayName}`:'';
  document.querySelectorAll('[data-staff-view]').forEach(b=>b.classList.toggle('active',b.dataset.staffView===view));
  $('staffMineActions').hidden=view!=='mine';
  const host=$('staffSchedule');
  const list=groups();
  if(!list.length){host.innerHTML='<div class="card">目前沒有可顯示的排班。</div>';return}
  host.innerHTML=list.map(g=>{
    const r=g.first;
    const mine=g.rows.some(x=>x.isMine);
    const selectable=view==='mine'&&mine;
    const checked=selectable&&g.rows.filter(x=>x.isMine).every(x=>selected.has(x.id));
    return `<article class="card staff-shift-card">
      <div class="staff-shift-head">${selectable?`<label><input type="checkbox" data-group="${html(g.key)}" ${checked?'checked':''}> 選取</label>`:''}<strong>${html(r.date)} ${html(r.startTime)}–${html(r.endTime)}</strong></div>
      <h3>${html(r.workName||'未命名工作')}${r.hostName?`｜主揪：${html(r.hostName)}`:''}</h3>
      <p>${html(formatPeople(g))}</p>
      ${mine?'<small>✓ 有你的班</small>':''}
    </article>`;
  }).join('');
  host.querySelectorAll('[data-group]').forEach(input=>input.onchange=()=>{
    const g=groups().find(x=>x.key===input.dataset.group);
    if(!g)return;
    g.rows.filter(r=>r.isMine).forEach(r=>input.checked?selected.add(r.id):selected.delete(r.id));
  });
}

async function load(){
  const s=studio();
  if(!s){showError('這個分享連結缺少工作室資訊。');return}
  const response=await fetch(`/api/work-schedule-staff-context?studio=${encodeURIComponent(s)}`,{credentials:'same-origin'});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){showLogin();return}
  if(response.status===403){
    showError(data.error==='person_link_required'
      ? 'LINE 已驗證，但尚未綁定正式 JLY Person。請先完成既有 JLY 身分綁定後再開啟班表。'
      : '這個 LINE 身分目前不是此工作室成員，無法查看班表。');
    return;
  }
  if(!response.ok||!data.success){showError(`讀取班表失敗：${data.error||response.status}`);return}
  context=data;
  $('staffGate').hidden=true;
  $('staffApp').hidden=false;
  render();
}
function showLogin(){
  $('staffGate').hidden=false;
  $('staffApp').hidden=true;
  $('staffGate').innerHTML='<div class="card"><h2>先用 LINE 確認身分</h2><p>登入後會確認你是否為這個工作室的成員。班表是唯讀的，不會讓一般員工修改排班。</p><button id="staffLineLogin" type="button">LINE 登入</button></div>';
  $('staffLineLogin').onclick=()=>window.JLYLineLogin.start({returnPath:location.pathname+location.search,returnUrl:location.href,purpose:'work_schedule_staff_entry'}).catch(e=>alert(e.message||e));
}
function showError(message){
  $('staffGate').hidden=false;
  $('staffApp').hidden=true;
  $('staffGate').innerHTML=`<div class="card"><h2>目前無法開啟班表</h2><p>${html(message)}</p></div>`;
}

async function eventIdForShift(shiftId){
  const bytes=new TextEncoder().encode(`jly-work-staff:${shiftId}`);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hex=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  return `jlystaff${hex.slice(0,40)}`;
}
function resource(row,eventId){
  const start=`${row.date}T${row.startTime}:00+08:00`;
  const end=`${row.endDate||row.date}T${row.endTime}:00+08:00`;
  return {
    id:eventId,
    summary:`工作－${row.workName||'未命名工作'}`,
    description:[row.roleName?`角色：${row.roleName}`:'',row.hostName?`主揪：${row.hostName}`:'',row.note||'','JLY Work Schedule'].filter(Boolean).join('\n'),
    location:row.studioName||'',
    start:{dateTime:start,timeZone:'Asia/Taipei'},
    end:{dateTime:end,timeZone:'Asia/Taipei'},
    extendedProperties:{private:{source:'JLY',sourceModule:'work-schedule-staff',shiftId:String(row.id)}}
  };
}
async function googleFetch(token,url,options={}){
  return fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})}});
}
async function upsertShift(token,row){
  const eventId=await eventIdForShift(row.id);
  const calendar='primary';
  const base=`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar)}/events`;
  const body=JSON.stringify(resource(row,eventId));
  let response=await googleFetch(token,base,{method:'POST',body});
  if(response.status===409){response=await googleFetch(token,`${base}/${encodeURIComponent(eventId)}`,{method:'PUT',body})}
  if(!response.ok){let message=`Google Calendar ${response.status}`;try{const data=await response.json();message=data?.error?.message||message}catch(_){}throw new Error(message)}
}
async function deleteShift(token,shiftId){
  const eventId=await eventIdForShift(shiftId);
  const url=`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const response=await googleFetch(token,url,{method:'DELETE'});
  if(!response.ok&&response.status!==404)throw new Error(`Google Calendar ${response.status}`);
}
async function syncSelected(){
  const own=(context?.rows||[]).filter(r=>r.isMine&&selected.has(r.id));
  if(!own.length)return alert('請先在「只看我的」勾選要匯入的班。');
  const token=await window.JLYCalendarAuth.requestAccessToken();
  let ok=0;
  for(const id of (context.cancelledOwnShiftIds||[])){try{await deleteShift(token,id)}catch(e){console.warn('取消班表同步清理失敗',id,e)}}
  for(const row of own){await upsertShift(token,row);ok++}
  alert(`已匯入／更新 ${ok} 筆自己的班到 Google Calendar。重複操作會更新同一筆，不會另外新增。`);
}

function bind(){
  document.querySelectorAll('[data-staff-view]').forEach(b=>b.onclick=()=>{view=b.dataset.staffView;selected.clear();render()});
  $('staffSelectAll').onclick=()=>{rows().filter(r=>r.isMine).forEach(r=>selected.add(r.id));render()};
  $('staffClear').onclick=()=>{selected.clear();render()};
  $('staffSync').onclick=()=>syncSelected().catch(e=>alert(`匯入失敗：${e.message||e}`));
  load().catch(e=>showError(e.message||e));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
