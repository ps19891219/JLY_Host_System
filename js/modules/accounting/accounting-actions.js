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
    section.querySelectorAll(".accounting-split-open").forEach(button=>button.addEventListener("click",()=>{const item=config.transactions.find(entry=>entry.transactionId===button.dataset.transactionId);splitForm.hidden=false;section.querySelector("#accountingSplitTransactionId").value=item.transactionId;section.querySelector("#accountingSplitTitle").textContent=`分帳：${item.title||item.description}`;splitForm.scrollIntoView({behavior:"smooth",block:"center"});}));
    splitMode.addEventListener("change",()=>section.querySelectorAll(".accounting-custom-amount").forEach(input=>input.hidden=splitMode.value!=="custom"));
    section.querySelector("#accountingSplitCancel").addEventListener("click",()=>{splitForm.hidden=true;splitStatus.hidden=true;});
    splitForm.addEventListener("submit",async event=>{event.preventDefault();const button=section.querySelector("#accountingSplitSave"),selected=[...section.querySelectorAll('input[name="splitMember"]:checked')].map(input=>input.value);button.disabled=true;splitStatus.hidden=false;splitStatus.textContent="正在儲存分帳…";try{const amounts={};section.querySelectorAll(".accounting-custom-amount").forEach(input=>amounts[input.dataset.personId]=input.value);await config.onSplit({transactionId:section.querySelector("#accountingSplitTransactionId").value,mode:splitMode.value,personIds:selected,amounts});splitStatus.textContent="✅ 分帳完成";setTimeout(config.onReload,500);}catch(error){splitStatus.textContent=error.message==="split_total_mismatch"?"自訂金額合計必須等於帳目總額。":error.message==="split_permission_denied"?"只有記帳者或付款人可以分帳。":"請至少選擇一位分帳成員。";button.disabled=false;}});
  }
  window.JLYAccountingActions = { bind };
})();
