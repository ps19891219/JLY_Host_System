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

  const LINKED_PLAYER_IDS_KEY =
    "linkedPlayerIds";

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

  function normalizeIdList(values) {
    const source =
      Array.isArray(values)
        ? values
        : [];

    return Array.from(
      new Set(
        source
          .map(normalizeText)
          .filter(Boolean)
      )
    );
  }

  // ============================================================
  // Current Identity
  // ============================================================

  function getCurrentPlayerId() {
    return normalizeText(
      localStorage.getItem(
        CURRENT_PLAYER_ID_KEY
      )
    );
  }

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
  // Current Player Profile
  // ============================================================

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
      normalizeText(
        playerProfileId
      );

    if (!normalizedId) {
      return false;
    }

    localStorage.setItem(
      CURRENT_PLAYER_PROFILE_ID_KEY,
      normalizedId
    );

    return true;
  }

  function clearCurrentPlayerProfileId() {
    localStorage.removeItem(
      CURRENT_PLAYER_PROFILE_ID_KEY
    );
  }

  // ============================================================
  // Current Player Name
  // ============================================================

  function getCurrentPlayerName() {
    return normalizeText(
      localStorage.getItem(
        CURRENT_PLAYER_NAME_KEY
      )
    );
  }

  function setCurrentPlayerName(
    playerName
  ) {
    const normalizedName =
      normalizeText(playerName);

    if (!normalizedName) {
      return false;
    }

    localStorage.setItem(
      CURRENT_PLAYER_NAME_KEY,
      normalizedName
    );

    return true;
  }

    // ============================================================
  // Linked Player IDs
  //
  // 本機保存的是快取。
  // Firebase Player Profile 才是長期正式來源。
  // ============================================================

  function getLinkedPlayerIds() {
    const raw =
      localStorage.getItem(
        LINKED_PLAYER_IDS_KEY
      );

    if (!raw) {
      return [];
    }

    try {
      const ids =
        JSON.parse(raw);

      return normalizeIdList(
        ids
      );
    } catch (error) {
      console.warn(
        "讀取 linkedPlayerIds 失敗：",
        error
      );

      return [];
    }
  }

  function setLinkedPlayerIds(
    playerIds
  ) {
    const normalizedIds =
      normalizeIdList(
        playerIds
      );

    localStorage.setItem(
      LINKED_PLAYER_IDS_KEY,
      JSON.stringify(
        normalizedIds
      )
    );

    return normalizedIds;
  }

  function addLinkedPlayerId(
    playerId
  ) {
    const normalizedId =
      normalizeText(playerId);

    if (!normalizedId) {
      return false;
    }

    const nextIds =
      normalizeIdList([
        ...getLinkedPlayerIds(),
        normalizedId
      ]);

    setLinkedPlayerIds(
      nextIds
    );

    return true;
  }

  function mergeLinkedPlayerIds(
    playerIds
  ) {
    const mergedIds =
      normalizeIdList([
        ...getLinkedPlayerIds(),
        ...(
          Array.isArray(
            playerIds
          )
            ? playerIds
            : []
        )
      ]);

    setLinkedPlayerIds(
      mergedIds
    );

    return mergedIds;
  }

  // ============================================================
  // 取得目前使用者所有已知 Player Identity IDs
  //
  // 注意：
  // 這裡只整理「已確認」的 ID，
  // 不用名字猜測玩家。
  // ============================================================

  function getAllPlayerIdentityIds() {
    return normalizeIdList([
      getCurrentPlayerId(),
      getCurrentPlayerProfileId(),
      ...getLinkedPlayerIds()
    ]);
  }

  // ============================================================
  // 建立本機 JLY Identity ID
  // ============================================================

  function createIdentityId() {
    if (
      window.crypto &&
      typeof window.crypto
        .randomUUID ===
          "function"
    ) {
      return window.crypto
        .randomUUID();
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

  function ensureCurrentPlayerId() {
    const existingId =
      getCurrentPlayerId();

    if (existingId) {
      return existingId;
    }

    const newId =
      createIdentityId();

    setCurrentPlayerId(
      newId
    );

    console.log(
      "✅ 已建立 JLY Identity：",
      newId
    );

    return newId;
  }

    // ============================================================
  // 從 Firebase Player Profile 同步本機 Identity Cache
  //
  // 這個函式不負責找 Profile。
  // 只有在已知正確 playerProfileId 時才同步。
  // ============================================================

  async function syncFromPlayerProfile(
    db,
    playerProfileId
  ) {
    const normalizedProfileId =
      normalizeText(
        playerProfileId ||
        getCurrentPlayerProfileId()
      );

    if (
      !db ||
      !normalizedProfileId
    ) {
      return null;
    }

    try {
      const snapshot =
        await db
          .collection("players")
          .doc(
            normalizedProfileId
          )
          .get();

      if (!snapshot.exists) {
        console.warn(
          "Player Profile 不存在：",
          normalizedProfileId
        );

        return null;
      }

      const profileData =
        snapshot.data() || {};

      setCurrentPlayerProfileId(
        snapshot.id
      );

      if (
        profileData.displayName
      ) {
        setCurrentPlayerName(
          profileData.displayName
        );
      }

      const cloudLinkedPlayerIds =
        Array.isArray(
          profileData.linkedPlayerIds
        )
          ? profileData
              .linkedPlayerIds
          : [];

      mergeLinkedPlayerIds(
        cloudLinkedPlayerIds
      );

      return {
        id: snapshot.id,
        ...profileData
      };
    } catch (error) {
      console.error(
        "同步 Player Profile 失敗：",
        error
      );

      return null;
    }
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYIdentity = {
    getCurrentPlayerId,
    setCurrentPlayerId,
    ensureCurrentPlayerId,

    getCurrentPlayerProfileId,
    setCurrentPlayerProfileId,
    clearCurrentPlayerProfileId,

    getCurrentPlayerName,
    setCurrentPlayerName,

    getLinkedPlayerIds,
    setLinkedPlayerIds,
    addLinkedPlayerId,
    mergeLinkedPlayerIds,

    getAllPlayerIdentityIds,

    syncFromPlayerProfile
  };
})();