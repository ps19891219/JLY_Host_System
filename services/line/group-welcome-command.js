"use strict";
const {readWelcome, changeWelcome} = require("./group-welcome-settings");
const {findPlayerByLineUserId, getCarById} = require("../firebase/line-accounting-authorization-repository");
const {getIdentityIds} = require("./group-car-binding-service");
const {getCarAccountingManagerIds} = require("./accounting-authorization-service");
const {getGroupMemberProfile} = require("./group-membership-client");
function text(value){return String(value == null ? "" : value).trim();}
function parseWelcomeCommand(input) {
  const message = text(input);
  if (/^(?:jly\s*)?助手\s*查看歡迎詞$/i.test(message)) return {action:"view"};
  if (/^(?:jly\s*)?助手\s*恢復預設歡迎詞$/i.test(message)) return {action:"restore"};
  const match = message.match(/^(?:jly\s*)?助手\s*設定歡迎詞\s+([\s\S]+)$/i);
  if (match) return {action:"set", content:match[1].trim()};
  return null;
}
async function canEditBoundGroup(userId, carId, dependencies = {}) {
  const findActor = dependencies.findPlayerByLineUserId || findPlayerByLineUserId;
  const readCar = dependencies.getCarById || getCarById;
  const [actor,car] = await Promise.all([findActor(userId),readCar(carId)]);
  if (!actor || !car) return false;
  const ids = new Set(getIdentityIds(actor));
  return getCarAccountingManagerIds(car).some(id=>ids.has(id));
}
async function handleWelcomeCommand(context, binding, dependencies = {}) {
  const command = parseWelcomeCommand(context && context.message && context.message.text);
  if (!command) return null;
  const groupId = text(context && context.source && context.source.groupId);
  const actorId = text(context && context.source && context.source.userId);
  if (!groupId || !actorId || context.source.type !== "group") return {message:"請在 LINE 群組內使用歡迎詞指令。"};
  const bound = binding && binding.bound === true;
  if (command.action === "view") {
    const settings = await (dependencies.readWelcome || readWelcome)(groupId);
    return {message: text(settings && settings.welcomeText) || (bound ? "目前使用原本車團歡迎卡片。" : "目前使用一般群組預設歡迎詞。")};
  }
  if (!bound) {
    try {
      const profile = await (dependencies.getGroupMemberProfile || getGroupMemberProfile)(groupId, actorId);
      if (!profile || text(profile.userId) !== actorId) return {message:"無法確認你仍在本群組，歡迎詞未修改。"};
    } catch (_error) {
      return {message:"暫時無法確認群組成員身分，歡迎詞未修改。"};
    }
  }
  if (bound && !(await canEditBoundGroup(actorId, text(binding.binding && binding.binding.carId), dependencies))) {
    return {message:"只有本車團主揪或授權管理者可以修改歡迎詞。"};
  }
  try {
    await (dependencies.changeWelcome || changeWelcome)({groupId,actorId,text:command.content,restore:command.action==="restore"});
    return {message:command.action==="restore" ? "✅ 已恢復預設歡迎詞！" : "✅ 歡迎詞設定成功！"};
  } catch(error) {
    if (error.message==="welcome_text_invalid") return {message:"歡迎詞請輸入 1 至 1500 字。"};
    throw error;
  }
}
module.exports = {parseWelcomeCommand,handleWelcomeCommand,canEditBoundGroup};
