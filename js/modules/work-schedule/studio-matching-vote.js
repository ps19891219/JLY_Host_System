(function(){'use strict';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),id=params.get('id'),testMode=params.get('testMode')==='1';
let matching=null,authenticated=false,viewer=null,response=null;
function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function login(){if(!window.JLYLineLogin)return alert('LINE 登入模組尚未載入，請重新整理後再試。');return window.JLYLineLogin.start({returnPath:location.pathname+location.search,returnUrl:location.href,purpose:'studio_matching_vote'}).catch(e=>alert(e.message||e))}
function renderIdentity(){
 const h=$('voteIdentity');if(!h)return;
 if(testMode){h.innerHTML='<div class="studio-vote-identity">🧪 測試模式</div><label>測試姓名<input id="voteTestName" placeholder="輸入姓名即可測試後續流程"></label>';return}
 if(authenticated&&viewer){h.innerHTML='<div class="studio-vote-identity">LINE：<strong>'+esc(viewer.displayName||'已登入')+'</strong></div>';return}
 h.innerHTML='<div class="studio-vote-identity">請先用 LINE 確認員工身分</div><button id="voteLineLogin" type="button" style="width:100%;">LINE 登入</button>';
 $('voteLineLogin').onclick=login;
}
function applyExistingResponse(){if(!response||!Array.isArray(response.slotIds))return;const chosen=new Set(response.slotIds.map(String));document.querySelectorAll('[data-slot]').forEach(x=>{x.checked=chosen.has(String(x.dataset.slot))})}
async function load(){
 $('voteSlots').textContent='正在連線媒合資料…';if(!id){$('voteSlots').textContent='網址缺少媒合 ID';return}
 const q='/api/studio-matching-vote-context?id='+encodeURIComponent(id)+(testMode?'&testMode=1':'');
 let r;try{r=await fetch(q,{credentials:'same-origin',cache:'no-store'})}catch(e){throw new Error('媒合資料連線失敗，請重新整理後再試：'+(e.message||e))}
 const raw=await r.text();let d;try{d=JSON.parse(raw)}catch(_){throw new Error('API 回傳格式錯誤 HTTP '+r.status)}
 if(!r.ok||!d.success)throw new Error(d.error||'讀取失敗');
 matching=d.matching;authenticated=d.authenticated===true;viewer=d.viewer||null;response=d.response||null;
 $('voteTitle').textContent=matching.workName||matching.title||'配合時間';
 $('voteHost').innerHTML=matching.hostName?'<div class="studio-vote-host">主揪：<strong>'+esc(matching.hostName)+'</strong></div>':'';
 $('voteSlots').innerHTML=(matching.candidateSlots||[]).map(s=>'<label class="studio-vote-slot"><input type="checkbox" data-slot="'+esc(s.id)+'"><span>'+esc(s.date+' '+s.time)+'</span></label>').join('')||'<div>目前沒有候選時段。</div>';
 renderIdentity();applyExistingResponse();
}
async function submit(){
 if(!id)return;
 if(!testMode&&!authenticated)return login();
 const slotIds=[...document.querySelectorAll('[data-slot]:checked')].map(x=>x.dataset.slot),b=$('voteSubmit');b.disabled=true;
 try{
  const payload={id,slotIds};
  if(testMode){const input=$('voteTestName'),name=String(input&&input.value||'').trim();if(!name)throw new Error('測試期間請輸入姓名。');payload.testMode='1';payload.testName=name}
  const r=await fetch('/api/studio-matching-vote-context',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),d=await r.json().catch(()=>({}));
  if(!r.ok||!d.success){if(r.status===401&&!testMode){await login();return}throw new Error(d.error||'送出失敗')}
  response=d.response||response;alert(testMode?'已送出配合時間（測試模式）。':'已送出配合時間。');
 }catch(e){alert('送出失敗：'+(e.message||e))}finally{b.disabled=false}
}
$('voteSubmit').onclick=submit;load().catch(e=>{$('voteSlots').textContent='讀取失敗：'+(e.message||e);renderIdentity()});
})();