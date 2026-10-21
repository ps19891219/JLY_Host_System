"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {newSubscriptionToken,hashSubscriptionToken,verifySubscriptionToken,buildSubscriptionUrl}=require("../../services/calendar/subscription-token");
test("tokens are unique, opaque and hashed",()=>{
 const first=newSubscriptionToken(),second=newSubscriptionToken();
 assert.notEqual(first,second);
 assert.equal(first.length,43);
 assert.equal(hashSubscriptionToken(first).length,64);
 assert.equal(verifySubscriptionToken(first,hashSubscriptionToken(first)),true);
 assert.equal(verifySubscriptionToken(second,hashSubscriptionToken(first)),false);
 assert.equal(verifySubscriptionToken("bad",hashSubscriptionToken(first)),false);
});
test("subscription URL only accepts a clean HTTPS origin",()=>{
 const token=newSubscriptionToken();
 assert.equal(new URL(buildSubscriptionUrl("https://jly-host-system-eeso.vercel.app/",token)).searchParams.get("token"),token);
 assert.throws(()=>buildSubscriptionUrl("http://example.com/",token),/invalid_subscription_origin/);
 assert.throws(()=>buildSubscriptionUrl("https://example.com/untrusted",token),/invalid_subscription_origin/);
});
