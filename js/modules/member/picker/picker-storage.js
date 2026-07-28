console.log(
  "picker-storage.js 已成功載入！"
);

(function () {
  const FAVORITES_KEY =
    "jlyFavoriteStaffIds";

  const RECENT_KEY =
    "jlyRecentStaffIds";

  const MAX_RECENT_MEMBERS =
    12;

  function normalizeId(
    memberId
  ) {
    return String(
      memberId || ""
    ).trim();
  }

  function readIdList(key) {
    try {
      const rawValue =
        localStorage.getItem(
          key
        );

      if (!rawValue) {
        return [];
      }

      const parsedValue =
        JSON.parse(rawValue);

      if (
        !Array.isArray(
          parsedValue
        )
      ) {
        return [];
      }

      return [
        ...new Set(
          parsedValue
            .map(normalizeId)
            .filter(Boolean)
        )
      ];
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
      const safeIds = [
        ...new Set(
          (
            Array.isArray(
              memberIds
            )
              ? memberIds
              : []
          )
            .map(normalizeId)
            .filter(Boolean)
        )
      ];

      localStorage.setItem(
        key,
        JSON.stringify(
          safeIds
        )
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

  function getFavoriteIds() {
    return readIdList(
      FAVORITES_KEY
    );
  }

  function isFavorite(
    memberId
  ) {
    const targetId =
      normalizeId(memberId);

    if (!targetId) {
      return false;
    }

    return getFavoriteIds()
      .includes(targetId);
  }

  function addFavorite(
    memberId
  ) {
    const targetId =
      normalizeId(memberId);

    if (!targetId) {
      return getFavoriteIds();
    }

    const currentIds =
      getFavoriteIds();

    return writeIdList(
      FAVORITES_KEY,
      [
        targetId,
        ...currentIds.filter(
          function (id) {
            return (
              id !== targetId
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

    return writeIdList(
      FAVORITES_KEY,
      getFavoriteIds().filter(
        function (id) {
          return (
            id !== targetId
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
        nextIds.includes(
          targetId
        ),

      favoriteIds:
        nextIds
    };
  }

  function getRecentIds() {
    return readIdList(
      RECENT_KEY
    );
  }

  function rememberRecent(
    memberId
  ) {
    const targetId =
      normalizeId(memberId);

    if (!targetId) {
      return getRecentIds();
    }

    const currentIds =
      getRecentIds();

    const nextIds = [
      targetId,

      ...currentIds.filter(
        function (id) {
          return (
            id !== targetId
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

  function removeRecent(
    memberId
  ) {
    const targetId =
      normalizeId(memberId);

    if (!targetId) {
      return getRecentIds();
    }

    return writeIdList(
      RECENT_KEY,
      getRecentIds().filter(
        function (id) {
          return (
            id !== targetId
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