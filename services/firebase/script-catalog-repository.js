"use strict";
const {getFirestore}=require("./admin");
const txt=v=>String(v==null?"":v).trim();
const safeArray=v=>Array.isArray(v)?v:[];
const LIST_ID="public";
function publicScript(row={}){
  return {
    scriptId:txt(row.scriptId||row.id), name:txt(row.name||row.scriptName),
    coverUrl:txt(row.coverUrl), summary:txt(row.summary||row.description),
    tags:safeArray(row.tags).map(txt).filter(Boolean),
    playerCount:Number(row.playerCount||row.totalPeople||0)||0,
    maleSlots:Number(row.maleSlots||0)||0, femaleSlots:Number(row.femaleSlots||0)||0,
    durationMinutes:Number(row.durationMinutes||0)||0
  };
}
async function getPublicCatalog(){
  const s=await getFirestore().collection("scriptCatalogViews").doc(LIST_ID).get();
  return s.exists?(s.data()||{}):{schemaVersion:1,viewType:"script_catalog",scripts:[],count:0};
}
async function getPublicDetail(scriptId){
  const id=txt(scriptId); if(!id)throw new Error("script_id_required");
  const s=await getFirestore().collection("scriptDetailViews").doc(id).get();
  return s.exists?{scriptId:id,...s.data()}:null;
}
module.exports={LIST_ID,publicScript,getPublicCatalog,getPublicDetail};
