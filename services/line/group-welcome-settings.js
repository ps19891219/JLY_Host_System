"use strict";

const { getFirestore } = require("../firebase/admin");
const COLLECTION = "lineGroupWelcomeSettings";
const AUDIT = "changes";
const MAX_LENGTH = 1500;
function normalize(value) { return String(value == null ? "" : value).trim(); }
function validateWelcomeText(value) {
  const text = normalize(value);
  if (!text || text.length > MAX_LENGTH) throw new Error("welcome_text_invalid");
  return text;
}
async function readWelcome(groupId) {
  if (!normalize(groupId)) return null;
  const snap = await getFirestore().collection(COLLECTION).doc(groupId).get();
  return snap.exists ? snap.data() : null;
}
async function changeWelcome({groupId, actorId, text, restore = false}) {
  if (!normalize(groupId) || !normalize(actorId)) throw new Error("welcome_actor_missing");
  const next = restore ? "" : validateWelcomeText(text);
  const ref = getFirestore().collection(COLLECTION).doc(groupId);
  return getFirestore().runTransaction(async transaction => {
    const before = await transaction.get(ref);
    const previous = normalize(before.exists && before.data().welcomeText);
    const audit = ref.collection(AUDIT).doc();
    const now = new Date().toISOString();
    transaction.set(ref, {groupId, welcomeText: next, updatedAt: now, updatedBy: actorId}, {merge:true});
    transaction.set(audit, {groupId, actorId, at: now, action: restore ? "restore" : "set", before: previous, after: next});
    return {previous, current:next};
  });
}
module.exports = {readWelcome, changeWelcome, validateWelcomeText, MAX_LENGTH};
