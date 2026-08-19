console.log(
  "car-data.js 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // Firebase
  // ============================================================

  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase 尚未初始化"
      );
    }

    return window.db;
  }

  function normalizeId(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  // ============================================================
  // 單台 Car
  // ============================================================

  async function getCarById(
    carId
  ) {
    const normalizedCarId =
      normalizeId(carId);

    if (!normalizedCarId) {
      throw new Error(
        "缺少車團 ID"
      );
    }

    const db =
      getDb();

    const snapshot =
      await db
        .collection("cars")
        .doc(normalizedCarId)
        .get();

    if (!snapshot.exists) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  }

  // ============================================================
  // 我的車
  //
  // Ownership V1：
  // 只取得 ownerId = 指定使用者的車。
  // ============================================================

  async function getCarsByOwner(
    ownerId
  ) {
    const normalizedOwnerId =
      normalizeId(ownerId);

    if (!normalizedOwnerId) {
      throw new Error(
        "缺少 ownerId"
      );
    }

    const db =
      getDb();

    const snapshot =
      await db
        .collection("cars")
        .where(
          "ownerId",
          "==",
          normalizedOwnerId
        )
        .get();

    return snapshot.docs.map(
      function (doc) {
        return {
          id: doc.id,
          ...doc.data()
        };
      }
    );
  }


  // ============================================================
  // 我的車分頁 V1
  //
  // - Firestore 真分頁：ownerId + documentId cursor
  // - 每頁最多回傳指定筆數
  // - 可傳入 filter 函式，會逐批掃描直到湊滿一頁或資料結束
  // - 不建立第二份 Car 正式資料
  // ============================================================

  async function getCarsByOwnerPage(
    ownerId,
    options
  ) {
    const normalizedOwnerId =
      normalizeId(ownerId);

    if (!normalizedOwnerId) {
      throw new Error(
        "缺少 ownerId"
      );
    }

    const settings =
      options || {};

    const pageSize =
      Math.max(
        1,
        Math.min(
          50,
          Number(
            settings.limit || 20
          )
        )
      );

    const filter =
      typeof settings.filter ===
        "function"
        ? settings.filter
        : null;

    let cursorId =
      normalizeId(
        settings.cursorId
      );

    const db =
      getDb();

    const batchSize =
      Math.max(
        pageSize + 1,
        24
      );

    const cars = [];
    let hasMore = false;
    let nextCursorId =
      cursorId || "";

    while (
      cars.length < pageSize
    ) {
      let query =
        db
          .collection("cars")
          .where(
            "ownerId",
            "==",
            normalizedOwnerId
          )
          .orderBy(
            firebase
              .firestore
              .FieldPath
              .documentId()
          )
          .limit(
            batchSize
          );

      if (cursorId) {
        query =
          query.startAfter(
            cursorId
          );
      }

      const snapshot =
        await query.get();

      if (
        snapshot.empty
      ) {
        hasMore = false;
        break;
      }

      const docs =
        snapshot.docs;

      let consumed = 0;

      for (
        const doc
        of docs
      ) {
        consumed += 1;

        const car = {
          id: doc.id,
          ...doc.data()
        };

        cursorId =
          doc.id;

        nextCursorId =
          doc.id;

        if (
          !filter ||
          filter(car)
        ) {
          cars.push(car);
        }

        if (
          cars.length >=
            pageSize
        ) {
          hasMore =
            consumed <
              docs.length ||
            docs.length ===
              batchSize;

          break;
        }
      }

      if (
        cars.length >=
          pageSize
      ) {
        break;
      }

      if (
        docs.length <
          batchSize
      ) {
        hasMore = false;
        break;
      }

      hasMore = true;
    }

    return {
      cars,
      nextCursorId,
      hasMore
    };
  }

  // ============================================================
// 依多個 Car ID 取得車團
// ============================================================

async function getCarsByIds(
  carIds
) {
  const ids = Array.from(
    new Set(
      (Array.isArray(carIds)
        ? carIds
        : []
      )
        .map(function (id) {
          return String(
            id || ""
          ).trim();
        })
        .filter(Boolean)
    )
  );

  if (ids.length === 0) {
    return [];
  }

  const cars =
    await Promise.all(
      ids.map(
        async function (carId) {
          try {
            return await getCarById(
              carId
            );
          } catch (error) {
            console.warn(
              "讀取車團失敗：",
              carId,
              error
            );

            return null;
          }
        }
      )
    );

  return cars.filter(Boolean);
}

// ============================================================
// 取得指定玩家參與的車團
//
// 玩家身分來源：
// car.players[].playerId
//
// 只保留：
// - playerId 相符
// - 該玩家紀錄不是已取消
// ============================================================

async function getCarsByPlayerId(
  playerId
) {
  const db =
    getDb();

  // ============================================================
  // 收集所有可能屬於目前使用者的 Player ID
  // ============================================================

  const identityIds =
    window.JLYIdentity &&
    typeof window
      .JLYIdentity
      .getAllPlayerIdentityIds ===
        "function"
      ? window.JLYIdentity
          .getAllPlayerIdentityIds()
      : [];

  const inputPlayerId =
    normalizeId(playerId);

  const initialPlayerIds =
    Array.from(
      new Set([
        inputPlayerId,
        ...identityIds
      ])
    )
      .map(normalizeId)
      .filter(Boolean);

  if (
    initialPlayerIds.length === 0
  ) {
    throw new Error(
      "缺少 playerId"
    );
  }

  // ============================================================
  // Firebase Player Profile 的 linkedPlayerIds
  //
  // 不只讀一個 Profile，
  // 而是把目前已知的所有 Identity 都檢查一次。
  // ============================================================

  const firebaseLinkedPlayerIds = [];

  for (
    const identityId
    of initialPlayerIds
  ) {
    try {
      const profileSnapshot =
        await db
          .collection("players")
          .doc(identityId)
          .get();

      if (
        !profileSnapshot.exists
      ) {
        continue;
      }

      const profileData =
        profileSnapshot.data() ||
        {};

      const linkedIds =
        Array.isArray(
          profileData
            .linkedPlayerIds
        )
          ? profileData
              .linkedPlayerIds
              .map(normalizeId)
              .filter(Boolean)
          : [];

      firebaseLinkedPlayerIds.push(
        ...linkedIds
      );
    } catch (error) {
      console.warn(
        "讀取 Firebase linkedPlayerIds 失敗：",
        identityId,
        error
      );
    }
  }

  // ============================================================
  // 最終玩家 Identity 集合
  // ============================================================

  const targetPlayerIds =
    Array.from(
      new Set([
        ...initialPlayerIds,
        ...firebaseLinkedPlayerIds
      ])
    )
      .map(normalizeId)
      .filter(Boolean);

  console.log(
    "🎮 玩家身分 IDs：",
    targetPlayerIds
  );

  // ============================================================
  // 讀取 Cars
  //
  // 舊資料不是所有車都有統一索引，
  // 所以 V1 仍完整讀 cars 再比對。
  // ============================================================

  const snapshot =
    await db
      .collection("cars")
      .get();

  const matchedCars =
    snapshot.docs
      .map(
        function (doc) {
          return {
            id: doc.id,
            ...doc.data()
          };
        }
      )
      .filter(
        function (car) {
          const players =
            Array.isArray(
              car.players
            )
              ? car.players
              : [];

          return players.some(
            function (player) {
              if (!player) {
                return false;
              }

              const currentPlayerId =
                normalizeId(
                  player.playerId ||
                  player.id ||
                  player.profileId
                );

              if (
                !currentPlayerId ||
                !targetPlayerIds
                  .includes(
                    currentPlayerId
                  )
              ) {
                return false;
              }

              const status =
                String(
                  player.status ||
                  ""
                ).trim();

              return (
                status !==
                  "已取消" &&
                status !==
                  "取消" &&
                status !==
                  "cancelled" &&
                status !==
                  "canceled"
              );
            }
          );
        }
      );

  console.log(
    "🎮 找到玩家車團：",
    matchedCars.length
  );

  return matchedCars;
}

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYCarData = {
  getCarById,
  getCarsByOwner,
  getCarsByOwnerPage,
  getCarsByIds,
  getCarsByPlayerId
};
})();