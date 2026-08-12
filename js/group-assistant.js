(function () {
  "use strict";
  const query = new URLSearchParams(location.search), token = query.get("token") || "";
  let context = null, pendingEntryId = "";
  const el = id => document.getElementById(id), money = value => `$${Number(value || 0).toLocaleString("zh-TW")}`;
  function showTab(name) { document.querySelectorAll(".tab-panel").forEach(node => node.classList.toggle("hidden", node.id !== name)); document.querySelectorAll("[data-tab]").forEach(node => node.classList.toggle("active", node.dataset.tab === name)); }
  function requireLogin() { if (context.currentMember) return true; el("loginPrompt").classList.remove("hidden"); return false; }
  function renderMembers() { const payer=el("payerMember"), shares=el("shareMemberList"); payer.innerHTML=""; shares.innerHTML=""; (context.members||[]).forEach(member=>{ const option=document.createElement("option"); option.value=member.memberId; option.textContent=member.displayName; payer.appendChild(option); const row=document.createElement("label"), checkbox=document.createElement("input"), name=document.createElement("span"), amount=document.createElement("input"); row.className="share-row"; checkbox.type="checkbox"; checkbox.className="share-check"; checkbox.value=member.memberId; checkbox.checked=true; name.textContent=member.displayName; amount.type="number"; amount.className="share-amount"; amount.min="1"; amount.step="1"; amount.inputMode="numeric"; amount.dataset.memberId=member.memberId; amount.setAttribute("aria-label",`${member.displayName} 分攤金額`); checkbox.addEventListener("change",()=>{amount.disabled=!checkbox.checked;distributeShares();}); row.append(checkbox,name,amount); shares.appendChild(row); }); const ids=[context.currentMember&&context.currentMember.identityId,context.currentMember&&context.currentMember.profileId]; const mine=ids.find(id=>[...payer.options].some(option=>option.value===id)); if(mine)payer.value=mine; distributeShares(); }
  function distributeShares(){const total=Math.max(0,Math.floor(Number(el("entryAmount").value)||0)),rows=[...document.querySelectorAll(".share-row")].filter(row=>row.querySelector(".share-check").checked);if(!rows.length)return;const base=Math.floor(total/rows.length);rows.forEach((row,index)=>{row.querySelector(".share-amount").value=index===rows.length-1?total-base*(rows.length-1):base;});}
  function renderBalances(items) { const list=el("memberBalances"); list.innerHTML=""; if(!items.length){list.className="list empty";list.textContent="目前沒有分帳資料";return;} list.className="list"; items.forEach(item=>{const row=document.createElement("div"),name=document.createElement("span"),amount=document.createElement("b");name.textContent=item.displayName||"成員";amount.textContent=`${item.balance>0?"應收":item.balance<0?"應付":"已結清"} ${money(Math.abs(item.balance))}`;row.append(name,amount);list.appendChild(row);}); }
  function updateShareVisibility(){const visible=el("entryType").value==="expense"&&el("splitMode").value==="now";el("shareMembers").classList.toggle("hidden",!visible);}
  function openForm(entry) { if(!requireLogin())return; pendingEntryId=entry?entry.id:""; el("formTitle").textContent=entry?"完成分帳":"新增帳目"; el("entryType").value="expense"; el("entryAmount").value=entry?entry.amount:""; el("entryDescription").value=entry?entry.description:""; el("splitMode").value=entry?"now":"later"; el("entryType").disabled=Boolean(entry); el("entryAmount").readOnly=Boolean(entry); el("entryDescription").readOnly=Boolean(entry); el("splitModeField").classList.toggle("hidden",Boolean(entry)); distributeShares(); updateShareVisibility(); el("splitForm").classList.remove("hidden"); el("splitForm").scrollIntoView({behavior:"smooth"}); }
  function closeForm(){pendingEntryId="";el("splitForm").reset();el("entryType").disabled=false;el("entryAmount").readOnly=false;el("entryDescription").readOnly=false;el("splitModeField").classList.remove("hidden");el("formStatus").textContent="";el("splitForm").classList.add("hidden");updateShareVisibility();}
  function renderPending(entries){const list=el("pendingEntries"),pending=entries.filter(entry=>entry.type==="expense"&&entry.splitStatus==="pending");list.innerHTML="";if(!pending.length){list.className="list empty";list.textContent="目前沒有待分帳項目";return;}list.className="list";pending.forEach(entry=>{const row=document.createElement("div"),text=document.createElement("span"),button=document.createElement("button");text.textContent=`${entry.description} ${money(entry.amount)}`;button.type="button";button.className="mini";button.textContent="分帳";button.addEventListener("click",()=>openForm(entry));row.append(text,button);list.appendChild(row);});}
  function render(data){context=data;el("scriptName").textContent=data.car.scriptName;el("carMeta").textContent=[data.car.date,data.car.location].filter(Boolean).join("・");el("infoContent").textContent=[data.car.date&&`日期：${data.car.date}`,data.car.location&&`地點：${data.car.location}`].filter(Boolean).join("\n")||"目前沒有其他車團資訊";el("income").textContent=money(data.accounting.totalIncome);el("expense").textContent=money(data.accounting.totalExpense);el("balance").textContent=money(data.accounting.balance);renderMembers();renderBalances(data.accounting.memberBalances||[]);renderPending(data.accounting.recentEntries||[]);}
  async function load(){try{const response=await fetch(`/api/group-assistant-context?token=${encodeURIComponent(token)}`);const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||"load_failed");render(data);el("loading").classList.add("hidden");showTab(query.get("tab")||"info");}catch(error){el("loading").classList.add("hidden");el("error").classList.remove("hidden");el("error").textContent=error.message==="binding_inactive"?"這個群組連結已失效，請重新呼喚 JLY 小助手。":"無法讀取資料，請稍後再試。";}}
  async function startLineLogin() {
    const button = el("lineLogin");
    button.disabled = true;
    button.textContent = "正在開啟 LINE 登入…";
    try {
      const returnPath = location.pathname + location.search;
      const response = await fetch("/api/line-login-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath })
      });
      const data = await response.json();
      if (!response.ok || !data.state) throw new Error("login_state_failed");
      const params = new URLSearchParams({
        response_type: "code",
        client_id: "2010653666",
        redirect_uri: `${location.origin}/pages/line-callback.html`,
        state: data.state,
        scope: "openid profile"
      });
      location.assign(`https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`);
    } catch (_error) {
      button.disabled = false;
      button.textContent = "LINE 登入";
      el("loginPrompt").firstChild.textContent = "無法開啟 LINE 登入，請重新整理後再試。";
    }
  }
  document.querySelectorAll("[data-tab]").forEach(button=>button.addEventListener("click",()=>showTab(button.dataset.tab)));
  el("createSplit").addEventListener("click",()=>openForm(null));el("cancelSplit").addEventListener("click",closeForm);el("entryType").addEventListener("change",updateShareVisibility);el("splitMode").addEventListener("change",updateShareVisibility);el("entryAmount").addEventListener("input",distributeShares);el("lineLogin").addEventListener("click",startLineLogin);
  el("splitForm").addEventListener("submit",async event=>{event.preventDefault();const status=el("formStatus"),shareItems=[...document.querySelectorAll(".share-row")].filter(row=>row.querySelector(".share-check").checked).map(row=>({memberId:row.querySelector(".share-check").value,amount:Number(row.querySelector(".share-amount").value)})),isSplitting=el("entryType").value==="expense"&&(pendingEntryId||el("splitMode").value==="now");if(isSplitting&&shareItems.reduce((sum,item)=>sum+item.amount,0)!==Number(el("entryAmount").value)){status.textContent="每人金額加總必須等於帳目總額。";return;}status.textContent="正在儲存…";const response=await fetch("/api/group-assistant-entry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,entryId:pendingEntryId||undefined,type:el("entryType").value,amount:Number(el("entryAmount").value),description:el("entryDescription").value,splitMode:pendingEntryId?"now":el("splitMode").value,payerMemberId:el("payerMember").value,shares:shareItems})});const result=await response.json();if(!response.ok){status.textContent=result.error==="line_login_required"?"請先使用 LINE 登入。":result.error==="share_total_mismatch"?"每人金額加總必須等於帳目總額。":"儲存失敗，請確認資料後再試。";return;}await load();closeForm();showTab("accounting");});
  load();
})();
