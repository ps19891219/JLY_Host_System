/*
JLY Host System

Temporary Module:
Firebase Admin Connection Test

Purpose:

1. Run inside Vercel
2. Verify Firebase Admin environment variables
3. Verify Firestore read access
4. Return a safe test result

IMPORTANT:
Delete this file after verification.
*/

"use strict";

const {
  getFirestore
} = require(
  "../services/firebase/admin"
);

// ============================================================
// JSON Response
// ============================================================

function sendJson(
  res,
  statusCode,
  data
) {
  res.statusCode =
    statusCode;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.end(
    JSON.stringify(
      data,
      null,
      2
    )
  );
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
    req.method !== "GET"
  ) {
    res.setHeader(
      "Allow",
      "GET"
    );

    return sendJson(
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
    const db =
      getFirestore();

    const snapshot =
      await db
        .collection(
          "lineGroupBindings"
        )
        .doc(
          "JLY_FIRESTORE_TEST_GROUP"
        )
        .get();

    return sendJson(
      res,
      200,
      {
        success: true,

        firestoreConnected:
          true,

        testDocumentExists:
          snapshot.exists
      }
    );
  } catch (error) {
    console.error(
      "Firebase test failed.",
      error
    );

    return sendJson(
      res,
      500,
      {
        success: false,
        firestoreConnected:
          false,

        error:
          error &&
          error.code
            ? error.code
            : "firebase_test_failed",

        message:
          error &&
          error.message
            ? error.message
            : ""
      }
    );
  }
};