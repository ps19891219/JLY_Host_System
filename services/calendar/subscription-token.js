"use strict";
const crypto=require("node:crypto");
const TOKEN_BYTES=32;
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
function newSubscriptionToken(){return crypto.randomBytes(TOKEN_BYTES).toString("base64url");}
function hashSubscriptionToken(token){
 if(typeof token!=="string"||!tokenPattern.test(token))throw new Error("invalid_subscription_token");
 return crypto.createHash("sha256").update(token,"utf8").digest("hex");
}
function verifySubscriptionToken(token,storedHash){
 if(typeof storedHash!=="string"||!/^[a-f0-9]{64}$/.test(storedHash))return false;
 let hash;
 try{hash=hashSubscriptionToken(token)}catch(_){return false}
 return crypto.timingSafeEqual(Buffer.from(hash,"hex"),Buffer.from(storedHash,"hex"));
}
function buildSubscriptionUrl(origin,token){
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")throw new Error("invalid_subscription_origin");
 hashSubscriptionToken(token);
 return new URL("/api/personal-calendar-feed?token="+encodeURIComponent(token),url).toString();
}
module.exports={newSubscriptionToken,hashSubscriptionToken,verifySubscriptionToken,buildSubscriptionUrl};
