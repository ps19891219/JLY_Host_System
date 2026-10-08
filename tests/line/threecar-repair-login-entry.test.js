"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {allowsVerifiedFirstLink,allowsExistingIdentityRecovery}=require("../../api/line-login");
const loginState = require("../../api/line-login-state");
const read=pathSuffix=>fs.readFileSync(path.join(__dirname,"../../",pathSuffix),"utf8");
test("three-car maintenance purpose only recovers an already-linked formal LINE identity",()=>{
 assert.equal(allowsExistingIdentityRecovery("car_repair_entry"),true);
 assert.equal(allowsVerifiedFirstLink("car_repair_entry"),false);
 assert.equal(allowsExistingIdentityRecovery("car_player_entry"),true);
 assert.equal(allowsVerifiedFirstLink("car_player_entry"),true);
 assert.equal(allowsVerifiedFirstLink("work_schedule_staff_entry"),false);
});
test("LINE login state explicitly supports new narrow maintenance purpose",()=>{
 assert.match(read("api/line-login-state.js"),/"car_repair_entry"/);
 assert.ok(typeof loginState==="function");
});
test("repair UI loads existing LINE OAuth launcher before batch client",()=>{
 const page=read("pages/car-detail.html");
 assert.ok(page.includes('src="/js/line.js?v=2"'));
 assert.ok(page.indexOf('src="/js/line.js?v=2"')<page.indexOf('src="/js/modules/car/detail/car-detail-view-batch-repair.js?v=3"'));
});
test("repair form only begins LINE authentication on explicit login button click",()=>{
 const batch=read("js/modules/car/detail/car-detail-view-batch-repair.js");
 assert.match(batch,/loginButton\.addEventListener\("click"/);
 assert.match(batch,/login\.start\(\{\s*returnPath: root\.location\.pathname \+ root\.location\.search,\s*purpose: "car_repair_entry"/);
 assert.match(batch,/panel\.append\(intro, explanation, loginButton, button, list, status\)/);
 assert.match(batch,/line_login_required: "此瀏覽器尚未完成/);
});
test("new login purpose preserves signed session callback and old pairing endpoint",()=>{
 const callback=read("js/line-callback.js");
 const state=read("services/line/login-state.js");
 const backend=read("api/line-group-pairing-code.js");
 assert.match(callback,/exchangeLineAuthorizationCode/);
 assert.match(state,/verifyLoginState/);
 assert.match(backend,/verifyMemberSession\(readCookie\(req\)\)/);
});
