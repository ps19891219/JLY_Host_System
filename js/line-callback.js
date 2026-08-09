/*
JLY Host System

Module:
LINE Login Callback Client V3

用途：

1. 接收 LINE Login callback
2. 驗證 state
3. 將 authorization code POST 到 /api/line-login
4. 接收 Server 簽發的短效 Login Ticket
5. 暫存 Ticket，交給 Account Layer
6. 返回登入前頁面

安全規則：

- 不保存 LINE User ID 作為 Account 憑證
- 不保存 access token
- 不保存 refresh token
- 不保存 id_token
- Account Layer 只能使用 Server Login Ticket
*/

"use strict";

console.log(
  "line-callback.js V3 已成功載入！"
);

// ============================================================
// Storage Keys
// ============================================================

const JLY_LINE_LOGIN_TICKET_KEY =
  "jly_line_login_ticket";

const JLY_LINE_LOGIN_TICKET_EXPIRES_KEY =
  "jly_line_login_ticket_expires_at";

// ============================================================
// DOM
// ============================================================

function setStatus(
  text
) {
  const statusText =
    document.getElementById(
      "statusText"
    );

  if (statusText) {
    statusText.innerText =
      String(
        text || ""
      );
  }
}

// ============================================================
// Query Params
// ============================================================

function getQueryParam(
  name
) {
  return new URLSearchParams(
    location.search
  ).get(
    name
  );
}

// ============================================================
// 清理 LINE Login 暫存
// ============================================================

function clearLineLoginTemporaryState() {
  localStorage.removeItem(
    "jly_line_login_state"
  );

  sessionStorage.removeItem(
    "line_login_code"
  );

  sessionStorage.removeItem(
    "line_login_state"
  );
}

// ============================================================
// 清除舊版 Identity 暫存
// ============================================================

function clearLegacyVerifiedIdentity() {
  sessionStorage.removeItem(
    "jly_verified_line_identity"
  );
}

// ============================================================
// 驗證 state
// ============================================================

function validateLineLoginState(
  returnedState
) {
  const expectedState =
    String(
      localStorage.getItem(
        "jly_line_login_state"
      ) || ""
    ).trim();

  const actualState =
    String(
      returnedState || ""
    ).trim();

  if (
    !expectedState ||
    !actualState
  ) {
    return {
      valid: false,

      reason:
        "登入驗證資料不存在"
    };
  }

  if (
    expectedState !==
    actualState
  ) {
    return {
      valid: false,

      reason:
        "LINE Login state 不一致"
    };
  }

  return {
    valid: true,

    reason: ""
  };
}

// ============================================================
// Authorization Code → Login Ticket
// ============================================================

async function exchangeLineAuthorizationCode(
  code
) {
  const response =
    await fetch(
      "/api/line-login",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            code:
              String(
                code || ""
              ).trim()
          })
      }
    );

  let data = null;

  try {
    data =
      await response.json();
  } catch (error) {
    throw new Error(
      "LINE Login 後端回傳格式錯誤"
    );
  }

  if (
    !response.ok ||
    !data ||
    data.success !== true
  ) {
    const errorCode =
      data &&
      data.error
        ? data.error
        : "unknown_error";

    throw new Error(
      "LINE Login 驗證失敗：" +
      errorCode
    );
  }

  const loginTicket =
    String(
      data.loginTicket || ""
    ).trim();

  if (!loginTicket) {
    throw new Error(
      "LINE Login Ticket 不存在"
    );
  }

  return data;
}

// ============================================================
// 保存 Server Login Ticket
//
// Ticket 是短效憑證。
// 只存在 sessionStorage。
// ============================================================

function saveLineLoginTicket(
  result
) {
  const source =
    result &&
    typeof result === "object"
      ? result
      : {};

  const loginTicket =
    String(
      source.loginTicket || ""
    ).trim();

  if (!loginTicket) {
    throw new Error(
      "無法保存 LINE Login Ticket"
    );
  }

  const expiresAtMs =
    Number(
      source.expiresAtMs || 0
    );

  sessionStorage.setItem(
    JLY_LINE_LOGIN_TICKET_KEY,
    loginTicket
  );

  if (
    Number.isFinite(
      expiresAtMs
    ) &&
    expiresAtMs > 0
  ) {
    sessionStorage.setItem(
      JLY_LINE_LOGIN_TICKET_EXPIRES_KEY,
      String(
        expiresAtMs
      )
    );
  } else {
    sessionStorage.removeItem(
      JLY_LINE_LOGIN_TICKET_EXPIRES_KEY
    );
  }

  clearLegacyVerifiedIdentity();

  return {
    loginTicket,

    expiresAtMs
  };
}

// ============================================================
// 取得登入後返回位置
// ============================================================

function getLineLoginReturnUrl() {
  const saved =
    String(
      localStorage.getItem(
        "jly_line_login_return_url"
      ) || ""
    ).trim();

  return (
    saved ||
    "../index.html"
  );
}

// ============================================================
// 主流程
// ============================================================

async function handleLineCallback() {
  const code =
    getQueryParam(
      "code"
    );

  const state =
    getQueryParam(
      "state"
    );

  const lineError =
    getQueryParam(
      "error"
    );

  const lineErrorDescription =
    getQueryParam(
      "error_description"
    );

  // ----------------------------------------------------------
  // LINE 授權被取消 / 拒絕
  // ----------------------------------------------------------

  if (lineError) {
    clearLineLoginTemporaryState();

    console.error(
      "LINE Login Error:",
      lineError,
      lineErrorDescription
    );

    setStatus(
      "LINE 登入未完成，請重新登入。"
    );

    return;
  }

  // ----------------------------------------------------------
  // Authorization Code
  // ----------------------------------------------------------

  if (!code) {
    setStatus(
      "沒有收到 LINE 登入授權碼，請重新登入。"
    );

    return;
  }

  // ----------------------------------------------------------
  // State Validation
  // ----------------------------------------------------------

  const stateResult =
    validateLineLoginState(
      state
    );

  if (
    !stateResult.valid
  ) {
    console.error(
      stateResult.reason
    );

    clearLineLoginTemporaryState();

    setStatus(
      "LINE 登入驗證失敗，請重新登入。"
    );

    return;
  }

  try {
    setStatus(
      "LINE 身分驗證中..."
    );

    // ========================================================
    // STEP 1
    // Authorization Code
    // → Server
    // → Login Ticket
    // ========================================================

    const result =
      await exchangeLineAuthorizationCode(
        code
      );

    // ========================================================
    // STEP 2
    // 保存短效 Server Ticket
    // ========================================================

    const ticketData =
      saveLineLoginTicket(
        result
      );

    console.log(
      "✅ LINE Login Ticket 已取得",
      {
        hasTicket:
          Boolean(
            ticketData.loginTicket
          ),

        expiresAtMs:
          ticketData.expiresAtMs
      }
    );

    // ========================================================
    // STEP 3
    // 清理登入 state
    // ========================================================

    clearLineLoginTemporaryState();

    setStatus(
      "LINE 身分確認成功，正在連接 JLY 帳號..."
    );

    // ========================================================
    // STEP 4
    // 返回登入前頁面
    // ========================================================

    const returnUrl =
      getLineLoginReturnUrl();

    setTimeout(
      function () {
        location.href =
          returnUrl;
      },
      800
    );
  } catch (error) {
    console.error(
      "LINE Callback 處理失敗：",
      error
    );

    setStatus(
      error &&
      error.message
        ? error.message
        : "LINE 登入失敗，請重新登入。"
    );
  }
}

// ============================================================
// 初始化
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  function () {
    handleLineCallback()
      .catch(
        function (error) {
          console.error(
            "LINE Callback 初始化失敗：",
            error
          );

          setStatus(
            "LINE 登入發生錯誤，請重新登入。"
          );
        }
      );
  }
);

// ============================================================
// 對外公開
// ============================================================

window.JLYLineCallback = {
  getQueryParam,

  validateLineLoginState,

  exchangeLineAuthorizationCode,

  saveLineLoginTicket,

  getLineLoginReturnUrl,

  clearLineLoginTemporaryState,

  handle:
    handleLineCallback
};

console.log(
  "✅ JLY LINE Login Callback V3 已載入"
);