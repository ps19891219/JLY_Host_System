"use strict";
const {getFirestore} = require("../firebase/admin");
const COLLECTION = "lineGroupWelcomeSettings";

function boundedLimit(pageSize) {
  return Math.min(50, Math.max(1, Number(pageSize) || 20));
}

async function listWelcomeGroups(pageSize = 20, afterId = "") {
  const db = getFirestore();
  const limit = boundedLimit(pageSize);
  let query = db.collection(COLLECTION).orderBy("__name__").limit(limit + 1);
  if (afterId) query = query.startAfter(db.collection(COLLECTION).doc(afterId));
  const snapshot = await query.get();
  const docs = snapshot.docs.slice(0, limit);
  return {
    groups: docs.map(doc => ({groupId: doc.id, ...doc.data()})),
    nextId: snapshot.docs.length > limit && docs.length ? docs[docs.length - 1].id : ""
  };
}

async function listWelcomeChanges(groupId, pageSize = 20, afterId = "") {
  if (!groupId || typeof groupId !== "string" || groupId.includes("/")) {
    throw new Error("group_id_required");
  }
  const db = getFirestore();
  const limit = boundedLimit(pageSize);
  const collection = db.collection(COLLECTION).doc(groupId).collection("changes");
  let query = collection.orderBy("at", "desc").limit(limit + 1);
  if (afterId) {
    const cursor = await collection.doc(afterId).get();
    if (!cursor.exists) throw new Error("invalid_audit_cursor");
    query = query.startAfter(cursor);
  }
  const snapshot = await query.get();
  const docs = snapshot.docs.slice(0, limit);
  return {
    changes: docs.map(doc => ({id: doc.id, ...doc.data()})),
    nextId: snapshot.docs.length > limit && docs.length ? docs[docs.length - 1].id : ""
  };
}

module.exports = {listWelcomeGroups, listWelcomeChanges};
