"use strict";
const {getFirestore} = require("../firebase/admin");
const COLLECTION = "lineGroupWelcomeSettings";

async function listWelcomeGroups(pageSize = 20, afterId = "") {
  const db = getFirestore();
  const limit = Math.min(50, Math.max(1, Number(pageSize) || 20));
  let query = db.collection(COLLECTION).orderBy("__name__").limit(limit);
  if (afterId) query = query.startAfter(db.collection(COLLECTION).doc(afterId));
  const snapshot = await query.get();
  return {
    groups: snapshot.docs.map(doc => ({groupId: doc.id, ...doc.data()})),
    nextId: snapshot.size === limit ? snapshot.docs[snapshot.docs.length - 1].id : ""
  };
}

async function listWelcomeChanges(groupId, pageSize = 20) {
  if (!groupId) throw new Error("group_id_required");
  const limit = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const snapshot = await getFirestore().collection(COLLECTION).doc(groupId)
    .collection("changes").orderBy("at", "desc").limit(limit).get();
  return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
}

module.exports = {listWelcomeGroups, listWelcomeChanges};
