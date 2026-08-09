/*
JLY Host System

Module:
LINE Login Backend V1

用途：
1. 接收 LINE Login authorization code
2. 在 Vercel Server 端交換 LINE access token
3. 驗證 LINE id_token
4. 回傳可信任的 LINE User Identity 給前端

安全規則：
- Channel Secret 不可放前端
- 不在這裡建立 Player Profile
- 不在這裡判斷「我是玩家」
- 不直接修改 JLY Identity
- Account ↔ Player Profile 綁定由下一層處理
*/

"use strict";

const LINE_TOKEN_URL =
  "https://api.line.me/oauth2/v2.1/token";

const LINE_VERIFY_URL =
  "https://api.line.me/oauth2/v2.1/verify";

const DEFAULT_REDIRECT_URI =
  "https://jly-host-system-eeso.vercel.app/pages/line-callback.html";

// ============================================================
// 回傳 JSON
// ============================================================

function sendJson(
  res,
  statusCode,
  data
) {
  res.statusCode = statusCode;

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
// 主 Handler
// ============================================================

module.exports =
  async function handler(
    req,
    res
  ) {
    // --------------------------------------------------------
    // 只接受 POST
    // --------------------------------------------------------

    if (req.method !== "POST") {
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

    // --------------------------------------------------------
    // Environment Variables
    // --------------------------------------------------------

    const channelId =
      String(
        process.env.LINE_CHANNEL_ID ||
        ""
      ).trim();

    const channelSecret =
      String(
        process.env.LINE_CHANNEL_SECRET ||
        ""
      ).trim();

    const redirectUri =
      String(
        process.env.LINE_REDIRECT_URI ||
        DEFAULT_REDIRECT_URI
      ).trim();

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

    // --------------------------------------------------------
    // Request Body
    // --------------------------------------------------------

    const body =
      req.body &&
      typeof req.body === "object"
        ? req.body
        : {};

    const code =
      String(
        body.code || ""
      ).trim();

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
      // ======================================================
      // STEP 1
      // Authorization Code → LINE Token
      // ======================================================

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
            method: "POST",

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

      const accessToken =
        String(
          tokenData.access_token ||
          ""
        ).trim();

      const idToken =
        String(
          tokenData.id_token ||
          ""
        ).trim();

      if (
        !accessToken ||
        !idToken
      ) {
        console.error(
          "LINE Token Response 缺少必要資料"
        );

        return sendJson(
          res,
          401,
          {
            success: false,
            error:
              "line_token_incomplete"
          }
        );
      }

      // ======================================================
      // STEP 2
      // 驗證 ID Token
      // ======================================================

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
            method: "POST",

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
        String(
          verifyData.sub ||
          ""
        ).trim();

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

      // ======================================================
      // 安全回傳
      //
      // 不把 access token / refresh token / id_token
      // 傳回前端。
      // ======================================================

      return sendJson(
        res,
        200,
        {
          success: true,

          lineUser: {
            userId:
              lineUserId,

            displayName:
              String(
                verifyData.name ||
                ""
              ).trim(),

            pictureUrl:
              String(
                verifyData.picture ||
                ""
              ).trim()
          }
        }
      );
    } catch (error) {
      console.error(
        "LINE Login Backend 發生錯誤：",
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