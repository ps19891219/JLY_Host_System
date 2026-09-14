"use strict";

const {
  getFirestore
} = require("../services/firebase/admin");

const {
  readCookie,
  verifyMemberSession
} = require("../services/line/member-session");

const {
  removeCarFromView
} = require("../services/car/mycar-view-cleanup");

const {
  findPlayerByLineUserId,
  listPlayersForIdentityResolution
} = require("../services/firebase/line-accounting-authorization-repository");

const {
  getIdentityIds,
  buildIdentityComponent,
  identityIdsOwnCar
} = require("../services/line/group-car-binding-service");

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch (_error) {
    return {};
  }
}

function text(value) {
  return String(value == null ? "" : value).trim();
}

async function getAuthorizedActorIds(db, session) {
  const actorIds = new Set();

  [session && session.profileId, session && session.identityId]
    .map(text)
    .filter(Boolean)
    .forEach(id => actorIds.add(id));

  const profileId = text(session && session.profileId);
  if (db && profileId) {
    try {
      const profileSnapshot = await db.collection("players").doc(profileId).get();
      if (profileSnapshot.exists) {
        const profile = { id: profileSnapshot.id, ...(profileSnapshot.data() || {}) };
        getIdentityIds(profile).forEach(id => actorIds.add(id));
      }
    } catch (error) {
      console.warn("讀取正式 Player Profile identity 失敗：", error);
    }
  }

  const lineUserId = text(session && session.lineUserId);
  if (lineUserId) {
    try {
      const directPlayer = await findPlayerByLineUserId(lineUserId);
      if (directPlayer) {
        getIdentityIds(directPlayer).forEach(id => actorIds.add(id));
      }

      const rows = await listPlayersForIdentityResolution();
      const component = buildIdentityComponent(rows, lineUserId);
      if (component && component.valid && component.ids) {
        component.ids.forEach(id => actorIds.add(id));
      }
    } catch (error) {
      console.warn("解析 canonical Person identity history 失敗：", error);
    }
  }

  return actorIds;
}

async function deleteSubcollection(collectionRef) {
  const snapshot = await collectionRef.get();
  if (snapshot.empty) return 0;

  const db = getFirestore();
  const docs = snapshot.docs;
  let deleted = 0;

  for (let index = 0; index < docs.length; index += 400) {
    const batch = db.batch();
    const chunk = docs.slice(index, index + 400);
    chunk.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

async function disableLineBindingsByCarId(carId) {
  const db = getFirestore();
  const snapshot = await db
    .collection("lineGroupBindings")
    .where("carId", "==", carId)
    .get();

  if (snapshot.empty) return 0;

  let updated = 0;
  const now = new Date().toISOString();

  for (let index = 0; index < snapshot.docs.length; index += 400) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(index, index + 400);

    chunk.forEach(doc => {
      batch.set(doc.ref, {
        status: "inactive",
        inactiveReason: "test_car_deleted",
        inactiveAt: now,
        updatedAt: now
      }, { merge: true });
    });

    await batch.commit();
    updated += chunk.length;
  }

  return updated;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { success: false, error: "method_not_allowed" });
  }

  try {
    const session = verifyMemberSession(readCookie(req));
    if (!session.valid) {
      return send(res, 401, { success: false, error: "line_login_required" });
    }

    const input = parseBody(req);
    const carId = text(input.carId);
    if (!carId) {
      return send(res, 400, { success: false, error: "car_id_required" });
    }

    const db = getFirestore();
    const carRef = db.collection("cars").doc(carId);
    const snapshot = await carRef.get();

    if (!snapshot.exists) {
      return send(res, 404, { success: false, error: "car_not_found" });
    }

    const car = { id: snapshot.id, ...(snapshot.data() || {}) };
    const actorIds = await getAuthorizedActorIds(db, session.data);

    if (!identityIdsOwnCar(actorIds, car)) {
      return send(res, 403, { success: false, error: "car_owner_required" });
    }

    const disabledBindings = await disableLineBindingsByCarId(carId);

    const collectionsToDelete = [
      "accountingEntries",
      "accountingViews",
      "accountingAuditLogs",
      "accountingPendingActions",
      "accountingMigrations"
    ];

    const deletedCollections = {};
    for (const name of collectionsToDelete) {
      deletedCollections[name] = await deleteSubcollection(carRef.collection(name));
    }

    const candidateViewIds = Array.from(new Set([
      text(car.ownerId),
      text(car.ownerProfileId),
      text(car.ownerPersonId),
      text(car.hostProfileId),
      text(car.hostPersonId),
      ...Array.from(actorIds)
    ].filter(Boolean)));

    const finalBatch = db.batch();
    let cleanedViews = 0;

    for (const viewId of candidateViewIds) {
      const viewRef = db.collection("myCarViews").doc(viewId);
      const viewSnapshot = await viewRef.get();
      if (!viewSnapshot.exists) continue;

      const cleanup = removeCarFromView(
        viewSnapshot.data(),
        carId,
        new Date().toISOString()
      );

      if (cleanup.changed && cleanup.view) {
        finalBatch.set(viewRef, cleanup.view, { merge: false });
        cleanedViews += 1;
      }
    }

    finalBatch.delete(carRef);
    await finalBatch.commit();

    return send(res, 200, {
      success: true,
      carId,
      disabledBindings,
      deletedCollections,
      myCarViewCleaned: cleanedViews > 0,
      myCarViewsCleaned: cleanedViews
    });
  } catch (error) {
    console.error("測試車永久刪除失敗", error);
    return send(res, 500, { success: false, error: "test_car_delete_failed" });
  }
};
