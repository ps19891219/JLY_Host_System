/*
JLY Host System

Module:
Firebase Admin V1

Responsibilities:

1. Initialize Firebase Admin SDK
2. Reuse the existing Firebase Admin app
3. Provide server-side Firestore access
4. Keep Firebase credentials isolated from business logic

Environment Variables:

FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
*/

"use strict";

const admin =
  require("firebase-admin");

// ============================================================
// Environment
// ============================================================

function getFirebaseConfig() {
  const projectId =
    String(
      process.env.FIREBASE_PROJECT_ID || ""
    ).trim();

  const clientEmail =
    String(
      process.env.FIREBASE_CLIENT_EMAIL || ""
    ).trim();

  const privateKey =
    String(
      process.env.FIREBASE_PRIVATE_KEY || ""
    )
      .replace(/\\n/g, "\n")
      .trim();

  return {
    projectId,
    clientEmail,
    privateKey
  };
}

// ============================================================
// Validate Environment
// ============================================================

function validateFirebaseConfig(
  config
) {
  const missing = [];

  if (!config.projectId) {
    missing.push(
      "FIREBASE_PROJECT_ID"
    );
  }

  if (!config.clientEmail) {
    missing.push(
      "FIREBASE_CLIENT_EMAIL"
    );
  }

  if (!config.privateKey) {
    missing.push(
      "FIREBASE_PRIVATE_KEY"
    );
  }

  if (missing.length > 0) {
    const error =
      new Error(
        "Firebase Admin environment variables are missing: " +
        missing.join(", ")
      );

    error.code =
      "firebase_admin_config_missing";

    error.missing =
      missing;

    throw error;
  }
}

// ============================================================
// Initialize Firebase Admin
// ============================================================

function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const config =
    getFirebaseConfig();

  validateFirebaseConfig(
    config
  );

  return admin.initializeApp({
    credential:
      admin.credential.cert({
        projectId:
          config.projectId,

        clientEmail:
          config.clientEmail,

        privateKey:
          config.privateKey
      })
  });
}

// ============================================================
// Firestore
// ============================================================

function getFirestore() {
  const app =
    getAdminApp();

  return app.firestore();
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  getAdminApp,
  getFirestore
};