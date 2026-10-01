"use strict";
const {getFirestore}=require("./admin");
function text(value){return String(value==null?"":value).trim();}
async function getCarDetailViewById(carId,dependencies={}){
 const id=text(carId);if(!id)return null;
 const db=dependencies.db||getFirestore();
 const snap=await db.collection("carDetailViews").doc(id).get();
 if(!snap.exists)return null;
 const view=snap.data()||{},car=view.car&&typeof view.car==="object"?view.car:null;
 if(!car)return null;
 return {...car,id:text(car.id||view.carId||id),preparedRead:true};
}
module.exports={getCarDetailViewById};
