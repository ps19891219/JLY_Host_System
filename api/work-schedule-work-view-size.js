"use strict";
const {getFirestore}=require("../services/firebase/admin");
const WORK_ID="HMlsoMDqVdxUMEH8apSr",TOKEN="work-view-size-20260923-92b1";
function send(res,status,data){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data));}
module.exports=async function handler(req,res){
 if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
 if(String(req.query&&req.query.token||"")!==TOKEN)return send(res,403,{success:false,error:"invalid_token"});
 try{
  const db=getFirestore(),doc=await db.collection("workScheduleViews").doc("work-"+WORK_ID+"-all").get();
  if(!doc.exists)return send(res,404,{success:false,error:"work_view_missing"});
  const data=doc.data()||{},rows=Array.isArray(data.rows)?data.rows:[];
  const json=JSON.stringify(data),byMonth={};
  for(const r of rows){const mk=String(r.monthKey||r.date||"").slice(0,7)||"unknown";byMonth[mk]=(byMonth[mk]||0)+1}
  return send(res,200,{success:true,rowCount:rows.length,bytes:Buffer.byteLength(json,"utf8"),months:Object.keys(byMonth).length,rowsByMonth:byMonth,firstDate:rows[0]?.date||null,lastDate:rows[rows.length-1]?.date||null});
 }catch(e){return send(res,500,{success:false,error:String(e&&e.message||e)})}
};