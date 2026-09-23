"use strict";
const { getFirestore } = require("../services/firebase/admin");

const PAGE_SIZE=25,MAX_DOCS=1000,MAX_VIEW_BYTES=900000,BUILD_ID="person-final-20260923";
const TOKEN="pdv-m8ckdnxn8womudqoyc1";
const text=v=>String(v==null?"":v).trim();
const list=v=>Array.isArray(v)?v:[];
const bytes=v=>Buffer.byteLength(JSON.stringify(v||{}),"utf8");

function compact(p,id){
 const row={...(p||{}),id:text(id||(p&&p.id))};
 return {
  id:row.id,
  canonicalPersonId:text(row.canonicalPersonId||row.mergedIntoPersonId||row.personId||row.id),
  displayName:text(row.displayName||row.nickname||row.playerName||row.lineDisplayName),
  nickname:text(row.nickname),playerName:text(row.playerName),lineDisplayName:text(row.lineDisplayName),
  aliases:list(row.aliases).map(text).filter(Boolean),linkedPlayerIds:list(row.linkedPlayerIds).map(text).filter(Boolean),
  lineUserId:text(row.lineUserId),lineIdentityId:text(row.lineIdentityId),identityId:text(row.identityId),
  profileId:text(row.profileId),personId:text(row.personId),mergedIntoPersonId:text(row.mergedIntoPersonId),
  identityStatus:text(row.identityStatus),memberType:text(row.memberType),type:text(row.type),status:text(row.status),
  note:text(row.note||row.hostNote),playCount:Number(row.playCount||0),updatedAt:row.updatedAt||null
 };
}
function apply(view,person,id){
 const base=view&&typeof view==="object"?view:{};
 const rows=list(base.people).filter(Boolean);
 const next=compact(person,id);
 const retired=["deleted","removed","merged"].includes(next.status)||!!text(next.mergedIntoPersonId);
 const removeIds=new Set((retired?[next.id]:[next.id,next.canonicalPersonId,...next.linkedPlayerIds]).map(text).filter(Boolean));
 const prior=rows.find(r=>text(r.id)===next.id||text(r.canonicalPersonId)===next.id)||{};
 next.aliases=Array.from(new Set([...list(prior.aliases),prior.displayName,prior.nickname,prior.playerName,prior.lineDisplayName,...next.aliases,next.displayName,next.nickname,next.playerName,next.lineDisplayName].map(text).filter(Boolean)));
 next.linkedPlayerIds=Array.from(new Set([...list(prior.linkedPlayerIds),...next.linkedPlayerIds].map(text).filter(Boolean)));
 const kept=rows.filter(r=>{
  const ids=[r&&r.id,r&&r.canonicalPersonId,...list(r&&r.linkedPlayerIds)].map(text).filter(Boolean);
  return !ids.some(x=>removeIds.has(x));
 });
 if(!retired)kept.push(next);
 kept.sort((a,b)=>text(a.displayName).localeCompare(text(b.displayName),"zh-Hant"));
 return {...base,schemaVersion:1,people:kept,count:kept.length,updatedAt:new Date().toISOString()};
}
function send(res,status,data){
 res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(data));
}
module.exports=async function handler(req,res){
 try{
  if(req.method!=="GET")return send(res,405,{success:false,error:"method_not_allowed"});
  if(String(process.env.VERCEL_ENV||"")!=="production")return send(res,403,{success:false,error:"production_only"});
  if(text(req.query&&req.query.token)!==TOKEN)return send(res,403,{success:false,error:"invalid_token"});
  const db=getFirestore();
  let q=db.collection("players").orderBy("__name__").limit(PAGE_SIZE);
  let scanned=0,eligible=0,retiredCount=0,lastId="",sourceExhausted=false,pages=0,view={schemaVersion:1,people:[],count:0,updatedAt:null};
  while(scanned<MAX_DOCS){
   const snap=await q.get();pages++;
   if(snap.empty){sourceExhausted=true;break;}
   for(const doc of snap.docs){
    scanned++;lastId=doc.id;
    const c=compact(doc.data()||{},doc.id);
    const retired=["deleted","removed","merged"].includes(c.status)||!!c.mergedIntoPersonId;
    if(retired)retiredCount++; else eligible++;
    view=apply(view,doc.data()||{},doc.id);
    if(scanned>=MAX_DOCS)break;
   }
   if(snap.size<PAGE_SIZE){sourceExhausted=true;break;}
   if(scanned>=MAX_DOCS)break;
   q=db.collection("players").orderBy("__name__").startAfter(lastId).limit(PAGE_SIZE);
  }
  const dryRun={scanned,eligible,retiredCount,lastId,pages,sourceExhausted,writes:0,collectionsRead:["players"],collectionsWritten:[]};
  if(!sourceExhausted)throw new Error("source_exceeds_max_docs");
  if(scanned<1)throw new Error("source_empty");
  if(view.count!==eligible)throw new Error("eligible_count_mismatch");
  if(retiredCount>Math.max(50,Math.ceil(scanned*0.2)))throw new Error("retired_ratio_too_high");
  const viewBytes=bytes(view);
  if(viewBytes>MAX_VIEW_BYTES)throw new Error("view_too_large");
  const ids=view.people.map(x=>x.id),uniqueIds=new Set(ids);
  if(uniqueIds.size!==ids.length)throw new Error("duplicate_visible_ids");

  const buildRef=db.collection("personDirectoryViewBuilds").doc(BUILD_ID);
  const canonicalRef=db.collection("personDirectoryViews").doc("canonical");
  const backupRef=db.collection("personDirectoryViewSnapshots").doc(BUILD_ID);
  const existingBuild=await buildRef.get();
  const existingBackup=await backupRef.get();
  if(existingBuild.exists||existingBackup.exists)throw new Error("build_or_snapshot_already_exists");

  const staged={...view,initializer:{source:"players",buildId:BUILD_ID,lastId,totalScanned:scanned,completed:true,updatedAt:new Date().toISOString()}};
  await buildRef.set(staged,{merge:false});

  const promoted=await db.runTransaction(async tx=>{
   const build=await tx.get(buildRef),canonical=await tx.get(canonicalRef),backup=await tx.get(backupRef);
   if(!build.exists)throw new Error("build_not_found_after_stage");
   if(!(build.data().initializer&&build.data().initializer.completed))throw new Error("build_not_completed");
   if(backup.exists)throw new Error("snapshot_already_exists");
   if(bytes(build.data())>MAX_VIEW_BYTES)throw new Error("staged_view_too_large");
   if(canonical.exists&&bytes(canonical.data())>MAX_VIEW_BYTES)throw new Error("canonical_snapshot_too_large");
   tx.create(backupRef,{snapshotOf:"personDirectoryViews/canonical",buildId:BUILD_ID,existed:canonical.exists,snapshottedAt:new Date().toISOString(),data:canonical.exists?canonical.data():null});
   tx.set(canonicalRef,{...build.data(),promotedAt:new Date().toISOString()},{merge:false});
   return {previousCanonicalExisted:canonical.exists};
  });

  const [verifyCanonical,verifyBackup,verifyBuild]=await Promise.all([canonicalRef.get(),backupRef.get(),buildRef.get()]);
  if(!verifyCanonical.exists||!verifyBackup.exists||!verifyBuild.exists)throw new Error("verify_missing_document");
  const canonical=verifyCanonical.data()||{},build=verifyBuild.data()||{};
  if(canonical.count!==view.count||build.count!==view.count)throw new Error("verify_count_mismatch");
  if(!(canonical.initializer&&canonical.initializer.buildId===BUILD_ID))throw new Error("verify_build_id_mismatch");
  const result={success:true,buildId:BUILD_ID,dryRun,staging:{count:build.count,bytes:bytes(build),writes:1},promotion:{snapshotCreated:true,canonicalWrites:1,previousCanonicalExisted:promoted.previousCanonicalExisted},verify:{canonicalCount:canonical.count,snapshotExists:true,buildExists:true,totalWrites:3}};
  console.log("[PERSON_DIRECTORY_FINALIZE]",JSON.stringify(result));
  return send(res,200,result);
 }catch(e){
  console.error("[PERSON_DIRECTORY_FINALIZE_ERROR]",e&&e.stack||e);
  return send(res,500,{success:false,error:String(e&&e.message||e)});
 }
};