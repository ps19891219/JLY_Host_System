(function(){
  "use strict";
  const text=value=>String(value==null?"":value).trim();
  const amount=value=>Math.max(0,Math.round(Number(value)||0));
  function buildPlan(input,actorPersonId,now){
    const memberIds=[...new Set((input.memberIds||[]).map(text).filter(Boolean))],playerFee=amount(input.playerFee),vendorTotal=amount(input.vendorTotal);
    if(!text(input.carId)||!text(input.vendorName)||!memberIds.length||!playerFee||!vendorTotal)throw new Error("fee_plan_invalid");
    return{feePlanId:"scriptFee",activityId:text(input.carId),activityType:"script_car",villageType:"script",carId:text(input.carId),feeType:"script_fee",currency:"TWD",vendor:{externalPartyId:text(input.externalPartyId)||`external-${Date.now()}`,displayName:text(input.vendorName),linkedOrganizationId:text(input.linkedOrganizationId),linkedStoreId:text(input.linkedStoreId)},vendorTotal,memberCharges:memberIds.map(personId=>({personId,amount:playerFee})),status:"active",createdBy:text(actorPersonId),updatedBy:text(actorPersonId),createdAt:now,updatedAt:now};
  }
  function summarize(plan,memberPayments,vendorPayments){
    const memberDue=(plan&&plan.memberCharges||[]).reduce((sum,item)=>sum+amount(item.amount),0),memberCollected=(memberPayments||[]).reduce((sum,item)=>sum+(item.kind==="refund"?-amount(item.amount):amount(item.amount)),0),vendorPaid=(vendorPayments||[]).reduce((sum,item)=>sum+(item.kind==="refund"?-amount(item.amount):amount(item.amount)),0),vendorTotal=amount(plan&&plan.vendorTotal);
    const paidByMember=new Map();(memberPayments||[]).forEach(item=>paidByMember.set(item.personId,(paidByMember.get(item.personId)||0)+(item.kind==="refund"?-amount(item.amount):amount(item.amount))));
    return{memberDue,memberCollected,memberOutstanding:Math.max(0,memberDue-memberCollected),vendorTotal,vendorPaid,vendorOutstanding:Math.max(0,vendorTotal-vendorPaid),custodyBalance:memberCollected-vendorPaid,members:(plan&&plan.memberCharges||[]).map(item=>({...item,paid:paidByMember.get(item.personId)||0,outstanding:Math.max(0,amount(item.amount)-(paidByMember.get(item.personId)||0))}))};
  }
  window.JLYActivityFeeData={buildPlan,summarize};
})();
