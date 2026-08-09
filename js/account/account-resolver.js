/*
JLY Host System

Module:
Account Resolver V2

用途：

1. 取得 LINE Login Backend 簽發的短效 Login Ticket
2. 將 Ticket 交給 Account Backend
3. 接收正式 Account → Player Profile 關係
4. 將正確 Player Profile 交給 JLYIdentity
5. 支援手機 / 新裝置恢復原本 JLY 玩家身分

安全規則：

- 不讀取 LINE User ID 作為 Account 憑證
- 不用名字猜 Player
- 不建立 Player Profile
- 不直接建立 Account
- Login Ticket 僅作短效登入流程使用
- Account Backend 才能決定 Ticket 對應哪個 LINE 身分

核心：

LINE Login
→ Server Login Ticket
→ Account Backend
→ Player Profile
→ JLYIdentity
*/

"use strict";

console.log(
  "account-resolver.js V2 已成功載入！"
);

// ============================================================
// Storage Keys
// ============================================================

const JLY_ACCOUNT_ID_KEY =
  "currentJlyAccountId";

const JLY_LINE_LOGIN_TICKET_KEY =
  "jly_line_login_ticket";

const JLY_LINE_LOGIN_TICKET_EXPIRES_KEY =
  "jly_line_login_ticket_expires_at";

// ============================================================
// 基本工具
// ============================================================

function normalizeAccountText(
  value
) {
  return String(
    value == null
      ? ""
      : value
  ).trim();
}

// ============================================================
// 模組檢查
// ============================================================

function getIdentityModule() {
  if (
    !window.JLYIdentity
  ) {
    throw new Error(
      "JLYIdentity 尚未載入"
    );
  }

  return window.JLYIdentity;
}

function getDatabase() {
  if (!window.db) {
    throw new Error(
      "Firebase 尚未載入"
    );
  }

  return window.db;
}

// ============================================================
// 取得 Login Ticket
// ============================================================

function getPendingLoginTicket() {
  const ticket =
    normalizeAccountText(
      sessionStorage.getItem(
        JLY_LINE_LOGIN_TICKET_KEY
      )
    );

  if (!ticket) {
    return null;
  }

  const expiresAtMs =
    Number(
      sessionStorage.getItem(
        JLY_LINE_LOGIN_TICKET_EXPIRES_KEY
      ) || 0
    );

  // ----------------------------------------------------------
  // 本機先做基本逾時檢查
  //
  // 真正有效性仍由 Server 判定。
  // ----------------------------------------------------------

  if (
    Number.isFinite(
      expiresAtMs
    ) &&
    expiresAtMs > 0 &&
    Date.now() >=
      expiresAtMs
  ) {
    clearPendingLoginTicket();

    return null;
  }

  return {
    ticket,

    expiresAtMs
  };
}

// ============================================================
// 清除 Login Ticket
// ============================================================

function clearPendingLoginTicket() {
  sessionStorage.removeItem(
    JLY_LINE_LOGIN_TICKET_KEY
  );

  sessionStorage.removeItem(
    JLY_LINE_LOGIN_TICKET_EXPIRES_KEY
  );
}

// ============================================================
// 取得目前 Account ID
// ============================================================

function getCurrentAccountId() {
  return normalizeAccountText(
    localStorage.getItem(
      JLY_ACCOUNT_ID_KEY
    )
  );
}

// ============================================================
// 保存目前 Account ID
// ============================================================

function setCurrentAccountId(
  accountId
) {
  const normalizedId =
    normalizeAccountText(
      accountId
    );

  if (!normalizedId) {
    return false;
  }

  localStorage.setItem(
    JLY_ACCOUNT_ID_KEY,
    normalizedId
  );

  return true;
}

// ============================================================
// 清除 Account Cache
//
// 注意：
// 目前不清 Player Profile。
// 正式 logout 之後交由 Account Controller 處理。
// ============================================================

function clearCurrentAccountId() {
  localStorage.removeItem(
    JLY_ACCOUNT_ID_KEY
  );
}

// ============================================================
// 呼叫 Account Backend
//
// action:
//
// resolve
// → 已綁定帳號直接恢復
//
// bind
// → 首次綁定
//   下一階段使用
// ============================================================

async function requestAccountBackend(
  action,
  options
) {
  const settings =
    options || {};

  const pendingTicket =
    getPendingLoginTicket();

  if (
    !pendingTicket ||
    !pendingTicket.ticket
  ) {
    throw new Error(
      "LINE Login Ticket 不存在或已過期"
    );
  }

  const payload = {
    action:
      normalizeAccountText(
        action
      ),

    loginTicket:
      pendingTicket.ticket
  };

  // ----------------------------------------------------------
  // 首次綁定時才可能需要 Player Profile ID
  //
  // 這個值不能單獨作為授權依據。
  // Server 必須同時驗證 Login Ticket。
  // ----------------------------------------------------------

  const playerProfileId =
    normalizeAccountText(
      settings.playerProfileId
    );

  if (playerProfileId) {
    payload.playerProfileId =
      playerProfileId;
  }

  const response =
    await fetch(
      "/api/line-account",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

  let data = null;

  try {
    data =
      await response.json();
  } catch (error) {
    throw new Error(
      "Account Backend 回傳格式錯誤"
    );
  }

  return {
    response,
    data
  };
}

// ============================================================
// Resolve 已綁定 Account
// ============================================================

async function resolveAccount() {
  const result =
    await requestAccountBackend(
      "resolve"
    );

  const response =
    result.response;

  const data =
    result.data;

  if (
    response.ok &&
    data &&
    data.success === true &&
    data.account
  ) {
    return {
      success: true,

      found: true,

      account:
        data.account
    };
  }

  if (
    data &&
    data.error ===
      "account_not_found"
  ) {
    return {
      success: false,

      found: false,

      needsBinding: true,

      error:
        "account_not_found"
    };
  }

  if (
    data &&
    (
      data.error ===
        "login_ticket_expired" ||
      data.error ===
        "login_ticket_invalid" ||
      data.error ===
        "login_ticket_used"
    )
  ) {
    clearPendingLoginTicket();

    return {
      success: false,

      found: false,

      needsLogin: true,

      error:
        data.error
    };
  }

  throw new Error(
    data &&
    data.error
      ? data.error
      : "account_resolve_failed"
  );
}

// ============================================================
// 首次綁定 Account
//
// 下一階段由 UI 決定何時呼叫。
// ============================================================

async function bindAccount(
  playerProfileId
) {
  const normalizedProfileId =
    normalizeAccountText(
      playerProfileId
    );

  if (!normalizedProfileId) {
    throw new Error(
      "Player Profile ID 不存在"
    );
  }

  const result =
    await requestAccountBackend(
      "bind",
      {
        playerProfileId:
          normalizedProfileId
      }
    );

  const response =
    result.response;

  const data =
    result.data;

  if (
    response.ok &&
    data &&
    data.success === true &&
    data.account
  ) {
    return {
      success: true,

      account:
        data.account
    };
  }

  throw new Error(
    data &&
    data.error
      ? data.error
      : "account_bind_failed"
  );
}

// ============================================================
// 套用正式 Account Resolve 結果
// ============================================================

async function applyResolvedAccount(
  resolvedAccount
) {
  const source =
    resolvedAccount &&
    typeof resolvedAccount ===
      "object"
      ? resolvedAccount
      : {};

  const accountId =
    normalizeAccountText(
      source.accountId
    );

  const playerProfileId =
    normalizeAccountText(
      source.playerProfileId
    );

  if (!playerProfileId) {
    throw new Error(
      "Account 沒有 Player Profile ID"
    );
  }

  const Identity =
    getIdentityModule();

  const db =
    getDatabase();

  // ==========================================================
  // STEP 1
  // 設定正式 Player Profile
  // ==========================================================

  const profileIdSaved =
    Identity
      .setCurrentPlayerProfileId(
        playerProfileId
      );

  if (!profileIdSaved) {
    throw new Error(
      "無法保存 Player Profile ID"
    );
  }

  // ==========================================================
  // STEP 2
  // Firebase Player Profile
  // → 本機 Identity Cache
  // ==========================================================

  const profile =
    await Identity
      .syncFromPlayerProfile(
        db,
        playerProfileId
      );

  if (!profile) {
    throw new Error(
      "找不到對應的 Player Profile"
    );
  }

  // ==========================================================
  // STEP 3
  // 恢復正式 Identity ID
  // ==========================================================

  const profileIdentityId =
    normalizeAccountText(
      profile.identityId
    );

  if (profileIdentityId) {
    Identity
      .setCurrentPlayerId(
        profileIdentityId
      );
  } else if (
    !Identity
      .getCurrentPlayerId()
  ) {
    Identity
      .ensureCurrentPlayerId();
  }

  // ==========================================================
  // STEP 4
  // 保存 Account Cache
  // ==========================================================

  if (accountId) {
    setCurrentAccountId(
      accountId
    );
  }

  // ==========================================================
  // STEP 5
  // Account 成功後清除一次性 Ticket
  // ==========================================================

  clearPendingLoginTicket();

  return {
    success: true,

    accountId,

    playerProfileId,

    profile
  };
}

// ============================================================
// 對外公開
// ============================================================

window.JLYAccountResolver = {
  getPendingLoginTicket,

  clearPendingLoginTicket,

  getCurrentAccountId,

  setCurrentAccountId,

  clearCurrentAccountId,

  requestAccountBackend,

  resolveAccount,

  bindAccount,

  applyResolvedAccount
};

console.log(
  "✅ JLY Account Resolver V2 已載入"
);