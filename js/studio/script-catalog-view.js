(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.JLYScriptCatalogView=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const txt=v=>String(v==null?"":v).trim(),arr=v=>Array.isArray(v)?v:[];
function publicScript(row={}){
 return {scriptId:txt(row.scriptId||row.id),name:txt(row.name||row.scriptName),coverUrl:txt(row.coverUrl),summary:txt(row.summary||row.description),tags:arr(row.tags).map(txt).filter(Boolean),playerCount:Number(row.playerCount||row.totalPeople||0)||0,maleSlots:Number(row.maleSlots||0)||0,femaleSlots:Number(row.femaleSlots||0)||0,durationMinutes:Number(row.durationMinutes||0)||0};
}
async function sync(db,row){
 const item=publicScript(row);if(!item.scriptId)throw new Error("script_id_required");
 const catalog=db.collection("scriptCatalogViews").doc("public"),detail=db.collection("scriptDetailViews").doc(item.scriptId),snap=await catalog.get(),current=snap.exists&&Array.isArray(snap.data()?.scripts)?snap.data().scripts:[],scripts=current.filter(x=>txt(x.scriptId)!==item.scriptId);
 scripts.push(item);scripts.sort((a,b)=>txt(a.name).localeCompare(txt(b.name),"zh-Hant"));
 const now=typeof firebase!=="undefined"&&firebase.firestore?.FieldValue?.serverTimestamp?firebase.firestore.FieldValue.serverTimestamp():new Date().toISOString();
 await Promise.all([catalog.set({schemaVersion:1,viewType:"script_catalog",scripts,count:scripts.length,updatedAt:now},{merge:true}),detail.set({schemaVersion:1,viewType:"script_detail",...item,updatedAt:now},{merge:true})]);
 return item;
}
async function remove(db,scriptId){const id=txt(scriptId);if(!id)return;const ref=db.collection("scriptCatalogViews").doc("public"),snap=await ref.get(),scripts=(snap.exists&&Array.isArray(snap.data()?.scripts)?snap.data().scripts:[]).filter(x=>txt(x.scriptId)!==id),now=typeof firebase!=="undefined"&&firebase.firestore?.FieldValue?.serverTimestamp?firebase.firestore.FieldValue.serverTimestamp():new Date().toISOString();await Promise.all([ref.set({scripts,count:scripts.length,updatedAt:now},{merge:true}),db.collection("scriptDetailViews").doc(id).delete()]);}
return {publicScript,sync,remove};
});
