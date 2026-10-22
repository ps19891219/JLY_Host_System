"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {parseWelcomeCommand,handleWelcomeCommand} = require("../../services/line/group-welcome-command");
const {sendMemberJoinedWelcome} = require("../../services/line/member-welcome-fastpath");
test("parse multiline custom welcome",()=>{
  assert.deepEqual(parseWelcomeCommand("助手 設定歡迎詞 歡迎！\n請閱讀記事本"),{action:"set",content:"歡迎！\n請閱讀記事本"});
  assert.equal(parseWelcomeCommand("助手 恢復預設歡迎詞").action,"restore");
  assert.equal(parseWelcomeCommand("助手 查看歡迎詞").action,"view");
  assert.equal(parseWelcomeCommand("大家好"),null);
});
test("unbound group member may set welcome and receives a brief reply",async()=>{
  let saved;
  const result=await handleWelcomeCommand({source:{type:"group",groupId:"g1",userId:"u1"},message:{text:"助手 設定歡迎詞 歡迎加入"}},{bound:false},{changeWelcome:async data=>{saved=data;}});
  assert.equal(result.message,"✅ 歡迎詞設定成功！");
  assert.equal(saved.groupId,"g1");
  assert.equal(saved.actorId,"u1");
});
test("bound group refuses an unlinked actor",async()=>{
  let writes=0;
  const result=await handleWelcomeCommand({source:{type:"group",groupId:"g1",userId:"u1"},message:{text:"助手 恢復預設歡迎詞"}},{bound:true,binding:{carId:"car1"}},{findPlayerByLineUserId:async()=>null,getCarById:async()=>({}),changeWelcome:async()=>{writes++;}});
  assert.match(result.message,/只有本車團/);
  assert.equal(writes,0);
});
test("unbound memberJoined receives text only",async()=>{
  let messages;
  await sendMemberJoinedWelcome({source:{type:"group",groupId:"g1"},replyToken:"r1"},{resolveGroupBinding:async()=>({bound:false}),readWelcome:async()=>({welcomeText:"歡迎加入"}),sendReplyMessage:async(_,sent)=>{messages=sent;}});
  assert.deepEqual(messages,[{type:"text",text:"歡迎加入"}]);
});
test("bound memberJoined keeps the existing flex card",async()=>{
  let messages;
  await sendMemberJoinedWelcome({source:{type:"group",groupId:"g1"},replyToken:"r1"},{resolveGroupBinding:async()=>({bound:true,binding:{carId:"car1"}}),readWelcome:async()=>({welcomeText:"請先看記事本"}),getCarById:async()=>({scriptName:"測試劇本"}),getPublicBaseUrl:()=> "https://example.test",sendReplyMessage:async(_,sent)=>{messages=sent;}});
  assert.equal(messages.length,2);
  assert.equal(messages[0].text,"請先看記事本");
  assert.equal(messages[1].type,"flex");
  assert.equal(messages[1].contents.body.contents.filter(x=>x.type==="button").length,3);
});
