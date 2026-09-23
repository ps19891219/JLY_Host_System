"use strict";
const {getFirestore}=require("../firebase/admin");const txt=v=>String(v==null?"":v).trim();
function assignedDmIds(car){const ids=new Set();[car.dmPersonId,car.assignedDmPersonId].map(txt).filter(Boolean).forEach(x=>ids.add(x));(Array.isArray(car.staffSlots)?car.staffSlots:[]).forEach(x=>{const role=txt(x&&x.role||x&&x.type).toLowerCase();if(role==="dm"||role==="主持人") {const id=txt(x&&x.personId||x&&x.playerId||x&&x.memberId);if(id)ids.add(id)}});return ids}
async function updateActivityMembershipRole({activityId,playerId,roleLabel,actorPersonId}={}){
 const a=txt(activityId),p=txt(playerId),actor=txt(actorPersonId);if(!a||!p)throw new Error("activity_membership_required");if(!actor)throw new Error("dm_permission_required");
 const db=getFirestore(),r=db.collection("cars").doc(a),now=new Date().toISOString();let changed=false;
 await db.runTransaction(async tx=>{const snap=await tx.get(r);if(!snap.exists)throw new Error("activity_not_found");const car=snap.data()||{};if(!assignedDmIds(car).has(actor))throw new Error("dm_permission_required");const players=Array.isArray(car.players)?car.players:[],idx=players.findIndex(x=>txt(x&&x.playerId||x&&x.id)===p);if(idx<0)throw new Error("membership_not_found");const next=players.map((x,i)=>i===idx?{...x,roleChoice:txt(roleLabel),updatedAt:now}:x);tx.set(r,{players:next,updatedAt:now},{merge:true});changed=true});
 return{activityId:a,playerId:p,roleLabel:txt(roleLabel),personNameChanged:false,changed,preparedViewsRequired:true};
}
module.exports={updateActivityMembershipRole,assignedDmIds};