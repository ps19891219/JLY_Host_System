console.log(
  "picker-storage.js 已成功載入！"
);

(function () {
  const FAVORITES_KEY =
    "jlyFavoriteStaffIds";

  const RECENT_KEY =
    "jlyRecentStaffIds";

  const MAX_RECENT_MEMBERS = 12;

  // ============================================================
  // 基本整理
  // ============================================================

  function normalizeId(memberId) {
    if (
      memberId &&
      typeof memberId === "object"
    ) {
      memberId =
        memberId.memberId ||
        memberId.playerId ||
        memberId.profileId ||
        memberId.id ||
        "";
    }

    return String(
      memberId || ""
    ).trim();
  }

  function getIdCompareKey(memberId) {
    return normalizeId(memberId)
      .toLocaleLowerCase();
  }

  function dedupeIds(memberIds) {
    const sourceIds =
      Array.isArray(memberIds)
        ? memberIds
        : [];

    const usedKeys = new Set();
    const safeIds = [];

    sourceIds.forEach(function (
      memberId
    ) {
      const normalizedId =
        normalizeId(memberId);

      if (!normalizedId) {
        return;
      }

      const compareKey =
        getIdCompareKey(
          normalizedId
        );

      if (
        !compareKey ||
        usedKeys.has(compareKey)
      ) {
        return;
      }

      usedKeys.add(compareKey);
      safeIds.push(normalizedId);
    });

    return safeIds;
  }

  function areIdListsEqual(
    firstList,
    secondList
  ) {
    if (
      firstList.length !==
      secondList.length
    ) {
      return false;
    }

    return firstList.every(
      function (memberId, index) {
        return (
          normalizeId(memberId) ===
          normalizeId(
            secondList[index]
          )
        );
      }
    );
  }

    // ============================================================
  // localStorage 讀寫
  // ============================================================

  function readIdList(key) {
    try {
      const rawValue =
        localStorage.getItem(key);

      if (!rawValue) {
        return [];
      }

      const parsedValue =
        JSON.parse(rawValue);

      if (
        !Array.isArray(parsedValue)
      ) {
        localStorage.removeItem(key);
        return [];
      }

      const safeIds =
        dedupeIds(parsedValue);

      /*
       * 舊資料如果包含：
       * 1. 重複 ID
       * 2. 空白 ID
       * 3. 數字型 ID
       * 4. 舊物件格式
       *
       * 讀取時直接清洗並寫回，
       * 避免下次開啟時再次出現。
       */
      if (
        !areIdListsEqual(
          parsedValue,
          safeIds
        )
      ) {
        localStorage.setItem(
          key,
          JSON.stringify(safeIds)
        );
      }

      return safeIds;
    } catch (error) {
      console.warn(
        "讀取 Member Picker 本機資料失敗：",
        key,
        error
      );

      return [];
    }
  }

  function writeIdList(
    key,
    memberIds
  ) {
    try {
      const safeIds =
        dedupeIds(memberIds);

      localStorage.setItem(
        key,
        JSON.stringify(safeIds)
      );

      return safeIds;
    } catch (error) {
      console.warn(
        "儲存 Member Picker 本機資料失敗：",
        key,
        error
      );

      return [];
    }
  }

  // ============================================================
  // 最愛名單
  // ============================================================

  function getFavoriteIds() {
    return readIdList(
      FAVORITES_KEY
    );
  }

  function isFavorite(memberId) {
    const targetId =
      normalizeId(memberId);

    if (!targetId) {
      return false;
    }

    const targetKey =
      getIdCompareKey(targetId);

    return getFavoriteIds().some(
      function (id) {
        return (
          getIdCompareKey(id) ===
          targetKey
        );
      }
    );
  }

    function addFavorite(memberId) {
    const targetId =
      normalizeId(memberId);

    if (!targetId) {
      return getFavoriteIds();
    }

    const targetKey =
      getIdCompareKey(targetId);

    const currentIds =
      getFavoriteIds();

    return writeIdList(
      FAVORITES_KEY,
      [
        targetId,

        ...currentIds.filter(
          function (id) {
            return (
              getIdCompareKey(id) !==
              targetKey
            );
          }
        )
      ]
    );
  }

  function removeFavorite(
    memberId
  ) {
    const targetId =
      normalizeId(memberId);

    if (!targetId) {
      return getFavoriteIds();
    }

    const targetKey =
      getIdCompareKey(targetId);

    return writeIdList(
      FAVORITES_KEY,
      getFavoriteIds().filter(
        function (id) {
          return (
            getIdCompareKey(id) !==
            targetKey
          );
        }
      )
    );
  }

  function toggleFavorite(
    memberId
  ) {
    const targetId =
      normalizeId(memberId);

    if (!targetId) {
      return {
        isFavorite: false,

        favoriteIds:
          getFavoriteIds()
      };
    }

    const nextIds =
      isFavorite(targetId)
        ? removeFavorite(
            targetId
          )
        : addFavorite(
            targetId
          );

    return {
      isFavorite:
        nextIds.some(
          function (id) {
            return (
              getIdCompareKey(id) ===
              getIdCompareKey(
                targetId
              )
            );
          }
        ),

      favoriteIds: nextIds
    };
  }

  // ============================================================
  // 歷史名單
  // ============================================================

  function getRecentIds() {
    const recentIds =
      readIdList(RECENT_KEY)
        .slice(
          0,
          MAX_RECENT_MEMBERS
        );

    /*
     * 舊資料如果超過 12 筆，
     * 讀取時也同步縮減並寫回。
     */
    writeIdList(
      RECENT_KEY,
      recentIds
    );

    return recentIds;
  }

    function rememberRecent(
    memberId
  ) {
    const targetId =
      normalizeId(memberId);

    if (!targetId) {
      return getRecentIds();
    }

    const targetKey =
      getIdCompareKey(targetId);

    const currentIds =
      getRecentIds();

    /*
     * 新選取的人放在最前面。
     *
     * 原本歷史中若已有相同 ID，
     * 先移除舊位置，再重新放到第一筆。
     */
    const nextIds = [
      targetId,

      ...currentIds.filter(
        function (id) {
          return (
            getIdCompareKey(id) !==
            targetKey
          );
        }
      )
    ].slice(
      0,
      MAX_RECENT_MEMBERS
    );

    return writeIdList(
      RECENT_KEY,
      nextIds
    );
  }

  function removeRecent(memberId) {
    const targetId =
      normalizeId(memberId);

    if (!targetId) {
      return getRecentIds();
    }

    const targetKey =
      getIdCompareKey(targetId);

    return writeIdList(
      RECENT_KEY,
      getRecentIds().filter(
        function (id) {
          return (
            getIdCompareKey(id) !==
            targetKey
          );
        }
      )
    );
  }

  function clearRecent() {
    return writeIdList(
      RECENT_KEY,
      []
    );
  }

  function clearFavorites() {
    return writeIdList(
      FAVORITES_KEY,
      []
    );
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYMemberPickerStorage = {
    getFavoriteIds,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,

    getRecentIds,
    rememberRecent,
    removeRecent,

    clearRecent,
    clearFavorites
  };
})();