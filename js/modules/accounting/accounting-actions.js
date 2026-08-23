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
    const detailsToggle=section.querySelector("#accountingDetailsToggle"),details=section.querySelector("#accountingDetails");
    if(detailsToggle&&details)detailsToggle.addEventListener("click",async()=>{
  const opening=details.hidden;

  if(opening&&detailsToggle.dataset.detailsLoaded!=="true"&&config.onViewAll){
    detailsToggle.disabled=true;
    detailsToggle.textContent="載入帳務明細…";

    try{
      await config.onViewAll();
      return;
    }catch(error){
      detailsToggle.disabled=false;
      detailsToggle.textContent="展開帳務明細";
      return;
    }
  }

  details.hidden=!details.hidden;
  detailsToggle.setAttribute(
    "aria-expanded",
    String(!details.hidden)
  );
  detailsToggle.textContent=
    details.hidden
      ?"展開帳務明細"
      :"收起帳務明細";

  if(!details.hidden){
    details.scrollIntoView({
      behavior:"smooth",
      block:"nearest"
    });
  }
});
    const attention=section.querySelector("#accountingAttention"),pendingBody=section.querySelector("#accountingPendingBody");if(attention&&pendingBody)attention.addEventListener("click",()=>{const open=pendingBody.hidden;pendingBody.hidden=!open;attention.setAttribute("aria-expanded",String(open));attention.querySelector("b").textContent=open?"收起⌃":"展開 ›";if(open)pendingBody.scrollIntoView({behavior:"smooth",block:"nearest"});});
    const viewAll=section.querySelector("#accountingViewAll"),filters=section.querySelector("#accountingFilters"),entries=[...section.querySelectorAll(".accounting-entry")],empty=section.querySelector("#accountingFilterEmpty"),title=section.querySelector("#accountingListTitle");
    function applyFilter(filter){let visible=0;entries.forEach(entry=>{const state=entry.dataset.filterState,show=filter==="all"||(filter==="pending"?state!=="settled":state===filter);entry.hidden=!show;if(show)visible++;});empty.hidden=visible!==0;filters.querySelectorAll("button").forEach(button=>button.classList.toggle("active",button.dataset.filter===filter));}
    viewAll.addEventListener("click",async()=>{if(config.onViewAll&&viewAll.textContent.includes("查看詳細")){viewAll.disabled=true;viewAll.textContent="載入中…";try{await config.onViewAll();}catch(_){viewAll.disabled=false;viewAll.textContent="查看詳細帳務";}return;}filters.hidden=false;viewAll.hidden=true;title.textContent="詳細車團帳務";applyFilter("pending");});
    filters.querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>applyFilter(button.dataset.filter)));
    const loadMore=section.querySelector("#accountingLoadMore");
    if(loadMore)loadMore.addEventListener("click",async()=>{loadMore.disabled=true;loadMore.textContent="載入中…";try{await config.onLoadMore();}catch(_){loadMore.disabled=false;loadMore.textContent="載入下一頁";}});
    const settlementDialog=section.querySelector("#accountingSettlementDialog"),dialogTitle=section.querySelector("#accountingSettlementDialogTitle"),dialogTotal=section.querySelector("#accountingSettlementDialogTotal"),payableRows=section.querySelector("#accountingPayableRows"),receivableRows=section.querySelector("#accountingReceivableRows"),netRows=section.querySelector("#accountingNetRows");
    section.querySelectorAll("[data-settlement-dialog]").forEach(button=>button.addEventListener("click",()=>{const type=button.dataset.settlementDialog;dialogTitle.textContent=type==="payable"?"我欠誰":type==="receivable"?"誰欠我":"互相扣抵後";dialogTotal.textContent=`合計 ${button.querySelector("b").textContent}`;payableRows.hidden=type!=="payable";receivableRows.hidden=type!=="receivable";netRows.hidden=type!=="net";if(typeof settlementDialog.showModal==="function")settlementDialog.showModal();else settlementDialog.setAttribute("open","");}));
    if(settlementDialog){section.querySelector("#accountingSettlementDialogClose").addEventListener("click",()=>settlementDialog.close());settlementDialog.addEventListener("click",event=>{if(event.target===settlementDialog)settlementDialog.close();});}
    section.querySelectorAll("[data-payment-sheet-toggle]").forEach(button=>button.addEventListener("click",()=>{const sheet=button.closest(".accounting-payment-input")?.querySelector(".accounting-payment-sheet");if(sheet)sheet.hidden=!sheet.hidden;}));
    section.querySelectorAll("[data-payment-more-toggle]").forEach(button=>button.addEventListener("click",()=>{const menu=button.closest(".accounting-payment-input")?.querySelector(".accounting-payment-more-menu");if(menu)menu.hidden=!menu.hidden;}));
    section.querySelectorAll(".accounting-net-action").forEach(button=>button.addEventListener("click",async()=>{const original=button.textContent,box=button.closest(".accounting-payment-input"),input=box&&box.querySelector(".accounting-net-amount"),amount=Number(button.dataset.amount||(input&&input.value))||0;button.disabled=true;button.textContent="處理中…";try{await config.onNetSettlement({action:button.dataset.action,settlementId:button.dataset.settlementId||"",fromPersonId:button.dataset.fromPersonId||"",toPersonId:button.dataset.toPersonId||"",targetPersonId:button.dataset.targetPersonId||"",amount});settlementDialog.close();config.onReload();}catch(error){button.disabled=false;button.textContent=original;alert(error.message==="net_settlement_amount_changed"?"付款金額超過目前應付餘額，請重新輸入。":error.message==="net_settlement_invalid_amount"?"請輸入正確的付款金額。":"目前無法執行付款動作，請確認登入身分。");}}));
    section.querySelectorAll(".accounting-delegated-action").forEach(button=>button.addEventListener("click",async()=>{const original=button.textContent,box=button.closest(".accounting-payment-input,.accounting-delegate-request"),input=box&&box.querySelector(".accounting-net-amount"),delegate=box&&box.querySelector(".accounting-delegate-person");button.disabled=true;button.textContent="處理中…";try{const payload={action:button.dataset.action,requestId:button.dataset.requestId||"",fromPersonId:button.dataset.fromPersonId||"",toPersonId:button.dataset.toPersonId||"",delegatePersonId:delegate&&delegate.value||"",amount:Number(input&&input.value)||0,reimbursementRequired:false},car=window.currentCarData||{},carId=String(car.id||car.carId||new URLSearchParams(location.search).get("id")||""),identity=window.JLYAccountingData.getCurrentIdentity(localStorage,window.JLYIdentity),members=window.JLYAccountingData.collectActivityMembers(car),actor=(window.JLYAccountingData.resolveCurrentActivityMember(members,identity)||{}).personId||"";if(!actor)throw new Error("identity_required");if(payload.action==="delegated_claim")await window.JLYAccountingRepository.claimNetSettlement(carId,{...payload,actorPersonId:actor});else if(payload.action==="request_delegate"){if(!payload.delegatePersonId)throw new Error("delegated_payment_delegate_required");await window.JLYAccountingRepository.createDelegatedRequest(carId,{debtorPersonId:payload.fromPersonId,delegatePersonId:payload.delegatePersonId,receiverPersonId:payload.toPersonId,requestedBy:actor,amount:payload.amount,reimbursementRequired:false});}else if(payload.action==="pay_accepted_delegate")await window.JLYAccountingRepository.claimAcceptedDelegatedRequest(carId,payload.requestId,actor,payload.amount);else await window.JLYAccountingRepository.transitionDelegatedRequest(carId,payload.requestId,payload.action==="accept_delegate"?"accept":"reject",actor);if(settlementDialog&&settlementDialog.open)settlementDialog.close();config.onReload();}catch(error){button.disabled=false;button.textContent=original;alert(error.message&&error.message.includes("amount")?"請輸入正確的代付金額。":"目前無法處理代付，請確認人員與權限。");}}));
  }
  window.JLYAccountingActions = { bind };
})();
