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
  const normalizedPlayerId =
    normalizeId(playerId);

  if (!normalizedPlayerId) {
    throw new Error(
      "缺少 playerId"
    );
  }

  const db =
    getDb();

  /*
    Firestore V8 對陣列物件中的子欄位
    不適合直接用 where 查 playerId。

    V1 先讀取 cars，
    再在前端安全判斷 players[]。
  */
  const snapshot =
    await db
      .collection("cars")
      .get();

  return snapshot.docs
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
              currentPlayerId !==
              normalizedPlayerId
            ) {
              return false;
            }

            const status =
              String(
                player.status || ""
              ).trim();

            return (
              status !== "已取消" &&
              status !== "取消" &&
              status !== "cancelled" &&
              status !== "canceled"
            );
          }
        );
      }
    );
}

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYCarData = {
  getCarById,
  getCarsByOwner,
  getCarsByIds,
  getCarsByPlayerId
};
})();