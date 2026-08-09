/*
JLY Host System

Module:
Account Resolver V1

用途：
1. 接收後端已驗證完成的 JLY Account 結果
2. 取得正確 Player Profile ID
3. 將 Account Identity 交給 JLYIdentity
4. 從 Firebase Player Profile 恢復本機 Identity Cache
5. 支援手機 / 新裝置恢復同一個 JLY 身分

不負責：
- LINE OAuth
- Channel Secret
- LINE Token Exchange
- 用名字猜 Player
- 建立 Player Profile
- Seat
- Car
- 「我是玩家」角色判斷

核心原則：

Account
→ 找到 Player Profile

Identity
→ 恢復這台裝置的 JLY Identity

Player Profile
→ 長期玩家資料來源
*/

"use strict";

console.log(
  "account-resolver.js V1 已成功載入！"
);

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
// 取得 Callback 暫存的 LINE Identity
//
// 注意：
// 這只是登入流程暫存資料。
// 不把它本身當成 JLY Account 授權依據。
// 真正 Account 對應仍必須由 Server 驗證。
// ============================================================

function getPendingLineIdentity() {
  const raw =
    sessionStorage.getItem(
      "jly_verified_line_identity"
    );

  if (!raw) {
    return null;
  }

  try {
    const data =
      JSON.parse(raw);

    const userId =
      normalizeAccountText(
        data &&
        data.userId
      );

    if (!userId) {
      return null;
    }

    return {
      userId,

      displayName:
        normalizeAccountText(
          data.displayName
        ),

      pictureUrl:
        normalizeAccountText(
          data.pictureUrl
        ),

      verifiedAt:
        normalizeAccountText(
          data.verifiedAt
        )
    };
  } catch (error) {
    console.warn(
      "讀取 LINE Identity 暫存失敗：",
      error
    );

    return null;
  }
}

// ============================================================
// 清除 Callback 暫存
// ============================================================

function clearPendingLineIdentity() {
  sessionStorage.removeItem(
    "jly_verified_line_identity"
  );
}

// ============================================================
// 套用後端 Account Resolve 結果
//
// Server Result Example:
//
// {
//   success: true,
//   account: {
//     accountId: "...",
//     playerProfileId: "..."
//   }
// }
//
// 此函式不接受 LINE 名稱猜測。
// 必須取得正式 playerProfileId。
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

  // ----------------------------------------------------------
  // STEP 1
  // 設定正式 Player Profile
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // STEP 2
  // 從 Firebase 正式 Profile 恢復：
  //
  // displayName
  // linkedPlayerIds
  // currentPlayerProfileId
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // STEP 3
  // Current Player ID
  //
  // 如果 Profile 本身有正式 identityId，
  // 優先恢復。
  //
  // 否則保留既有本機 Identity。
  // 新裝置完全沒有 Identity 時，
  // 才建立裝置端 Identity ID。
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // STEP 4
  // Account Cache
  //
  // accountId 只是本機方便辨識，
  // 不作為 Player Identity 的替代品。
  // ----------------------------------------------------------

  if (accountId) {
    localStorage.setItem(
      "currentJlyAccountId",
      accountId
    );
  }

  clearPendingLineIdentity();

  return {
    success: true,

    accountId,

    playerProfileId,

    profile
  };
}

// ============================================================
// 讀取目前 Account ID
// ============================================================

function getCurrentAccountId() {
  return normalizeAccountText(
    localStorage.getItem(
      "currentJlyAccountId"
    )
  );
}

// ============================================================
// 清除裝置 Account Cache
//
// 注意：
// 目前只清 Account Cache。
// 不直接刪除 Player Profile / linkedPlayerIds。
// 完整登出流程未來由 Account Controller 處理。
// ============================================================

function clearCurrentAccountId() {
  localStorage.removeItem(
    "currentJlyAccountId"
  );
}

// ============================================================
// 對外公開
// ============================================================

window.JLYAccountResolver = {
  getPendingLineIdentity,

  clearPendingLineIdentity,

  applyResolvedAccount,

  getCurrentAccountId,

  clearCurrentAccountId
};

console.log(
  "✅ JLY Account Resolver V1 已載入"
);