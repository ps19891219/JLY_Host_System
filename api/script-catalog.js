"use strict";
const repo=require("../services/firebase/script-catalog-repository");
module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"method_not_allowed"});
  try{
    const scriptId=String((req.query&&req.query.id)||"").trim();
    const data=scriptId?await repo.getPublicDetail(scriptId):await repo.getPublicCatalog();
    if(scriptId&&!data)return res.status(404).json({ok:false,error:"script_not_found"});
    return res.status(200).json({ok:true,data});
  }catch(error){return res.status(500).json({ok:false,error:error&&error.message||"script_catalog_failed"});}
};
