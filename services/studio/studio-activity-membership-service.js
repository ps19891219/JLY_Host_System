"use strict";
const {getFirestore}=require("../firebase/admin");const txt=v=>String(v==null?"":v).trim();
async function updateActivityMembershipRole({activityId,playerId,roleLabel,actorPersonId,assignedDmPersonId}={}){
 const a=txt(activityId),p=txt(playerId),actor=txt(actorPersonId),dm=txt(assignedDmPersonId);if(!a||!p)throw new Error("activity_membership_required");if(!actor||actor!==dm)throw new Error("dm_permission_required");
 const db=getFirestore(),r=db.collection("cars").doc(a),now=new Date().toISOString();let changed=false;
 await db.runTransaction(async tx=>{const s=await tx.get(r);if(!s.exists)throw new Error("activity_not_found");const car=s.data()||{},players=Array.isArray(car.players)?car.players:[],idx=players.findIndex(x=>txt(x&&x.playerId||x&&x.id)===p);if(idx<0)throw new Error("membership_not_found");const next=players.map((x,i)=>i===idx?{...x,roleChoice:txt(roleLabel),updatedAt:now}:x);tx.set(r,{players:next,updatedAt:now},{merge:true});changed=true});
 return{activityId:a,playerId:p,roleLabel:txt(roleLabel),personNameChanged:false,changed,preparedViewsRequired:true};
}
module.exports={updateActivityMembershipRole};