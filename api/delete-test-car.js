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


// ============================================================
// Helpers
// ============================================================

function send(res, status, data) {
  res.statusCode = status;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.end(
    JSON.stringify(data)
  );
}


function parseBody(req) {
  if (
    req.body &&
    typeof req.body === "object"
  ) {
    return req.body;
  }

  try {
    return JSON.parse(
      req.body || "{}"
    );
  } catch (_error) {
    return {};
  }
}


function text(value) {
  return String(
    value == null
      ? ""
      : value
  ).trim();
}


function getSessionIds(session) {
  return new Set(
    [
      session.profileId,
      session.identityId
    ]
      .map(text)
      .filter(Boolean)
  );
}


// ============================================================
// Delete one subcollection
// ============================================================

async function deleteSubcollection(
  collectionRef
) {
  const snapshot =
    await collectionRef.get();

  if (snapshot.empty) {
    return 0;
  }

  const db =
    getFirestore();

  const docs =
    snapshot.docs;

  let deleted = 0;

  /*
   * Firestore batch limit is 500 writes.
   * Keep some safety margin.
   */
  for (
    let index = 0;
    index < docs.length;
    index += 400
  ) {
    const batch =
      db.batch();

    const chunk =
      docs.slice(
        index,
        index + 400
      );

    chunk.forEach(doc => {
      batch.delete(
        doc.ref
      );
    });

    await batch.commit();

    deleted +=
      chunk.length;
  }

  return deleted;
}


// ============================================================
// Disable LINE bindings pointing to this car
// ============================================================

async function disableLineBindingsByCarId(
  carId
) {
  const db =
    getFirestore();

  const snapshot =
    await db
      .collection(
        "lineGroupBindings"
      )
      .where(
        "carId",
        "==",
        carId
      )
      .get();

  if (snapshot.empty) {
    return 0;
  }

  let updated = 0;

  const now =
    new Date().toISOString();

  for (
    let index = 0;
    index < snapshot.docs.length;
    index += 400
  ) {
    const batch =
      db.batch();

    const chunk =
      snapshot.docs.slice(
        index,
        index + 400
      );

    chunk.forEach(doc => {
      batch.set(
        doc.ref,
        {
          status:
            "inactive",

          inactiveReason:
            "test_car_deleted",

          inactiveAt:
            now,

          updatedAt:
            now
        },
        {
          merge: true
        }
      );
    });

    await batch.commit();

    updated +=
      chunk.length;
  }

  return updated;
}


// ============================================================
// Handler
// ============================================================

module.exports =
  async function handler(
    req,
    res
  ) {

    if (
      req.method !== "POST"
    ) {
      return send(
        res,
        405,
        {
          success: false,
          error:
            "method_not_allowed"
        }
      );
    }


    try {
      const session =
        verifyMemberSession(
          readCookie(req)
        );

      if (!session.valid) {
        return send(
          res,
          401,
          {
            success: false,
            error:
              "line_login_required"
          }
        );
      }


      const input =
        parseBody(req);

      const carId =
        text(
          input.carId
        );


      if (!carId) {
        return send(
          res,
          400,
          {
            success: false,
            error:
              "car_id_required"
          }
        );
      }


      const db =
        getFirestore();

      const carRef =
        db
          .collection("cars")
          .doc(carId);

      const snapshot =
        await carRef.get();


      if (!snapshot.exists) {
        return send(
          res,
          404,
          {
            success: false,
            error:
              "car_not_found"
          }
        );
      }


      const car =
        snapshot.data() || {};

      const actorIds =
        getSessionIds(
          session.data
        );

      const ownerId =
        text(
          car.ownerId
        );


      /*
       * Permanent test deletion is owner-only.
       */
      if (
        !ownerId ||
        !actorIds.has(ownerId)
      ) {
        return send(
          res,
          403,
          {
            success: false,
            error:
              "car_owner_required"
          }
        );
      }


      // ======================================================
      // 1. Disable LINE bindings
      // ======================================================

      const disabledBindings =
        await disableLineBindingsByCarId(
          carId
        );


      // ======================================================
      // 2. Delete test-only child data
      // ======================================================

      const collectionsToDelete = [
        "accountingEntries",
        "accountingViews",
        "accountingAuditLogs",
        "accountingPendingActions",
        "accountingMigrations"
      ];


      const deletedCollections =
        {};


      for (
        const name of
        collectionsToDelete
      ) {
        deletedCollections[name] =
          await deleteSubcollection(
            carRef.collection(
              name
            )
          );
      }


      // ======================================================
      // 3. Delete Core car and owner MyCar projection together
      //
      // MyCar is a derived Prepared View. The owner-facing view
      // must lose the deleted car in the same final batch so a
      // successful permanent delete cannot leave a ghost card.
      // ======================================================

      const ownerViewRef =
        db
          .collection("myCarViews")
          .doc(ownerId);

      const ownerViewSnapshot =
        await ownerViewRef.get();

      const cleanup =
        ownerViewSnapshot.exists
          ? removeCarFromView(
              ownerViewSnapshot.data(),
              carId,
              new Date().toISOString()
            )
          : {
              changed: false,
              view: null
            };

      const finalBatch =
        db.batch();

      if (
        cleanup.changed &&
        cleanup.view
      ) {
        finalBatch.set(
          ownerViewRef,
          cleanup.view,
          {
            merge: false
          }
        );
      }

      finalBatch.delete(
        carRef
      );

      await finalBatch.commit();


      return send(
        res,
        200,
        {
          success: true,

          carId,

          disabledBindings,

          deletedCollections,

          myCarViewCleaned:
            cleanup.changed === true
        }
      );


    } catch (error) {
      console.error(
        "測試車永久刪除失敗",
        error
      );

      return send(
        res,
        500,
        {
          success: false,
          error:
            "test_car_delete_failed"
        }
      );
    }
  };
