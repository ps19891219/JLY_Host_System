/*
JLY Host System

Module:
LINE Account Backend V2

用途：

1. 接收 LINE Login Backend 簽發的短效 Login Ticket
2. 在 Server 驗證 Ticket
3. 從 Ticket 取得可信任 LINE Identity
4. Resolve JLY Account
5. 第一次登入時建立「尚未綁 Player」Account
6. 已綁定時回傳正式 Player Profile ID
7. 使用完成後作廢一次性 Ticket

安全規則：

- 不相信前端傳入的 LINE User ID
- 不使用玩家名稱猜測 Player
- 不由前端直接指定 Account Identity
- Ticket 只能使用一次
- Ticket 必須未過期
- 不自動建立 Player Profile
- V2 暫不開放通用 bind API

核心：

LINE Login
→ Login Ticket
→ LINE Account
→ Player Profile
*/

"use strict";

const crypto =
  require("crypto");

const admin =
  require("firebase-admin");

const LOGIN_TICKET_COLLECTION =
  "accountLoginTickets";

const ACCOUNT_COLLECTION =
  "accounts";

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

// ============================================================
// Account ID
//
// 不直接把 LINE User ID 當 Firestore Document ID。
// ============================================================

function createLineAccountId(
  lineUserId
) {
  const normalizedId =
    normalizeText(
      lineUserId
    );

  if (!normalizedId) {
    return "";
  }

  const hash =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        normalizedId
      )
      .digest(
        "hex"
      );

  return (
    "line_" +
    hash
  );
}

// ============================================================
// Resolve Account
// ============================================================

async function resolveAccountByTicket(
  db,
  loginTicket
) {
  const normalizedTicket =
    normalizeText(
      loginTicket
    );

  if (!normalizedTicket) {
    return {
      success: false,
      statusCode: 400,
      error:
        "login_ticket_missing"
    };
  }

  const ticketHash =
    hashLoginTicket(
      normalizedTicket
    );

  const ticketRef =
    db
      .collection(
        LOGIN_TICKET_COLLECTION
      )
      .doc(
        ticketHash
      );

  return await db.runTransaction(
    async function (
      transaction
    ) {
      // ======================================================
      // STEP 1
      // 讀取 Ticket
      // ======================================================

      const ticketSnapshot =
        await transaction.get(
          ticketRef
        );

      if (
        !ticketSnapshot.exists
      ) {
        return {
          success: false,
          statusCode: 401,
          error:
            "login_ticket_invalid"
        };
      }

      const ticketData =
        ticketSnapshot.data() ||
        {};

      const used =
        ticketData.used === true;

      if (used) {
        return {
          success: false,
          statusCode: 401,
          error:
            "login_ticket_used"
        };
      }

      const expiresAtMs =
        Number(
          ticketData.expiresAtMs ||
          0
        );

      if (
        !expiresAtMs ||
        Date.now() >=
          expiresAtMs
      ) {
        transaction.update(
          ticketRef,
          {
            used:
              true,

            expired:
              true,

            usedAtMs:
              Date.now()
          }
        );

        return {
          success: false,
          statusCode: 401,
          error:
            "login_ticket_expired"
        };
      }

      const lineUserId =
        normalizeText(
          ticketData.lineUserId
        );

      if (!lineUserId) {
        transaction.update(
          ticketRef,
          {
            used:
              true,

            usedAtMs:
              Date.now()
          }
        );

        return {
          success: false,
          statusCode: 401,
          error:
            "login_identity_missing"
        };
      }

      // ======================================================
      // STEP 2
      // 找 Account
      // ======================================================

      const accountId =
        createLineAccountId(
          lineUserId
        );

      const accountRef =
        db
          .collection(
            ACCOUNT_COLLECTION
          )
          .doc(
            accountId
          );

      const accountSnapshot =
        await transaction.get(
          accountRef
        );

      const nowMs =
        Date.now();

      // ======================================================
      // STEP 3
      // 第一次登入
      //
      // 建立 Account，但不亂綁 Player。
      // ======================================================

      if (
        !accountSnapshot.exists
      ) {
        transaction.set(
          accountRef,
          {
            provider:
              "line",

            providerIdentityHash:
              accountId.replace(
                /^line_/,
                ""
              ),

            playerProfileId:
              "",

            status:
              "unlinked",

            lineDisplayName:
              normalizeText(
                ticketData.displayName
              ),

            linePictureUrl:
              normalizeText(
                ticketData.pictureUrl
              ),

            createdAtMs:
              nowMs,

            updatedAtMs:
              nowMs,

            lastLoginAtMs:
              nowMs,

            source:
              "line-account-v2"
          }
        );

        transaction.update(
          ticketRef,
          {
            used:
              true,

            usedAtMs:
              nowMs,

            result:
              "account_created_unlinked"
          }
        );

        return {
          success: false,

          statusCode: 404,

          found: false,

          needsBinding: true,

          error:
            "account_not_linked",

          accountId
        };
      }

      const accountData =
        accountSnapshot.data() ||
        {};

      const playerProfileId =
        normalizeText(
          accountData
            .playerProfileId
        );

      // ======================================================
      // STEP 4
      // Account 已存在但尚未綁 Player
      // ======================================================

      if (!playerProfileId) {
        transaction.update(
          accountRef,
          {
            status:
              "unlinked",

            lineDisplayName:
              normalizeText(
                ticketData.displayName
              ),

            linePictureUrl:
              normalizeText(
                ticketData.pictureUrl
              ),

            updatedAtMs:
              nowMs,

            lastLoginAtMs:
              nowMs
          }
        );

        transaction.update(
          ticketRef,
          {
            used:
              true,

            usedAtMs:
              nowMs,

            result:
              "account_unlinked"
          }
        );

        return {
          success: false,

          statusCode: 404,

          found: false,

          needsBinding: true,

          error:
            "account_not_linked",

          accountId
        };
      }

      // ======================================================
      // STEP 5
      // 確認 Player Profile 真實存在
      // ======================================================

      const playerRef =
        db
          .collection(
            "players"
          )
          .doc(
            playerProfileId
          );

      const playerSnapshot =
        await transaction.get(
          playerRef
        );

      if (
        !playerSnapshot.exists
      ) {
        transaction.update(
          accountRef,
          {
            status:
              "broken_profile_link",

            updatedAtMs:
              nowMs,

            lastLoginAtMs:
              nowMs
          }
        );

        transaction.update(
          ticketRef,
          {
            used:
              true,

            usedAtMs:
              nowMs,

            result:
              "player_profile_missing"
          }
        );

        return {
          success: false,

          statusCode: 409,

          error:
            "player_profile_missing"
        };
      }

      // ======================================================
      // STEP 6
      // Account 正常
      // ======================================================

      transaction.update(
        accountRef,
        {
          status:
            "active",

          lineDisplayName:
            normalizeText(
              ticketData.displayName
            ),

          linePictureUrl:
            normalizeText(
              ticketData.pictureUrl
            ),

          updatedAtMs:
            nowMs,

          lastLoginAtMs:
            nowMs
        }
      );

      // ======================================================
      // STEP 7
      // Ticket 一次性作廢
      // ======================================================

      transaction.update(
        ticketRef,
        {
          used:
            true,

          usedAtMs:
            nowMs,

          result:
            "resolved"
        }
      );

      return {
        success: true,

        statusCode: 200,

        found: true,

        account: {
          accountId,

          playerProfileId
        }
      };
    }
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

  const loginTicket =
    normalizeText(
      body.loginTicket
    );

  // ----------------------------------------------------------
  // V2 只開放 resolve
  //
  // bind 先不開放，避免未驗證的 Player Profile 冒綁。
  // ----------------------------------------------------------

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

  if (!loginTicket) {
    return sendJson(
      res,
      400,
      {
        success: false,
        error:
          "login_ticket_missing"
      }
    );
  }

  try {
    const db =
      getAdminDatabase();

    const result =
      await resolveAccountByTicket(
        db,
        loginTicket
      );

    return sendJson(
      res,
      result.statusCode ||
        (
          result.success
            ? 200
            : 400
        ),
      {
        success:
          result.success === true,

        found:
          result.found === true,

        needsBinding:
          result.needsBinding ===
            true,

        error:
          result.error || "",

        accountId:
          result.accountId || "",

        account:
          result.account ||
          null
      }
    );
  } catch (error) {
    console.error(
      "LINE Account Backend V2 發生錯誤：",
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