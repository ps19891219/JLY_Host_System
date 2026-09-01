"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "js/modules/accounting/accounting-controller.js");
let source = fs.readFileSync(file, "utf8");

function replaceOnce(needle, replacement, label) {
  const count = source.split(needle).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  source = source.replace(needle, replacement);
}

replaceOnce(
  'playerPaid=Math.max(0,total-playerPending),canPay=person.playerPosition==="payable"&&netAmount>0&&(person.personId===model.currentPersonId||model.isManager),counterpartyName=id=>',
  'playerPaid=Math.max(0,total-playerPending),payableTransfers=Array.isArray(person.payable)?person.payable:[],canPay=person.playerPosition==="payable"&&netAmount>0&&(person.personId===model.currentPersonId||model.isManager),counterpartyName=id=>',
  "capture payable transfers"
);

replaceOnce(
  'processingRows=[...(person.processingOutgoing||[])',
  'delegatedRows=payableTransfers.map(transfer=>{const fromPersonId=String(transfer.fromPersonId||person.personId||""),toPersonId=String(transfer.toPersonId||""),amount=Math.max(0,Number(transfer.amount||0)),receiverName=counterpartyName(toPersonId),canRequest=fromPersonId===model.currentPersonId&&toPersonId!==model.currentPersonId,canVolunteer=model.currentPersonId&&model.currentPersonId!==fromPersonId&&model.currentPersonId!==toPersonId,delegateOptions=(model.members||[]).filter(candidate=>candidate.personId!==fromPersonId&&candidate.personId!==toPersonId).map(candidate=>`<option value="${escapeHtml(candidate.personId)}">${escapeHtml(candidate.displayName||"成員")}</option>`).join("");if(!amount||(!canRequest&&!canVolunteer))return"";return `<div class="accounting-person-delegated-row" data-from-person-id="${escapeHtml(fromPersonId)}" data-to-person-id="${escapeHtml(toPersonId)}"><span><strong>${escapeHtml(receiverName)}</strong><small>這筆仍保留原債務人與正式收款方</small></span><label>金額<input class="accounting-person-delegated-amount" type="number" min="1" max="${amount}" inputmode="numeric" value="${amount}"></label>${canRequest&&delegateOptions?`<label>請誰代付<select class="accounting-person-delegate-select"><option value="">請選擇</option>${delegateOptions}</select></label><button type="button" class="accounting-person-delegated-action" data-action="request_delegate">請人代付</button>`:""}${canVolunteer?`<button type="button" class="accounting-person-delegated-action" data-action="delegated_claim">幫他代付</button>`:""}</div>`;}).filter(Boolean).join(""),processingRows=[...(person.processingOutgoing||[])',
  "build delegated payment controls"
);

replaceOnce(
  '${processingRows.length?`<div class="accounting-person-processing">${processingRows.join("")}</div>`:""}${canPay?`<button type="button" class="accounting-person-pay-toggle">付款</button>',
  '${processingRows.length?`<div class="accounting-person-processing">${processingRows.join("")}</div>`:""}${delegatedRows?`<div class="accounting-person-delegated"><strong>其他付款方式</strong>${delegatedRows}</div>`:""}${canPay?`<button type="button" class="accounting-person-pay-toggle">付款</button>',
  "render delegated payment controls"
);

replaceOnce(
  'peoplePanel.querySelectorAll(".accounting-person-payment").forEach(form=>form.addEventListener("submit",async event=>',
  'peoplePanel.querySelectorAll(".accounting-person-delegated-action").forEach(button=>button.addEventListener("click",async()=>{const row=button.closest(".accounting-person-delegated-row"),card=button.closest(".accounting-person-card"),amountInput=row&&row.querySelector(".accounting-person-delegated-amount"),delegateSelect=row&&row.querySelector(".accounting-person-delegate-select"),amount=Math.round(Number(amountInput&&amountInput.value)||0),maximum=Math.round(Number(amountInput&&amountInput.max)||0),delegatePersonId=delegateSelect&&delegateSelect.value||"";if(amount<1||amount>maximum){button.textContent="請確認金額";return;}if(button.dataset.action==="request_delegate"&&!delegatePersonId){button.textContent="請先選擇代付人";return;}const original=button.textContent;button.disabled=true;button.textContent="處理中…";try{await handlers.onDelegatedPayment({action:button.dataset.action,personId:card&&card.dataset.accountingPersonId||"",fromPersonId:row&&row.dataset.fromPersonId||"",toPersonId:row&&row.dataset.toPersonId||"",delegatePersonId,amount,expectedAmount:maximum,scrollY:window.scrollY});}catch(error){button.disabled=false;button.textContent=personActionErrorMessage(error)==="目前無法處理，請稍後再試。"?"目前無法處理代付":personActionErrorMessage(error);}}));peoplePanel.querySelectorAll(".accounting-person-payment").forEach(form=>form.addEventListener("submit",async event=>',
  "bind delegated payment controls"
);

replaceOnce(
  '},onViewAll:async()=>{const [page,settlements]=await Promise.all([repository.loadTransactionPage(carId,10),repository.loadSettlementHistory(carId,20)]);',
  '},onDelegatedPayment:async input=>{if(!currentPersonId)throw new Error("identity_required");if(input.action==="request_delegate"){if(input.fromPersonId!==currentPersonId)throw new Error("net_settlement_not_allowed");if(!input.delegatePersonId)throw new Error("delegated_payment_delegate_required");await repository.createDelegatedRequest(carId,{debtorPersonId:input.fromPersonId,delegatePersonId:input.delegatePersonId,receiverPersonId:input.toPersonId,requestedBy:currentPersonId,amount:input.amount,reimbursementRequired:false});}else if(input.action==="delegated_claim"){await repository.claimNetSettlement(carId,{action:"delegated_claim",fromPersonId:input.fromPersonId,toPersonId:input.toPersonId,expectedAmount:input.expectedAmount,amount:input.amount,actorPersonId:currentPersonId,managerPersonId,reimbursementRequired:false});}else throw new Error("delegated_payment_action_invalid");const scrollTop=input.scrollY||0;accountingNavigationState=window.JLYAccountingNavigation.normalize({...accountingNavigationState,view:"people",personId:input.personId,sourceId:"delegated-payment"},currentPersonId);detailedTransactions=null;detailedSettlements=null;loading=false;mountedCarId="";await mount();requestAnimationFrame(()=>window.scrollTo({top:scrollTop,behavior:"auto"}));},onViewAll:async()=>{const [page,settlements]=await Promise.all([repository.loadTransactionPage(carId,10),repository.loadSettlementHistory(carId,20)]);',
  "wire delegated payment handler"
);

replaceOnce(
  'if(code==="net_settlement_already_claimed")return"這筆款項已經被處理。";',
  'if(code==="net_settlement_already_claimed")return"這筆款項已經被處理。";if(code==="delegated_payment_delegate_required")return"請先選擇代付人。";if(code==="net_settlement_invalid_amount"||code==="delegated_payment_invalid_amount")return"請輸入正確的代付金額。";',
  "delegated payment error messages"
);

fs.writeFileSync(file, source, "utf8");
console.log("Accounting final polish patch applied.");
