"use strict";
const {loadFeed}=require("../services/calendar/personal-feed-service");
function createHandler(dependencies={}){
 const read=dependencies.loadFeed||loadFeed;
 return async function(req,res){
  res.setHeader("Cache-Control","private, no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Referrer-Policy","no-referrer");
  if(req.method!=="GET"){res.statusCode=405;return res.end();}
  const token=String(req.query?.token||"");
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)){res.statusCode=404;return res.end();}
  try{
   const feed=await read(token);
   if(!feed){res.statusCode=404;return res.end();}
   res.statusCode=200;
   res.setHeader("Content-Type","text/calendar; charset=utf-8");
   return res.end(feed);
  }catch(error){
   // Do not log token or full URL: subscription URL is a bearer secret.
   console.error("Personal calendar feed unavailable",error.code||error.name||"error");
   res.statusCode=503;
   return res.end();
  }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
