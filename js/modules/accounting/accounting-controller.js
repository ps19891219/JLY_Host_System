(function () {
  "use strict";
  let mountedCarId = "", loading = false;
  function counts(actions) { const list=actions||[]; return {total:list.length,pendingSplit:list.filter(a=>a.actionType==="pending_split").length,paymentDue:list.filter(a=>a.actionType==="payment_due"||a.actionType==="settlement_rejected").length,paymentConfirmation:list.filter(a=>a.actionType==="payment_confirmation").length}; }
  async function mount() {
    const section=document.getElementById("accountingSection"),car=window.currentCarData;
    if(!section||!car||loading)return; const carId=String(car.id||car.carId||new URLSearchParams(location.search).get("id")||""); if(!carId)return;
    loading=true;
    try {
      const data=window.JLYAccountingData,repository=window.JLYAccountingRepository,renderer=window.JLYAccountingRender;
      const members=data.collectActivityMembers(car),currentPersonId=data.getCurrentPersonId(localStorage),dashboard=await repository.loadDashboard(carId),memberNames=new Map(members.map(member=>[member.personId,member.displayName]));
      section.innerHTML=renderer.buildDashboardHtml({members,currentPersonId,memberNames,transactions:dashboard.transactions,pendingActions:dashboard.pendingActions,counts:counts(dashboard.pendingActions)});
      window.JLYAccountingActions.bind({section,onSave:async input=>{if(!currentPersonId)throw new Error("identity_required");if(!members.some(member=>member.personId===currentPersonId))throw new Error("activity_membership_required");const canUuid=window.crypto&&typeof window.crypto.randomUUID==="function";const transactionId=canUuid?`web-${window.crypto.randomUUID()}`:`web-${Date.now()}`;const transaction=data.buildQuickTransaction({...input,transactionId,activityId:carId,createdBy:currentPersonId},new Date().toISOString());await repository.createQuickTransaction(transaction,String(car.ownerId||currentPersonId));},onReload:()=>{loading=false;mount();}});
      mountedCarId=carId;
    } catch(error) { console.error("載入車團帳務失敗",error); section.innerHTML="<h3>💰 車團帳務</h3><p>帳務資料暫時無法載入，請稍後再試。</p>"; }
    finally { loading=false; }
  }
  function observe(){const box=document.getElementById("detailBox");if(!box)return;new MutationObserver(()=>{const carId=window.currentCarData&&String(window.currentCarData.id||window.currentCarData.carId||"");if(document.getElementById("accountingSection")&&carId!==mountedCarId)mount();}).observe(box,{childList:true,subtree:true});if(document.getElementById("accountingSection"))mount();}
  document.addEventListener("DOMContentLoaded",observe);
  window.JLYAccountingController={mount,counts};
})();
