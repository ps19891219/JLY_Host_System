(function () {
  "use strict";
  let mountedCarId = "", loading = false, detailedTransactions = null, detailedCarId = "", detailLastDocument = null, detailHasMore = false, managementMode=false, managedViewPersonId="";
  function counts(actions) { const list=actions||[]; return {total:list.length,pendingSplit:list.filter(a=>a.actionType==="pending_split").length,paymentDue:list.filter(a=>a.actionType==="payment_due"||a.actionType==="settlement_rejected").length,paymentConfirmation:list.filter(a=>a.actionType==="payment_confirmation").length}; }
  async function mount() {
    const section=document.getElementById("accountingSection"),car=window.currentCarData;
    if(!section||!car||loading)return; const carId=String(car.id||car.carId||new URLSearchParams(location.search).get("id")||""); if(!carId)return;
    loading=true;
    try {
      const data=window.JLYAccountingData,repository=window.JLYAccountingRepository,renderer=window.JLYAccountingRender;
      const members=data.collectActivityMembers(car),currentIdentity=data.getCurrentIdentity(localStorage,window.JLYIdentity),currentMember=data.resolveCurrentActivityMember(members,currentIdentity),currentPersonId=currentMember&&currentMember.personId;
      if(currentMember){const index=members.findIndex(member=>member.personId===currentPersonId);members[index]=currentMember;}
      const dashboard=await repository.loadDashboard(carId,currentPersonId),memberNames=new Map(members.map(member=>[member.personId,member.displayName]));
      if(detailedCarId!==carId){detailedTransactions=null;detailLastDocument=null;detailHasMore=false;detailedCarId=carId;}
      const displayedTransactions=detailedTransactions||dashboard.transactions;
      const managerPersonId=String(car.ownerId||"");
      const isManager=currentPersonId===managerPersonId,viewPersonId=managementMode&&isManager&&managedViewPersonId?managedViewPersonId:currentPersonId,netSettlement=data.netSettlementFromBalances(dashboard.balanceByPerson),personalSettlement=data.personalSettlement(netSettlement,viewPersonId),membersById=new Map(members.map(member=>[member.personId,member]));
      section.innerHTML=renderer.buildDashboardHtml({members,membersById,currentPersonId,viewPersonId,isManager,managementMode,managerPersonId,memberNames,transactions:displayedTransactions,pendingActions:dashboard.pendingActions,counts:counts(dashboard.pendingActions),netSettlement,personalSettlement,detailMode:Boolean(detailedTransactions),detailHasMore,getFilterState:item=>data.transactionFilterState(item,viewPersonId)});
      const netSettlementSection=section.querySelector(".accounting-net-settlement"),listHeading=section.querySelector(".accounting-list-heading");
      if(netSettlementSection&&listHeading)listHeading.before(netSettlementSection);
      const manageToggle=section.querySelector("#accountingManageToggle"),viewPerson=section.querySelector("#accountingViewPerson");
      if(manageToggle)manageToggle.addEventListener("click",()=>{managementMode=!managementMode;managedViewPersonId=currentPersonId;loading=false;mountedCarId="";mount();});
      if(viewPerson)viewPerson.addEventListener("change",()=>{managedViewPersonId=viewPerson.value;loading=false;mountedCarId="";mount();});
      window.JLYAccountingActions.bind({section,transactions:displayedTransactions,onSave:async input=>{if(!currentPersonId)throw new Error("identity_required");if(!members.some(member=>member.personId===currentPersonId))throw new Error("activity_membership_required");const canUuid=window.crypto&&typeof window.crypto.randomUUID==="function";const transactionId=canUuid?`web-${window.crypto.randomUUID()}`:`web-${Date.now()}`;const transaction=data.buildQuickTransaction({...input,transactionId,activityId:carId,createdBy:currentPersonId},new Date().toISOString());await repository.createQuickTransaction(transaction,String(car.ownerId||currentPersonId));},onSplit:async input=>{const entry=displayedTransactions.find(item=>item.transactionId===input.transactionId);const selected=input.personIds.map(id=>members.find(member=>member.personId===id)).filter(Boolean);const splits=input.mode==="custom"?data.buildCustomSplits(selected,input.amounts,entry.amount,entry.paidBy):data.buildEqualSplits(selected,entry.amount,entry.paidBy);await repository.completeSplit(carId,entry.transactionId,splits,currentPersonId,managerPersonId);},onSettlement:async input=>{const entry=displayedTransactions.find(item=>item.transactionId===input.transactionId),split=(entry.splits||[]).find(item=>item.splitId===input.splitId),next=data.transitionSettlement(split,input.action,currentPersonId,entry.paidBy,new Date().toISOString(),managerPersonId);await repository.saveSettlement(carId,entry.transactionId,split.splitId,next,currentPersonId);},onViewAll:async()=>{const page=await repository.loadTransactionPage(carId,10);detailedTransactions=page.transactions;detailLastDocument=page.lastDocument;detailHasMore=page.hasMore;loading=false;mountedCarId="";mount();},onLoadMore:async()=>{const page=await repository.loadTransactionPage(carId,10,detailLastDocument);detailedTransactions=[...(detailedTransactions||[]),...page.transactions];detailLastDocument=page.lastDocument;detailHasMore=page.hasMore;loading=false;mountedCarId="";mount();},onReload:()=>{detailedTransactions=null;detailLastDocument=null;detailHasMore=false;loading=false;mount();}});
      mountedCarId=carId;
    } catch(error) { console.error("載入車團帳務失敗",error); section.innerHTML="<h3>💰 車團帳務</h3><p>帳務資料暫時無法載入，請稍後再試。</p>"; }
    finally { loading=false; }
  }
  function observe(){const box=document.getElementById("detailBox");if(!box)return;new MutationObserver(()=>{const carId=window.currentCarData&&String(window.currentCarData.id||window.currentCarData.carId||"");if(document.getElementById("accountingSection")&&carId!==mountedCarId)mount();}).observe(box,{childList:true,subtree:true});if(document.getElementById("accountingSection"))mount();}
  document.addEventListener("DOMContentLoaded",observe);
  window.JLYAccountingController={mount,counts};
})();
