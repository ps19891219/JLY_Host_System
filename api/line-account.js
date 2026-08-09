/*
JLY Host System

Module:
LINE Account Backend V1

用途：
1. 接收已完成 LINE Login 的 LINE User Identity
2. 查詢 JLY Account
3. 回傳已綁定的 Player Profile ID
4. 支援跨裝置恢復 JLY 身分

目前 V1：
- 支援 resolve
- 不自動建立 Account
- 不自動建立 Player Profile
- 不用玩家名稱猜測身分

Account Collection：
accounts

Account Document ID：
line_{LINE_USER_ID}

核心關係：

LINE User
→ JLY Account
→ Player Profile
*/

"use strict";

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
    JSON.stringify(data)
  );
}

// ============================================================
// 基本工具
// ============================================================

function normalizeText(
  value
) {
  return String(
    value == null
      ? ""
      : value
  ).trim();
}

// ============================================================
// Firebase Admin
// ============================================================

function getFirebaseAdmin() {
  try {
    return require(
      "firebase-admin"
    );
  } catch (error) {
    console.error(
      "firebase-admin 尚未安裝：",
      error
    );

    return null;
  }
}

function getAdminDatabase() {
  const admin =
    getFirebaseAdmin();

  if (!admin) {
    return null;
  }

  if (
    !admin.apps ||
    admin.apps.length === 0
  ) {
    const projectId =
      normalizeText(
        process.env
          .FIREBASE_PROJECT_ID
      );

    const clientEmail =
      normalizeText(
        process.env
          .FIREBASE_CLIENT_EMAIL
      );

    const privateKey =
      normalizeText(
        process.env
          .FIREBASE_PRIVATE_KEY
      ).replace(
        /\\n/g,
        "\n"
      );

    if (
      !projectId ||
      !clientEmail ||
      !privateKey
    ) {
      console.error(
        "Firebase Admin 環境變數尚未設定"
      );

      return null;
    }

    admin.initializeApp({
      credential:
        admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        })
    });
  }

  return admin.firestore();
}

// ============================================================
// Account Document ID
// ============================================================

function createLineAccountDocumentId(
  lineUserId
) {
  const normalizedId =
    normalizeText(
      lineUserId
    );

  if (!normalizedId) {
    return "";
  }

  return (
    "line_" +
    normalizedId
  );
}

// ============================================================
// Resolve Account
// ============================================================

async function resolveLineAccount(
  db,
  lineUserId
) {
  const accountDocumentId =
    createLineAccountDocumentId(
      lineUserId
    );

  if (!accountDocumentId) {
    return {
      found: false,
      reason:
        "line_user_id_missing"
    };
  }

  const snapshot =
    await db
      .collection(
        "accounts"
      )
      .doc(
        accountDocumentId
      )
      .get();

  if (!snapshot.exists) {
    return {
      found: false,
      reason:
        "account_not_found"
    };
  }

  const account =
    snapshot.data() || {};

  const playerProfileId =
    normalizeText(
      account.playerProfileId
    );

  if (!playerProfileId) {
    return {
      found: false,
      reason:
        "player_profile_not_linked"
    };
  }

  return {
    found: true,

    accountId:
      snapshot.id,

    playerProfileId,

    account
  };
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
    res.setHeader(
      "Allow",
      "POST"
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

  const body =
    req.body &&
    typeof req.body ===
      "object"
      ? req.body
      : {};

  const action =
    normalizeText(
      body.action
    );

  const lineUserId =
    normalizeText(
      body.lineUserId
    );

  if (
    action !== "resolve"
  ) {
    return sendJson(
      res,
      400,
      {
        success: false,
        error:
          "unsupported_action"
      }
    );
  }

  if (!lineUserId) {
    return sendJson(
      res,
      400,
      {
        success: false,
        error:
          "line_user_id_missing"
      }
    );
  }

  const db =
    getAdminDatabase();

  if (!db) {
    return sendJson(
      res,
      500,
      {
        success: false,
        error:
          "firebase_admin_unavailable"
      }
    );
  }

  try {
    const result =
      await resolveLineAccount(
        db,
        lineUserId
      );

    if (!result.found) {
      return sendJson(
        res,
        404,
        {
          success: false,

          found: false,

          error:
            result.reason
        }
      );
    }

    return sendJson(
      res,
      200,
      {
        success: true,

        found: true,

        account: {
          accountId:
            result.accountId,

          playerProfileId:
            result.playerProfileId
        }
      }
    );
  } catch (error) {
    console.error(
      "LINE Account Resolve 失敗：",
      error
    );

    return sendJson(
      res,
      500,
      {
        success: false,
        error:
          "account_resolve_failed"
      }
    );
  }
};