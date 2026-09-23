"use strict";
const {getFirestore}=require("../services/firebase/admin");
const TOKEN="haomen-mycar-diagnose-20260924-v1",IDS=["haomen-2027-01-04-0930-danshui","haomen-2027-01-04-1300-kuilei","haomen-2027-01-06-1300-youling","haomen-2027-01-12-0900-zuiyanglou","haomen-2027-01-12-1330-xiaoyi","haomen-2027-01-25-1300-meigui","haomen-2027-02-03-1400-zhulian","haomen-2027-02-22-1900-niedao","haomen-2027-03-09-0900-jinyuan","haomen-2027-03-15-1000-ziteng","haomen-2027-03-23-2000-shuixiu","haomen-2027-03-24-2000-shuiqiangwei"];
function t(v){return String(v==null?"":v).trim()}
function send(res,s,d){res.statusCode=s;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(d))}
module.exports=async function(req,res){
 if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
 if(t(req.query&&req.query.token)!==TOKEN)return send(res,403,{success:false,error:"invalid_token"});
 try{
  const db=getFirestore(),cars=[];
  for(const id of IDS){const s=await db.collection("cars").doc(id).get();cars.push({id,exists:s.exists,ownerId:s.exists?t((s.data()||{}).ownerId):"",myRole:s.exists?t((s.data()||{}).myRole):"",isPlayer:s.exists?((s.data()||{}).isPlayer===true):false});}
  const ownerIds=[...new Set(cars.map(x=>x.ownerId).filter(Boolean))];
  const aliasResults={};
  for(const ownerId of ownerIds){const a=await db.collection("myCarViewAliases").doc(ownerId).get();aliasResults[ownerId]=a.exists?a.data():null}
  const candidateIds=[...new Set(ownerIds.concat(Object.values(aliasResults).map(x=>x&&t(x.viewerId)).filter(Boolean)))];
  const views={};
  for(const id of candidateIds){const s=await db.collection("myCarViews").doc(id).get();const d=s.exists?s.data()||{}:{};const rows=Array.isArray(d.cars)?d.cars:[];views[id]={exists:s.exists,count:rows.length,haomenCount:rows.filter(c=>IDS.includes(t(c&&c.id))).length,identityIds:Array.isArray(d.identityIds)?d.identityIds:[]};}
  return send(res,200,{success:true,cars,ownerIds,aliasResults,views});
 }catch(e){return send(res,500,{success:false,error:String(e&&e.message||e)})}
};