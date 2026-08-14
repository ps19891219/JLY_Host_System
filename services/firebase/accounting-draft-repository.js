"use strict";

const { getFirestore } = require("./admin");

async function saveAccountingDraft(draft) {
  const db = getFirestore(), carRef = db.collection("cars").doc(draft.carId), draftRef = carRef.collection("accountingDrafts").doc(draft.draftId), auditRef = carRef.collection("accountingDraftAuditLogs").doc();
  await db.runTransaction(async transaction => {
    const existing = await transaction.get(draftRef);
    if (existing.exists) return;
    transaction.set(draftRef, draft, { merge: false });
    transaction.set(auditRef, { auditId: auditRef.id, draftId: draft.draftId, action: "created", actorPersonId: draft.createdBy, before: null, after: draft, createdAt: draft.createdAt }, { merge: false });
  });
  return draft;
}

module.exports = { saveAccountingDraft };
