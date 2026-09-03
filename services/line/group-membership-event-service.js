"use strict";

const { resolveGroupBinding } = require("./group-binding-service");
const { getCarById } = require("../firebase/line-accounting-authorization-repository");
const { markMembershipChanged } = require("./group-membership-health-service");

function text(value) { return String(value == null ? "" : value).trim(); }
function members(event, key) {
  const rows = event && event[key] && Array.isArray(event[key].members)
    ? event[key].members
    : [];
  return rows.map(member => ({
    type: text(member && member.type),
    userId: text(member && member.userId)
  })).filter(member => member.userId);
}

async function processMembershipEvent(event, dependencies = {}) {
  const type = text(event && event.type);
  if (!["memberJoined", "memberLeft"].includes(type)) {
    return { handled: false, reason: "not_membership_event" };
  }
  const source = event && event.source || {};
  const groupId = text(source.groupId);
  if (text(source.type) !== "group" || !groupId) {
    return { handled: false, reason: "group_required" };
  }
  const resolve = dependencies.resolveGroupBinding || resolveGroupBinding;
  const bindingResult = await resolve(groupId);
  if (!bindingResult || !bindingResult.bound || !bindingResult.binding) {
    return { handled: false, reason: "group_unbound" };
  }
  const carId = text(bindingResult.binding.carId);
  const readCar = dependencies.getCarById || getCarById;
  const car = await readCar(carId);
  if (!car) return { handled: false, reason: "car_not_found" };
  const mark = dependencies.markMembershipChanged || markMembershipChanged;
  const result = await mark({
    eventType: type,
    groupId,
    carId,
    car,
    joinedMembers: type === "memberJoined" ? members(event, "joined") : [],
    leftMembers: type === "memberLeft" ? members(event, "left") : []
  }, dependencies);
  return { handled: result.changed === true, reason: result.reason, carId, groupId, result };
}

async function processMembershipEvents(events, dependencies = {}) {
  const results = [];
  for (const event of (Array.isArray(events) ? events : [])) {
    if (["memberJoined", "memberLeft"].includes(text(event && event.type))) {
      try {
        results.push(await processMembershipEvent(event, dependencies));
      } catch (error) {
        console.error("LINE membership event processing failed.", error);
        results.push({ handled: false, reason: "membership_processing_failed" });
      }
    }
  }
  return results;
}

module.exports = { processMembershipEvent, processMembershipEvents };
