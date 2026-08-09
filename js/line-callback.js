/*
JLY Host System

Module:
LINE Login Callback Client V2

用途：
1. 接收 LINE Login callback
2. 驗證 state
3. 將 authorization code POST 到 /api/line-login
4. 接收後端驗證完成的 LINE User Identity
5. 暫存 LINE Identity，交給 Account / Identity Bridge

不負責：
- Channel Secret
- Token Exchange
- Firebase Player Profile 查找
- Player Profile 建立
- linkedPlayerIds
- 「我是玩家」判斷
*/

"use strict";

console.log(
  "line-callback.js V2 已成功載入！"
);

// ============================================================
// DOM
// ============================================================

function setStatus(text) {
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

function getQueryParam(name) {
  return new URLSearchParams(
    location.search
  ).get(name);
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
// 呼叫 Vercel Backend
// ============================================================

async function exchangeLineAuthorizationCode(
  code
) {
  const response =
    await fetch(
      "/api/line-login",
      {
        method: "POST",

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

  return data;
}

// ============================================================
// 保存已驗證 LINE Identity
// ============================================================

function saveVerifiedLineIdentity(
  lineUser
) {
  const source =
    lineUser &&
    typeof lineUser === "object"
      ? lineUser
      : {};

  const lineUserId =
    String(
      source.userId || ""
    ).trim();

  if (!lineUserId) {
    throw new Error(
      "LINE User ID 不存在"
    );
  }

  const identity = {
    userId:
      lineUserId,

    displayName:
      String(
        source.displayName || ""
      ).trim(),

    pictureUrl:
      String(
        source.pictureUrl || ""
      ).trim(),

    verifiedAt:
      new Date().toISOString()
  };

  sessionStorage.setItem(
    "jly_verified_line_identity",
    JSON.stringify(identity)
  );

  return identity;
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
  // LINE 授權被取消／拒絕
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

  if (!stateResult.valid) {
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

    // --------------------------------------------------------
    // Authorization Code → Backend
    // --------------------------------------------------------

    const result =
      await exchangeLineAuthorizationCode(
        code
      );

    // --------------------------------------------------------
    // 保存可信任 LINE Identity
    // --------------------------------------------------------

    const lineIdentity =
      saveVerifiedLineIdentity(
        result.lineUser
      );

    console.log(
      "LINE Identity 驗證完成：",
      {
        displayName:
          lineIdentity.displayName,

        hasUserId:
          Boolean(
            lineIdentity.userId
          )
      }
    );

    clearLineLoginTemporaryState();

    setStatus(
      "LINE 身分確認成功，正在連接 JLY 帳號..."
    );

    // --------------------------------------------------------
    // Account V1 下一階段
    //
    // 目前先回原頁。
    // 下一步將在這裡接：
    //
    // LINE Identity
    // → Player Profile
    // → JLYIdentity
    // --------------------------------------------------------

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

  saveVerifiedLineIdentity,

  getLineLoginReturnUrl,

  handle:
    handleLineCallback
};