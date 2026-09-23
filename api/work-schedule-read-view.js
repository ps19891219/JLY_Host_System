"use strict";
const {getFirestore}=require("../services/firebase/admin");
function send(res,status,data){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data));}
module.exports=async function handler(req,res){
 if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
 const workId=String(req.query&&req.query.workId||"").trim();
 if(!/^[A-Za-z0-9_-]{1,120}$/.test(workId))return send(res,400,{success:false,error:"invalid_work_id"});
 try{
  const db=getFirestore(),doc=await db.collection("workScheduleViews").doc("work-"+workId+"-all").get();
  if(!doc.exists)return send(res,200,{success:true,workId,rows:[]});
  const data=doc.data()||{},rows=Array.isArray(data.rows)?data.rows:[];
  return send(res,200,{success:true,workId,rows});
 }catch(e){return send(res,500,{success:false,error:String(e&&e.message||e)})}
};