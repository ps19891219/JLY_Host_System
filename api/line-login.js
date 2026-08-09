/*
JLY Host System

Module:
LINE Login Backend V2

用途：

1. 接收 LINE Login authorization code
2. 在 Vercel Server 交換 LINE access token
3. 驗證 LINE id_token
4. 建立短效一次性 JLY Login Ticket
5. 將 Ticket 交給 Account Layer 使用

安全規則：

- Channel Secret 不可放前端
- LINE User ID 不再作為前端 Account 查詢憑證
- Login Ticket 僅存活短時間
- Ticket 真值只傳給前端一次
- Firestore 只保存 Ticket Hash
- 不在這裡建立 Player Profile
- 不在這裡綁定 Player Profile
*/

"use strict";

const crypto =
  require("crypto");

const admin =
  require("firebase-admin");

const LINE_TOKEN_URL =
  "https://api.line.me/oauth2/v2.1/token";

const LINE_VERIFY_URL =
  "https://api.line.me/oauth2/v2.1/verify";

const DEFAULT_REDIRECT_URI =
  "https://jly-host-system-eeso.vercel.app/pages/line-callback.html";

const LOGIN_TICKET_COLLECTION =
  "accountLoginTickets";

const LOGIN_TICKET_LIFETIME_MS =
  5 * 60 * 1000;

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
// Firebase Admin
// ============================================================

function getAdminDatabase() {
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
      throw new Error(
        "Firebase Admin 環境變數尚未設定"
      );
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
// Login Ticket
// ============================================================

function createLoginTicket() {
  return crypto
    .randomBytes(32)
    .toString(
      "base64url"
    );
}

function hashLoginTicket(
  ticket
) {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      String(
        ticket || ""
      )
    )
    .digest(
      "hex"
    );
}

async function createStoredLoginTicket(
  db,
  lineUser
) {
  const ticket =
    createLoginTicket();

  const ticketHash =
    hashLoginTicket(
      ticket
    );

  const nowMs =
    Date.now();

  const expiresAtMs =
    nowMs +
    LOGIN_TICKET_LIFETIME_MS;

  await db
    .collection(
      LOGIN_TICKET_COLLECTION
    )
    .doc(
      ticketHash
    )
    .set({
      lineUserId:
        normalizeText(
          lineUser.userId
        ),

      displayName:
        normalizeText(
          lineUser.displayName
        ),

      pictureUrl:
        normalizeText(
          lineUser.pictureUrl
        ),

      createdAtMs:
        nowMs,

      expiresAtMs,

      used:
        false,

      source:
        "line-login-v2"
    });

  return {
    ticket,
    expiresAtMs
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
  // ----------------------------------------------------------
  // POST only
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // LINE Environment Variables
  // ----------------------------------------------------------

  const channelId =
    normalizeText(
      process.env
        .LINE_CHANNEL_ID
    );

  const channelSecret =
    normalizeText(
      process.env
        .LINE_CHANNEL_SECRET
    );

  const redirectUri =
    normalizeText(
      process.env
        .LINE_REDIRECT_URI ||
      DEFAULT_REDIRECT_URI
    );

  if (
    !channelId ||
    !channelSecret
  ) {
    console.error(
      "LINE Login 環境變數尚未設定"
    );

    return sendJson(
      res,
      500,
      {
        success: false,
        error:
          "line_environment_missing"
      }
    );
  }

  // ----------------------------------------------------------
  // Authorization Code
  // ----------------------------------------------------------

  const body =
    req.body &&
    typeof req.body ===
      "object"
      ? req.body
      : {};

  const code =
    normalizeText(
      body.code
    );

  if (!code) {
    return sendJson(
      res,
      400,
      {
        success: false,
        error:
          "authorization_code_missing"
      }
    );
  }

  try {
    // ========================================================
    // STEP 1
    // Authorization Code → LINE Token
    // ========================================================

    const tokenBody =
      new URLSearchParams();

    tokenBody.set(
      "grant_type",
      "authorization_code"
    );

    tokenBody.set(
      "code",
      code
    );

    tokenBody.set(
      "redirect_uri",
      redirectUri
    );

    tokenBody.set(
      "client_id",
      channelId
    );

    tokenBody.set(
      "client_secret",
      channelSecret
    );

    const tokenResponse =
      await fetch(
        LINE_TOKEN_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          body:
            tokenBody.toString()
        }
      );

    const tokenData =
      await tokenResponse.json();

    if (
      !tokenResponse.ok
    ) {
      console.error(
        "LINE Token 交換失敗：",
        tokenData
      );

      return sendJson(
        res,
        401,
        {
          success: false,
          error:
            "line_token_exchange_failed"
        }
      );
    }

    const idToken =
      normalizeText(
        tokenData.id_token
      );

    if (!idToken) {
      return sendJson(
        res,
        401,
        {
          success: false,
          error:
            "line_id_token_missing"
        }
      );
    }

    // ========================================================
    // STEP 2
    // 驗證 LINE ID Token
    // ========================================================

    const verifyBody =
      new URLSearchParams();

    verifyBody.set(
      "id_token",
      idToken
    );

    verifyBody.set(
      "client_id",
      channelId
    );

    const verifyResponse =
      await fetch(
        LINE_VERIFY_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          body:
            verifyBody.toString()
        }
      );

    const verifyData =
      await verifyResponse.json();

    if (
      !verifyResponse.ok
    ) {
      console.error(
        "LINE ID Token 驗證失敗：",
        verifyData
      );

      return sendJson(
        res,
        401,
        {
          success: false,
          error:
            "line_id_token_invalid"
        }
      );
    }

    const lineUserId =
      normalizeText(
        verifyData.sub
      );

    if (!lineUserId) {
      return sendJson(
        res,
        401,
        {
          success: false,
          error:
            "line_user_id_missing"
        }
      );
    }

    // ========================================================
    // STEP 3
    // 建立 Server Login Ticket
    // ========================================================

    const db =
      getAdminDatabase();

    const loginTicket =
      await createStoredLoginTicket(
        db,
        {
          userId:
            lineUserId,

          displayName:
            normalizeText(
              verifyData.name
            ),

          pictureUrl:
            normalizeText(
              verifyData.picture
            )
        }
      );

    // ========================================================
    // STEP 4
    // 安全回傳
    //
    // 不回傳：
    // - lineUserId
    // - access token
    // - refresh token
    // - id_token
    //
    // Account Layer 只能拿 Ticket 去 Server 換身份。
    // ========================================================

    return sendJson(
      res,
      200,
      {
        success: true,

        loginTicket:
          loginTicket.ticket,

        expiresAtMs:
          loginTicket.expiresAtMs,

        lineUser: {
          displayName:
            normalizeText(
              verifyData.name
            ),

          pictureUrl:
            normalizeText(
              verifyData.picture
            )
        }
      }
    );
  } catch (error) {
    console.error(
      "LINE Login Backend V2 發生錯誤：",
      error
    );

    return sendJson(
      res,
      500,
      {
        success: false,
        error:
          "line_login_server_error"
      }
    );
  }
};