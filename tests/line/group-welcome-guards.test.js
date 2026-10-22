"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {handleWelcomeCommand} = require("../../services/line/group-welcome-command");
const {buildMemberWelcomeCard} = require("../../services/line/member-welcome-card");

function context(groupId, userId, message) {
  return {source:{type:"group",groupId,userId},message:{text:message}};
}

test("welcome edit rejects unknown group binding state", async () => {
  let writes=0;
  const result=await handleWelcomeCommand(
    context("group-A","user-A","助手 設定歡迎詞 Hi"),
    {bound:false,reason:"binding_lookup_failed"},
    {changeWelcome:async()=>{writes++;}}
  );
  assert.match(result.message,/無法確認群組車團狀態/);
  assert.equal(writes,0);
});

test("unbound welcome edit rejects failed LINE membership check", async () => {
  let writes=0;
  const result=await handleWelcomeCommand(
    context("group-A","user-A","助手 設定歡迎詞 Hi"),
    {bound:false},
    {getGroupMemberProfile:async()=>{throw new Error("not a member");},
     changeWelcome:async()=>{writes++;}}
  );
  assert.match(result.message,/無法確認群組成員身分/);
  assert.equal(writes,0);
});

test("custom car welcome replaces heading and keeps all three buttons",()=>{
  const card=buildMemberWelcomeCard(
    {scriptName:"劇本測試"},
    {carId:"car-A",baseUrl:"https://example.com",welcomeText:"歡迎加入！"}
  );
  assert.equal(card.contents.header.contents[0].text,"歡迎加入！");
  assert.deepEqual(
    card.contents.body.contents.filter(x=>x.type==="button").map(x=>x.action.label),
    ["🎭 我是本場 DM","🎮 我要報名玩家","📅 加入我的行事曆"]
  );
});
