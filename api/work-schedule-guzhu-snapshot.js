"use strict";
const {getFirestore}=require("../services/firebase/admin");
const WORK_ID="HMlsoMDqVdxUMEH8apSr";
const SNAPSHOT_ID="guzhu-work-all-20260923";
const TOKEN="guzhu-snapshot-20260923-a7f1";
function send(res,status,data){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data));}
module.exports=async function handler(req,res){
 if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
 if(String(req.query&&req.query.token||"")!==TOKEN)return send(res,403,{success:false,error:"invalid_token"});
 try{
  const db=getFirestore();
  const sourceRef=db.collection("workScheduleViews").doc("work-"+WORK_ID+"-all");
  const snapRef=db.collection("workScheduleViewSnapshots").doc(SNAPSHOT_ID);
  const [source,existing]=await Promise.all([sourceRef.get(),snapRef.get()]);
  if(existing.exists)return send(res,409,{success:false,error:"snapshot_already_exists"});
  if(!source.exists)return send(res,409,{success:false,error:"source_view_missing"});
  const data=source.data()||{},rows=Array.isArray(data.rows)?data.rows:[];
  if(rows.length!==144)return send(res,409,{success:false,error:"unexpected_row_count",rowCount:rows.length});
  const importantDates=["2027-10-04","2027-11-01","2027-12-01"];
  const targetRows=rows.filter(r=>importantDates.includes(String(r.date||"")));
  if(targetRows.length!==12)return send(res,409,{success:false,error:"important_dates_incomplete",targetRowCount:targetRows.length});
  await snapRef.create({
   type:"work-schedule-view-snapshot",
   snapshotOf:"workScheduleViews/work-"+WORK_ID+"-all",
   workId:WORK_ID,
   workName:"孤注",
   rowCount:rows.length,
   importantDates,
   createdAt:new Date().toISOString(),
   data
  });
  const verify=await snapRef.get(),v=verify.exists?verify.data()||{}:{};
  const verifiedRows=v.data&&Array.isArray(v.data.rows)?v.data.rows:[];
  if(!verify.exists||verifiedRows.length!==144)return send(res,500,{success:false,error:"snapshot_verify_failed"});
  return send(res,200,{success:true,snapshotId:SNAPSHOT_ID,rowCount:verifiedRows.length,importantDateRows:verifiedRows.filter(r=>importantDates.includes(String(r.date||""))).length,writes:1});
 }catch(e){return send(res,500,{success:false,error:String(e&&e.message||e)})}
};