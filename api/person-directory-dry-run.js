"use strict";
const { getFirestore } = require("../services/firebase/admin");
const personView = require("../services/firebase/person-directory-view-repository");

function send(res,status,data){
  res.statusCode=status;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(data));
}

module.exports=async function handler(req,res){
  if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
  if(String(process.env.VERCEL_ENV||"")!=="preview")return send(res,403,{success:false,error:"preview_only"});
  const pageSize=Math.max(1,Math.min(25,Number(req.query&&req.query.pageSize||25)));
  const maxDocs=Math.max(1,Math.min(100,Number(req.query&&req.query.maxDocs||100)));
  const after=String(req.query&&req.query.after||"").trim();
  const db=getFirestore();
  let q=db.collection("players").orderBy("__name__").limit(pageSize);
  if(after)q=q.startAfter(after);
  let scanned=0,eligible=0,lastId=after||null,sourceExhausted=false,pages=0;
  while(scanned<maxDocs){
    const snap=await q.get();
    pages++;
    if(snap.empty){sourceExhausted=true;break;}
    for(const doc of snap.docs){
      if(scanned>=maxDocs)break;
      scanned++;
      lastId=doc.id;
      const c=personView.compact(doc.data()||{},doc.id);
      if(!["deleted","removed","merged"].includes(c.status)&&!c.mergedIntoPersonId)eligible++;
    }
    if(snap.size<pageSize){sourceExhausted=true;break;}
    if(scanned>=maxDocs)break;
    q=db.collection("players").orderBy("__name__").startAfter(lastId).limit(pageSize);
  }
  const result={success:true,mode:"dry-run",scope:"person-directory",scanned,eligible,lastId,pageSize,maxDocs,pages,sourceExhausted,writes:0,collectionsRead:["players"],collectionsWritten:[]};\n  console.log("[PERSON_DIRECTORY_DRY_RUN]",JSON.stringify(result));\n  return send(res,200,result);
};
