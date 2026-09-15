(function () {
  "use strict";
  let state = null;
  let mode = "available";
  const carId = new URLSearchParams(location.search).get("id") || "";
  const app = () => document.getElementById("matchingVoteApp");
  const esc = value => String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
  function formatDate(key) { const d=new Date(`${key}T00:00:00`); if(Number.isNaN(d.getTime())) return key; return `${d.getMonth()+1}/${d.getDate()}（${["日","一","二","三","四","五","六"][d.getDay()]}）`; }
  function slots() { return (state?.matching?.candidateSlots || []).filter(s=>s&&s.enabled!==false&&s.id&&s.date&&s.time).sort((a,b)=>`${a.date}|${a.time}`.localeCompare(`${b.date}|${b.time}`)); }
  function error(message){ app().innerHTML=`<section class="matching-vote-card"><div class="matching-vote-error">${esc(message)}</div></section>`; }
  async function login(){
    try {
      const returnPath=location.pathname+location.search;
      const r=await fetch("/api/line-login-state",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({playerProfileId:localStorage.getItem("currentPlayerProfileId")||"",identityId:localStorage.getItem("currentPlayerId")||"",returnPath,purpose:"car_player_entry"})});
      const data=await r.json(); if(!r.ok||!data.state) throw new Error(data.error||"login_state_failed");
      const oauth=new URLSearchParams({response_type:"code",client_id:"2010653666",redirect_uri:`${location.origin}/pages/line-callback.html`,state:data.state,scope:"openid profile"});
      location.assign(`https://access.line.me/oauth2/v2.1/authorize?${oauth.toString()}`);
    } catch(e){ alert(`LINE 身分確認無法啟動：${e.message||"請稍後再試"}`); }
  }
  function renderLogin(){
    app().innerHTML=`<section class="matching-vote-card"><div class="matching-vote-status">公開時間媒合</div><h2 class="matching-vote-title">使用 LINE 身分填寫時間</h2><p class="matching-vote-description">不需要先在車團名單中。LINE 登入後，就可以查看主揪開放的時間並送出自己的可行時段。</p><button type="button" id="matchingLineLogin" class="matching-vote-submit">使用 LINE 登入</button></section>`;
    document.getElementById("matchingLineLogin").addEventListener("click",login);
  }
  function renderForm(){
    if(state.matching.status!=="published") return error("這份時間媒合尚未開放。");
    const all=slots(); if(!all.length) return error("目前沒有可填寫的候選時段。");
    const existing=state.response||null; mode=existing?.availabilityMode==="exclude"?"exclude":"available";
    const selected=new Set(existing?.slotIds||[]); const groups={}; all.forEach(s=>(groups[s.date]||(groups[s.date]=[])).push(s));
    const checked = s => selected.has(s.id);
    app().innerHTML=`<section class="matching-vote-card"><div class="matching-vote-status">${existing?"修改回覆":"填寫時間"}</div><div class="matching-vote-player-summary"><div><small>LINE 身分</small><strong>${esc(state.viewer?.displayName||"LINE 使用者")}</strong></div></div><div class="matching-vote-mode-section"><div class="matching-vote-mode-label">你想怎麼填時間？</div><div class="matching-vote-mode-buttons"><button type="button" class="matching-vote-mode-button ${mode==="available"?"is-active":""}" data-mode="available"><strong>🟢 標記我可以</strong><small>我只有少數時間可以</small></button><button type="button" class="matching-vote-mode-button ${mode==="exclude"?"is-active":""}" data-mode="exclude"><strong>🔴 排除我不行</strong><small>我大部分時間都可以</small></button></div></div><h2 id="matchingVoteModeTitle" class="matching-vote-title">${mode==="exclude"?"請勾選你不行的時間":"請勾選你可以的時間"}</h2><p id="matchingVoteModeDescription" class="matching-vote-description">${mode==="exclude"?"勾選的時段代表你不行；沒有勾選的時段視為可以配合。":"勾選你可以配合的時段即可。"}</p><div class="matching-vote-days">${Object.keys(groups).sort().map(date=>`<section class="matching-vote-day"><div class="matching-vote-day-title">📅 ${formatDate(date)}</div><div class="matching-vote-slots">${groups[date].map(s=>`<label class="matching-vote-slot"><input type="checkbox" class="matching-vote-slot-checkbox" value="${esc(s.id)}" ${checked(s)?"checked":""}><span class="matching-vote-slot-icon">${esc(s.icon||"🕒")}</span><span class="matching-vote-slot-info"><span class="matching-vote-slot-main">${esc(s.label||"時段")}</span><span class="matching-vote-slot-time">${esc(s.time)}</span></span></label>`).join("")}</div></section>`).join("")}</div><button type="button" id="matchingVoteSubmitButton" class="matching-vote-submit">${existing?"更新我的回覆":"送出我的時間"}</button></section>`;
    document.querySelectorAll(".matching-vote-mode-button").forEach(b=>b.addEventListener("click",()=>switchMode(b.dataset.mode)));
    document.getElementById("matchingVoteSubmitButton").addEventListener("click",submit);
  }
  function switchMode(next){
    if(next===mode) return;
    document.querySelectorAll(".matching-vote-slot-checkbox").forEach(c=>c.checked=false);
    mode=next;
    document.querySelectorAll(".matching-vote-mode-button").forEach(b=>b.classList.toggle("is-active",b.dataset.mode===mode));
    document.getElementById("matchingVoteModeTitle").textContent=mode==="exclude"?"請勾選你不行的時間":"請勾選你可以的時間";
    document.getElementById("matchingVoteModeDescription").textContent=mode==="exclude"?"勾選的時段代表你不行；沒有勾選的時段視為可以配合。":"勾選你可以配合的時段即可。";
  }
  async function submit(){
    const button=document.getElementById("matchingVoteSubmitButton"); button.disabled=true; button.textContent="送出中…";
    const checked=[...document.querySelectorAll(".matching-vote-slot-checkbox:checked")].map(c=>c.value);
    const slotIds=checked;
    try{
      const r=await fetch("/api/matching-vote-context",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({carId,slotIds,availabilityMode:mode})}); const data=await r.json();
      if(r.status===401){ await login(); return; } if(!r.ok||!data.success) throw new Error(data.error||"送出失敗"); state.response=data.response;
      app().innerHTML=`<section class="matching-vote-card matching-vote-saved"><div class="matching-vote-saved-icon">✅</div><h2 class="matching-vote-saved-title">已收到你的時間</h2><p class="matching-vote-saved-text">${esc(state.viewer?.displayName||"你")}，主揪確認最終時間後會再通知大家。</p><button type="button" id="matchingVoteEdit" class="matching-vote-secondary">修改我的回覆</button></section>`;
      document.getElementById("matchingVoteEdit").addEventListener("click",renderForm);
    }catch(e){ alert(`送出失敗：${e.message||"未知錯誤"}`); button.disabled=false; button.textContent="送出我的時間"; }
  }
  async function load(){
    if(!carId) return error("網址缺少車團 ID。");
    try{ const r=await fetch(`/api/matching-vote-context?id=${encodeURIComponent(carId)}`,{credentials:"same-origin",cache:"no-store"}); const data=await r.json(); if(!r.ok||!data.success) throw new Error(data.error||"載入失敗"); state=data; const title=document.getElementById("matchingVoteScriptName"); if(title) title.textContent=data.car?.scriptName||"時間媒合"; data.authenticated?renderForm():renderLogin(); }catch(e){ error(e.message||"載入失敗"); }
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",load); else load();
})();