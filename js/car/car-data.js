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
  // 對外公開
  // ============================================================

  window.JLYCarData = {
  getCarById,
  getCarsByOwner,
  getCarsByIds
};
})();