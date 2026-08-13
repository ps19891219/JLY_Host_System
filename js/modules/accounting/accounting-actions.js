(function () {
  "use strict";
  function bind(config) {
    const section = config.section, form = section.querySelector("#accountingQuickForm"), status = section.querySelector("#accountingFormStatus");
    section.querySelector("#accountingQuickOpen").addEventListener("click", () => { form.hidden = false; form.scrollIntoView({behavior:"smooth",block:"center"}); });
    section.querySelector("#accountingCancel").addEventListener("click", () => { form.hidden = true; status.hidden = true; });
    form.addEventListener("submit", async event => {
      event.preventDefault(); const button=section.querySelector("#accountingSave");
      button.disabled=true; button.textContent="儲存中…"; status.hidden=false; status.textContent="正在儲存…";
      try { await config.onSave({title:section.querySelector("#accountingTitle").value,amount:Number(section.querySelector("#accountingAmount").value),paidBy:section.querySelector("#accountingPaidBy").value}); status.textContent="✅ 已記下來，稍後可再分帳"; form.reset(); setTimeout(config.onReload,500); }
      catch(error){ status.textContent=error.message==="identity_required"?"請先完成 JLY 身分設定。":error.message==="activity_membership_required"?"只有這台車的正式成員可以新增帳目。":"儲存失敗，請稍後再試。"; button.disabled=false; button.textContent="記下來"; }
    });
    const splitForm=section.querySelector("#accountingSplitForm"),splitMode=section.querySelector("#accountingSplitMode"),splitStatus=section.querySelector("#accountingSplitStatus");
    const memberCheckboxes=[...section.querySelectorAll('input[name="splitMember"]')],selectAllButton=section.querySelector("#accountingSelectAll");
    function setAllMembers(checked){memberCheckboxes.forEach(input=>input.checked=checked);selectAllButton.textContent=checked?"取消全選":"全選";}
    function syncSelectAllLabel(){selectAllButton.textContent=memberCheckboxes.length&&memberCheckboxes.every(input=>input.checked)?"取消全選":"全選";}
    section.querySelectorAll(".accounting-split-open").forEach(button=>button.addEventListener("click",()=>{const item=config.transactions.find(entry=>entry.transactionId===button.dataset.transactionId);setAllMembers(true);splitMode.value="equal";section.querySelectorAll(".accounting-custom-amount").forEach(input=>{input.hidden=true;input.value="";});splitForm.hidden=false;section.querySelector("#accountingSplitTransactionId").value=item.transactionId;section.querySelector("#accountingSplitTitle").textContent=`分帳：${item.title||item.description}`;splitForm.scrollIntoView({behavior:"smooth",block:"center"});}));
    selectAllButton.addEventListener("click",()=>setAllMembers(!memberCheckboxes.every(input=>input.checked)));
    memberCheckboxes.forEach(input=>input.addEventListener("change",syncSelectAllLabel));
    splitMode.addEventListener("change",()=>section.querySelectorAll(".accounting-custom-amount").forEach(input=>input.hidden=splitMode.value!=="custom"));
    section.querySelector("#accountingSplitCancel").addEventListener("click",()=>{splitForm.hidden=true;splitStatus.hidden=true;});
    splitForm.addEventListener("submit",async event=>{event.preventDefault();const button=section.querySelector("#accountingSplitSave"),selected=[...section.querySelectorAll('input[name="splitMember"]:checked')].map(input=>input.value);button.disabled=true;splitStatus.hidden=false;splitStatus.textContent="正在儲存分帳…";try{const amounts={};section.querySelectorAll(".accounting-custom-amount").forEach(input=>amounts[input.dataset.personId]=input.value);await config.onSplit({transactionId:section.querySelector("#accountingSplitTransactionId").value,mode:splitMode.value,personIds:selected,amounts});splitStatus.textContent="✅ 分帳完成";setTimeout(config.onReload,500);}catch(error){splitStatus.textContent=error.message==="split_total_mismatch"?"自訂金額合計必須等於帳目總額。":error.message==="split_permission_denied"?"只有記帳者或付款人可以分帳。":"請至少選擇一位分帳成員。";button.disabled=false;}});
    section.querySelectorAll(".accounting-settlement-row button").forEach(button=>button.addEventListener("click",async()=>{const row=button.closest(".accounting-settlement-row");button.disabled=true;const original=button.textContent;button.textContent="處理中…";try{await config.onSettlement({transactionId:row.dataset.transactionId,splitId:row.dataset.splitId,action:button.dataset.action});config.onReload();}catch(error){button.disabled=false;button.textContent=original;alert("目前無法執行這個付款動作，請重新確認身分與狀態。");}}));
    const viewAll=section.querySelector("#accountingViewAll"),filters=section.querySelector("#accountingFilters"),entries=[...section.querySelectorAll(".accounting-entry")],empty=section.querySelector("#accountingFilterEmpty"),title=section.querySelector("#accountingListTitle");
    function applyFilter(filter){let visible=0;entries.forEach(entry=>{const state=entry.dataset.filterState,show=filter==="all"||(filter==="pending"?state!=="settled":state===filter);entry.hidden=!show;if(show)visible++;});empty.hidden=visible!==0;filters.querySelectorAll("button").forEach(button=>button.classList.toggle("active",button.dataset.filter===filter));}
    viewAll.addEventListener("click",()=>{filters.hidden=false;viewAll.hidden=true;title.textContent="全部車團帳務";applyFilter("pending");});
    filters.querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>applyFilter(button.dataset.filter)));
  }
  window.JLYAccountingActions = { bind };
})();
