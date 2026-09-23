"use strict";
const {getFirestore}=require("../services/firebase/admin");
const dates=["2027-10-04","2027-11-01","2027-12-01"];
const token="guzhu-20270923-4f8a";
function send(res,status,data){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data));}
module.exports=async function handler(req,res){
 if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
 if(String(req.query&&req.query.token||"")!==token)return send(res,403,{success:false,error:"invalid_token"});
 try{
  const db=getFirestore(),source={},views={};
  for(const date of dates){
   const snap=await db.collection("workShifts").where("date","==",date).get();
   source[date]=snap.docs.map(d=>({id:d.id,...d.data()}));
  }
  for(const mk of ["2027-10","2027-11","2027-12"]){
   const doc=await db.collection("workScheduleViews").doc("month-"+mk).get();
   const data=doc.exists?doc.data()||{}:null;
   views[mk]={exists:doc.exists,count:data&&Array.isArray(data.rows)?data.rows.length:0,rows:data&&Array.isArray(data.rows)?data.rows.filter(r=>dates.includes(String(r.date||""))):[]};
  }
  return send(res,200,{success:true,source,views});
 }catch(e){return send(res,500,{success:false,error:String(e&&e.message||e)})}
};