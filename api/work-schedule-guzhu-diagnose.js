"use strict";
const {getFirestore}=require("../services/firebase/admin");
const dates=["2027-10-04","2027-11-01","2027-12-01"];
const token="guzhu-20270923-4f8a";
function send(res,status,data){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data));}
module.exports=async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return send(res,405,{success:false,error:"method_not_allowed"});
 if(String(req.query&&req.query.token||"")!==token)return send(res,403,{success:false,error:"invalid_token"});
 try{
  const db=getFirestore();
  if(req.method==="POST"){
    const workId="HMlsoMDqVdxUMEH8apSr";
    const snap=await db.collection("workShifts").where("workId","==",workId).limit(200).get();
    const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>String(r.status||"scheduled")!=="cancelled").sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))||String(a.startTime||"").localeCompare(String(b.startTime||""))||String(a.roleName||"").localeCompare(String(b.roleName||"")));
    if(!rows.length)return send(res,409,{success:false,error:"guzhu_source_empty"});
    if(rows.length>=200)return send(res,409,{success:false,error:"guzhu_source_over_limit"});
    const ref=db.collection("workScheduleViews").doc("work-"+workId+"-all");
    await ref.set({type:"work-schedule-work-all",workId,rows,updatedAt:new Date().toISOString()},{merge:false});
    const verify=await ref.get(),data=verify.exists?verify.data()||{}:{};
    const verifyRows=Array.isArray(data.rows)?data.rows:[];
    const targetDates=verifyRows.filter(r=>dates.includes(String(r.date||""))).map(r=>({id:r.id,date:r.date,roleName:r.roleName,startTime:r.startTime,endTime:r.endTime}));
    return send(res,200,{success:true,mode:"repair",workId,sourceCount:rows.length,verifiedCount:verifyRows.length,targetDates,writes:1});
  }
  const source={},views={};
  for(const date of dates){
   const snap=await db.collection("workShifts").where("date","==",date).get();
   source[date]=snap.docs.map(d=>({id:d.id,...d.data()}));
  }
  for(const mk of ["2027-10","2027-11","2027-12"]){
   const doc=await db.collection("workScheduleViews").doc("month-"+mk).get();
   const data=doc.exists?doc.data()||{}:null;
   views[mk]={exists:doc.exists,count:data&&Array.isArray(data.rows)?data.rows.length:0,rows:data&&Array.isArray(data.rows)?data.rows.filter(r=>dates.includes(String(r.date||""))):[]};
  }
  const workDoc=await db.collection("workScheduleViews").doc("work-HMlsoMDqVdxUMEH8apSr-all").get();
  const workData=workDoc.exists?workDoc.data()||{}:null;
  const workRows=workData&&Array.isArray(workData.rows)?workData.rows:[];
  return send(res,200,{success:true,sourceCounts:Object.fromEntries(Object.entries(source).map(([k,v])=>[k,v.length])),viewSummary:Object.fromEntries(Object.entries(views).map(([k,v])=>[k,{exists:v.exists,count:v.count,matchingRows:v.rows.length}])),workView:{exists:workDoc.exists,count:workRows.length,dates:workRows.filter(r=>dates.includes(String(r.date||""))).map(r=>({id:r.id,date:r.date,roleName:r.roleName,startTime:r.startTime,endTime:r.endTime,status:r.status}))}});
 }catch(e){return send(res,500,{success:false,error:String(e&&e.message||e)})}
};