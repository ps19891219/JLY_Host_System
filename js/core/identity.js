console.log(
  "identity.js 已成功載入！"
);

(function () {
  "use strict";

  const CURRENT_PLAYER_ID_KEY =
  "currentPlayerId";

const CURRENT_PLAYER_PROFILE_ID_KEY =
  "currentPlayerProfileId";

const CURRENT_PLAYER_NAME_KEY =
  "currentPlayerName";

  // ============================================================
  // 基本工具
  // ============================================================

  function normalizeText(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function getCurrentPlayerId() {
    return normalizeText(
      localStorage.getItem(
        CURRENT_PLAYER_ID_KEY
      )
    );
  }

  function getCurrentPlayerProfileId() {
  return normalizeText(
    localStorage.getItem(
      CURRENT_PLAYER_PROFILE_ID_KEY
    )
  );
}

function setCurrentPlayerProfileId(
  playerProfileId
) {
  const normalizedId =
    normalizeText(playerProfileId);

  if (!normalizedId) {
    return false;
  }

  localStorage.setItem(
    CURRENT_PLAYER_PROFILE_ID_KEY,
    normalizedId
  );

  return true;
}

  function getCurrentPlayerName() {
    return normalizeText(
      localStorage.getItem(
        CURRENT_PLAYER_NAME_KEY
      )
    );
  }

  // ============================================================
  // 產生新的 JLY Identity ID
  //
  // 優先使用瀏覽器 crypto.randomUUID。
  // 舊瀏覽器才使用 fallback。
  // ============================================================

  function createIdentityId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {
      return window.crypto.randomUUID();
    }

    return (
      "jly-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 12)
    );
  }

  // ============================================================
  // 確保目前裝置具有 Identity
  //
  // 注意：
  // 這裡只建立本機 ID，
  // 不碰 Firebase，
  // 因此不會干擾 Google OAuth Popup。
  // ============================================================

  function ensureCurrentPlayerId() {
    const existingId =
      getCurrentPlayerId();

    if (existingId) {
      return existingId;
    }

    const newId =
      createIdentityId();

    localStorage.setItem(
      CURRENT_PLAYER_ID_KEY,
      newId
    );

    console.log(
      "✅ 已建立 JLY Identity：",
      newId
    );

    return newId;
  }

  // ============================================================
  // 更新目前 Player ID
  //
  // 未來 LINE 登入／帳號合併時可沿用。
  // ============================================================

  function setCurrentPlayerId(
    playerId
  ) {
    const normalizedId =
      normalizeText(playerId);

    if (!normalizedId) {
      return false;
    }

    localStorage.setItem(
      CURRENT_PLAYER_ID_KEY,
      normalizedId
    );

    return true;
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYIdentity = {
  getCurrentPlayerId,
  getCurrentPlayerProfileId,
  getCurrentPlayerName,
  ensureCurrentPlayerId,
  setCurrentPlayerId,
  setCurrentPlayerProfileId
};
})();