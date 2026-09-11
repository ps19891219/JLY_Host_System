"use strict";
(function(){
function text(v){return String(v==null?"":v).trim();}
function params(){return new URLSearchParams(location.search);}
function carId(){return text(params().get("id"));}
function entry(){return text(params().get("entry")).toLowerCase()==="dm"?"dm":"player";}
function isGroupEntry(){return text(params().get("source")).toLowerCase()==="line_group";}
function active(item){const status=text(item&&item.status).toLowerCase();return !["cancelled","canceled","已取消","取消","rejected","拒絕"].includes(status);}
function playerCapacity(car){const value=Number(car&&(car.totalPeople||car.capacity||0));return Number.isFinite(value)&&value>0?value:0;}
function isPlayerFull(car){const capacity=playerCapacity(car);const players=Array.isArray(car&&car.players)?car.players.filter(active):[];return capacity>0&&players.length>=capacity;}
function hasNewDmSlot(car){const slots=Array.isArray(car&&car.staffSlots)?car.staffSlots.filter(active):[];if(!slots.length)return true;return slots.some(slot=>!text(slot&&(slot.displayName||slot.playerName||slot.name||slot.nickname||slot.staffName||slot.dmName)));}
function actionHost(){
  const old=document.querySelector("a.car-view-join-button");
  if(old){let host=document.getElementById("car-view-entry-actions");if(!host){host=document.createElement("div");host.id="car-view-entry-actions";old.parentNode.insertBefore(host,old);}old.remove();return host;}
  let host=document.getElementById("car-view-entry-actions");
  if(host)return host;
  const container=document.getElementById("car-view-content");
  if(!container)return null;
  host=document.createElement("div");host.id="car-view-entry-actions";host.className="car-view-entry-actions";container.appendChild(host);return host;
}
async function login(kind){try{const p=params();p.set("entry",kind==="dm"?"dm":"player");const response=await fetch("/api/line-login-state",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({playerProfileId:text(localStorage.getItem("currentPlayerProfileId")),identityId:text(localStorage.getItem("currentPlayerId")),returnPath:location.pathname+"?"+p.toString(),purpose:kind==="dm"?"car_dm_entry":"car_player_entry"})});const data=await response.json();if(!response.ok||!data?.state)throw new Error(data?.error||"login_state_failed");const oauth=new URLSearchParams({response_type:"code",client_id:"2010653666",redirect_uri:`${location.origin}/pages/line-callback.html`,state:data.state,scope:"openid profile"});location.assign(`https://access.line.me/oauth2/v2.1/authorize?${oauth.toString()}`);return true;}catch(error){console.error("車團報名 LINE OAuth 啟動失敗：",error);alert(`LINE 身分確認無法啟動：${error?.message||"請稍後再試"}`);return false;}}
async function loadContext(){const response=await fetch(`/api/car-view-context?id=${encodeURIComponent(carId())}`,{credentials:"same-origin",cache:"no-store"});const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||"讀取報名狀態失敗");return result;}
function button(host,label,handler,disabled){const b=document.createElement("button");b.type="button";b.className="car-view-entry-button";b.textContent=label;b.disabled=!!disabled;if(handler)b.addEventListener("click",handler);host.appendChild(b);return b;}
function note(host,value){const p=document.createElement("p");p.className="car-view-entry-note";p.textContent=value;host.appendChild(p);}
function rosterSelect(host,label,items,formatter){const row=document.createElement("div");row.className="car-view-entry-form";const select=document.createElement("select");select.setAttribute("aria-label",label);const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="請選擇你的名字";placeholder.disabled=true;placeholder.selected=true;select.appendChild(placeholder);items.forEach(item=>{const o=document.createElement("option");o.value=text(item.id);o.textContent=formatter(item);select.appendChild(o);});row.appendChild(select);host.appendChild(row);return select;}
function friendlyError(code){const value=text(code);if(value==="player_capacity_full")return "目前已滿，暫停新增報名。若你已在主揪名單中，請改用名單認領。";if(value==="dm_capacity_full")return "目前沒有可用的新增 DM／工作人員席位。若你已在名單中，請改用既有席位認領。";if(value==="player_claim_unavailable")return "這個玩家名額目前已無法認領，請重新整理後再確認。";if(value==="staff_slot_unavailable")return "這個 DM／工作人員席位目前已無法認領，請重新整理後再確認。";return value||"報名失敗";}
async function submit(payload,host){const controls=host.querySelectorAll("button,select,input");controls.forEach(x=>x.disabled=true);try{const response=await fetch("/api/car-view-context",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({carId:carId(),...payload})});const result=await response.json();if(response.status===401){const started=await login(payload.type);if(!started)controls.forEach(x=>x.disabled=false);return;}if(!response.ok||!result.success)throw new Error(friendlyError(result.error));await renderActions();}catch(error){alert(error?.message||"報名失敗");controls.forEach(x=>x.disabled=false);}}
function positionForm(host){const row=document.createElement("div");row.className="car-view-entry-form";const select=document.createElement("select");select.setAttribute("aria-label","玩家報名位置");["男位","女位","不限"].forEach(value=>{const o=document.createElement("option");o.value=value;o.textContent=value;select.appendChild(o);});const label=document.createElement("label");const cross=document.createElement("input");cross.type="checkbox";label.appendChild(cross);label.appendChild(document.createTextNode(" 我是反串"));row.appendChild(select);row.appendChild(label);host.appendChild(row);return{select,cross};}
function submitNewPlayer(host,pos){return submit({type:"player",targetPlayerId:"",position:pos.select.value,isCrossPlay:pos.cross.checked},host);}
function renderPlayer(host,viewer,car){
  if(viewer.playerStatus==="joined"){button(host,"✅ 你已加入這台車",null,true);return;}
  if(viewer.playerStatus==="pending"){button(host,"🟡 玩家身分申請等待主揪審核中",null,true);return;}
  if(!viewer.authenticated){button(host,"🎮 使用 LINE 身分繼續報名",()=>login("player"));note(host,"車團資訊可直接查看，送出報名時才需要確認 LINE 身分。");return;}
  const full=isPlayerFull(car);
  if(isGroupEntry()){
    const people=Array.isArray(viewer.playerClaimablePeople)?viewer.playerClaimablePeople:[];
    if(people.length){note(host,"如果主揪已經先把你加入名單，請選擇自己的名字。認領既有人員不會再占一個名額。");const select=rosterSelect(host,"玩家身分選擇",people,p=>`我是 ${text(p.displayName)}`);button(host,"🎮 認領名單中的我",()=>{if(!select.value){alert("請先選擇你的名字。");return;}submit({type:"player",targetPlayerId:select.value},host);});}
    else{note(host,"目前沒有可認領的既有玩家名字。");}
    const pos=positionForm(host);
    if(full){note(host,"目前已滿，暫停新增報名。已在主揪名單中的玩家仍可使用上方認領。");button(host,"目前已滿，暫停新增報名",null,true);}
    else{note(host,"不在主揪名單中？可另外送出新的玩家報名。");button(host,"🎮 新增玩家報名",()=>submitNewPlayer(host,pos));}
    return;
  }
  const pos=positionForm(host);
  note(host,"公開揪團報名不顯示主揪後台人員名單。");
  if(full){button(host,"目前已滿，暫停新增報名",null,true);return;}
  button(host,"🎮 我要報名",()=>submitNewPlayer(host,pos));
}
function renderDm(host,viewer,car){
  if(viewer.dmStatus==="joined"){button(host,"✅ 你已是本場工作人員",null,true);return;}
  if(viewer.dmStatus==="pending"){button(host,"🟡 DM 身分申請等待主揪審核中",null,true);return;}
  if(!viewer.authenticated){button(host,"🎭 使用 LINE 身分繼續 DM 申請",()=>login("dm"));return;}
  const canAdd=hasNewDmSlot(car);
  if(isGroupEntry()){
    const slots=Array.isArray(viewer.dmClaimableSlots)?viewer.dmClaimableSlots:[];
    if(slots.length){note(host,"如果主揪已經先把你加入工作人員名單，請選擇自己的名字。認領既有席位不會新增工作人員。");const select=rosterSelect(host,"DM 身分選擇",slots,s=>`我是 ${text(s.displayName)}${text(s.label)?`（${text(s.label)}）`:""}`);button(host,"🎭 認領名單中的我",()=>{if(!select.value){alert("請先選擇你的名字。");return;}submit({type:"dm",targetStaffId:select.value},host);});}
    else{note(host,"目前沒有可認領的既有 DM／工作人員名字。");}
    if(canAdd){note(host,"不在名單中？可送出新的 DM／工作人員申請。");button(host,"🎭 新增 DM／工作人員申請",()=>submit({type:"dm",targetStaffId:""},host));}
    else{note(host,"目前沒有可用的新增 DM／工作人員席位。已在名單中的人仍可使用上方認領。");button(host,"目前暫停新增 DM／工作人員",null,true);}
    return;
  }
  note(host,"公開頁不顯示主揪後台 DM／工作人員名單。");
  if(!canAdd){button(host,"目前暫停新增 DM／工作人員",null,true);return;}
  button(host,"🎭 送出 DM 申請",()=>submit({type:"dm",targetStaffId:""},host));
}
async function renderActions(){if(!carId())return;const host=actionHost();if(!host)return;host.innerHTML="";try{const context=await loadContext();const viewer=context.viewer||{authenticated:false,playerStatus:"available",dmStatus:"available"};entry()==="dm"?renderDm(host,viewer,context.car||{}):renderPlayer(host,viewer,context.car||{});}catch(error){note(host,error?.message||"無法讀取報名狀態");}}
function observe(){const container=document.getElementById("car-view-content");if(!container)return;new MutationObserver(()=>{if(!document.getElementById("car-view-entry-actions"))renderActions();else if(document.querySelector("a.car-view-join-button"))renderActions();}).observe(container,{childList:true,subtree:true});renderActions();}
document.addEventListener("DOMContentLoaded",observe);window.JLYCarViewActions={render:renderActions,submit,login,isGroupEntry};
})();