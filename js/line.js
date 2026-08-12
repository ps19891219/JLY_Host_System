/*
JLY Host System

Module:
LINE Login Client V1

用途：
1. 啟動 LINE Login
2. 建立安全 state
3. 保存登入前來源頁面
4. 導向 LINE Authorization Endpoint

不負責：
- Token Exchange
- Channel Secret
- Firebase
- Player Profile
- JLY Identity
- linkedPlayerIds
*/

"use strict";

console.log(
  "line.js V1 已成功載入！"
);

// ============================================================
// LINE Login 基本設定
// ============================================================

const JLY_LINE_LOGIN = Object.freeze({
  channelId:
    "2010653666",

  redirectUri:
    "https://jly-host-system-eeso.vercel.app/pages/line-callback.html",

  authorizeUrl:
    "https://access.line.me/oauth2/v2.1/authorize",

  scope:
    "openid profile"
});

// ============================================================
// 基本工具
// ============================================================

function createSecureRandomString(
  length
) {
  const size =
    Number(length) > 0
      ? Number(length)
      : 32;

  const array =
    new Uint8Array(size);

  crypto.getRandomValues(
    array
  );

  return Array.from(
    array,
    function (value) {
      return value
        .toString(16)
        .padStart(
          2,
          "0"
        );
    }
  ).join("");
}

function saveLineLoginStateCookie(state) {
  document.cookie =
    "jly_line_login_state=" +
    encodeURIComponent(String(state || "")) +
    "; Path=/; Max-Age=600; SameSite=Lax; Secure";
}

// ============================================================
// 保存登入前位置
// ============================================================

function saveLineLoginReturnUrl(
  returnUrl
) {
  const target =
    String(
      returnUrl ||
      location.href ||
      "../index.html"
    ).trim();

  localStorage.setItem(
  "jly_line_login_return_url",
  target
);
}

// ============================================================
// 開始 LINE Login
// ============================================================

async function requestServerLoginState() {
  const response = await fetch(
    "/api/line-login-state",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        playerProfileId: String(
          localStorage.getItem("currentPlayerProfileId") || ""
        ).trim(),
        identityId: String(
          localStorage.getItem("currentPlayerId") || ""
        ).trim(),
        returnPath: location.pathname + location.search
      })
    }
  );
  const data = await response.json();
  if (!response.ok || !data || !data.state) {
    throw new Error("無法建立 LINE 登入驗證，請稍後再試。");
  }
  return data.state;
}

async function startLineLogin(
  options
) {
  const settings =
    options || {};

  const state =
    await requestServerLoginState();

  localStorage.setItem(
    "jly_line_login_state",
    state
  );

  saveLineLoginStateCookie(
    state
  );

  saveLineLoginReturnUrl(
    settings.returnUrl ||
    location.href
  );

  const params =
    new URLSearchParams();

  params.set(
    "response_type",
    "code"
  );

  params.set(
    "client_id",
    JLY_LINE_LOGIN.channelId
  );

  params.set(
    "redirect_uri",
    JLY_LINE_LOGIN.redirectUri
  );

  params.set(
    "state",
    state
  );

  params.set(
    "scope",
    JLY_LINE_LOGIN.scope
  );

  const loginUrl =
    JLY_LINE_LOGIN.authorizeUrl +
    "?" +
    params.toString();

  console.log(
    "準備前往 LINE Login"
  );

  location.href =
    loginUrl;
}

// ============================================================
// 對外公開
// ============================================================

window.JLYLineLogin = {
  config:
    JLY_LINE_LOGIN,

  createSecureRandomString,

  saveLineLoginStateCookie,

  saveLineLoginReturnUrl,

  requestServerLoginState,

  start:
    startLineLogin
};

window.startLineLogin =
  startLineLogin;

console.log(
  "✅ JLY LINE Login Client V1 已載入"
);
