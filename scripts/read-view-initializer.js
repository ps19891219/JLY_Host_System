"use strict";

/**
 * JLY Read View initializer.
 * Safety rules:
 * - DRY RUN by default. Writing requires --apply.
 * - Source of Truth is read-only.
 * - No deletes, no SoT updates, no Calendar/LINE side effects.
 * - Explicit bounded page size and max document budget.
 * - Resume with --after=<docId>.
 *
 * Initial scope intentionally limited to canonical Person Directory.
 * Other projections must be added only when their source/projection contract
 * is verified independently.
 */
const { getFirestore } = require("../services/firebase/admin");
const personView = require("../services/firebase/person-directory-view-repository");

const args = new Set(process.argv.slice(2));
const value = name => {
  const p = process.argv.slice(2).find(x => x.startsWith("--" + name + "="));
  return p ? p.slice(name.length + 3) : "";
};
const APPLY = args.has("--apply");
const PAGE_SIZE = Math.max(1, Math.min(100, Number(value("page-size") || 25)));
const MAX_DOCS = Math.max(1, Math.min(1000, Number(value("max-docs") || 100)));
const AFTER = value("after");
const SCOPE = value("scope") || "person-directory";

async function runPersonDirectory(db) {
  let q = db.collection("players").orderBy("__name__").limit(PAGE_SIZE);
  if (AFTER) q = q.startAfter(AFTER);
  let scanned = 0, eligible = 0, lastId = AFTER || null;
  let view = { schemaVersion: 1, people: [], count: 0, updatedAt: null };

  while (scanned < MAX_DOCS) {
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      if (scanned >= MAX_DOCS) break;
      scanned += 1; lastId = doc.id;
      const row = doc.data() || {};
      const compact = personView.compact(row, doc.id);
      if (!["deleted","removed","merged"].includes(compact.status) && !compact.mergedIntoPersonId) eligible += 1;
      if (APPLY) view = personView.applyPersonMutation(view, row, doc.id);
    }
    if (snap.size < PAGE_SIZE || scanned >= MAX_DOCS) break;
    q = db.collection("players").orderBy("__name__").startAfter(lastId).limit(PAGE_SIZE);
  }

  if (APPLY) {
    await db.collection("personDirectoryViews").doc("canonical").set({
      ...view,
      initializer: { source: "players", scanned, lastId, completed: scanned < MAX_DOCS, updatedAt: new Date().toISOString() }
    }, { merge: false });
  }
  return { scope: SCOPE, mode: APPLY ? "apply" : "dry-run", scanned, eligible, lastId, pageSize: PAGE_SIZE, maxDocs: MAX_DOCS };
}

async function main() {
  if (SCOPE !== "person-directory") throw new Error("unsupported_scope");
  const result = await runPersonDirectory(getFirestore());
  console.log(JSON.stringify(result, null, 2));
  if (!APPLY) console.log("DRY RUN ONLY. No Firestore writes were performed.");
}
main().catch(err => { console.error(err); process.exitCode = 1; });
