"use strict";

const { resolveGroupBinding } = require("./group-binding-service");
const { sendReplyMessage } = require("./line-reply");
const { buildMemberWelcomeCard } = require("./member-welcome-card");
const { getPublicBaseUrl } = require("./group-assistant-link");
const { getCarById } = require("../firebase/line-accounting-authorization-repository");
const { readWelcome } = require("./group-welcome-settings");

function text(value) {
  return String(value == null ? "" : value).trim();
}

async function readCarQuickly(carId, readCar, timeoutMs) {
  if (!carId || typeof readCar !== "function") return null;
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), timeoutMs));
  try {
    return await Promise.race([Promise.resolve(readCar(carId)).catch(() => null), timeout]);
  } catch (_error) {
    return null;
  }
}

async function sendMemberJoinedWelcome(event, dependencies = {}) {
  const source = event && event.source && typeof event.source === "object" ? event.source : {};
  const groupId = text(source.groupId);
  const replyToken = text(event && event.replyToken);

  if (text(source.type) !== "group" || !groupId || !replyToken) {
    return { handled: false, route: "member_joined_unsupported_source" };
  }

  const resolveBinding = dependencies.resolveGroupBinding || resolveGroupBinding;
  const reply = dependencies.sendReplyMessage || sendReplyMessage;
  const publicBaseUrl = dependencies.getPublicBaseUrl || getPublicBaseUrl;
  const readCar = dependencies.getCarById || getCarById;
  const readSettings = dependencies.readWelcome || readWelcome;
  let welcomeText = "";
  try {
    const settings = await readSettings(groupId);
    welcomeText = text(settings && settings.welcomeText);
  } catch (error) {
    console.error("LINE welcome settings read failed.", error);
  }

  let groupBinding;
  try {
    groupBinding = await resolveBinding(groupId);
  } catch (error) {
    console.error("LINE fast welcome binding lookup failed.", error);
    return { handled: false, route: "member_joined_binding_error" };
  }

  const carId = text(groupBinding && groupBinding.binding && groupBinding.binding.carId);
  if (!groupBinding || groupBinding.bound !== true || !carId) {
    await reply(replyToken, [{type:"text",text:welcomeText || "👋 歡迎加入群組！"}]);
    return { handled: true, route: "member_joined_unbound_welcome", groupBinding };
  }

  // Reply tokens are time-sensitive. Car metadata is nice-to-have only, so cap
  // that lookup and still send a working welcome card when the car read is slow.
  const car = await readCarQuickly(carId, readCar, 350);

  await reply(replyToken, [
    ...(welcomeText ? [{type:"text",text:welcomeText}] : []),
    buildMemberWelcomeCard(car, {
      baseUrl: publicBaseUrl(),
      carId
    })
  ]);

  return {
    handled: true,
    route: "member_joined_welcome",
    groupBinding,
    carId,
    usedGenericTitle: !car
  };
}

module.exports = {
  sendMemberJoinedWelcome,
  readCarQuickly
};
