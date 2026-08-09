console.log(
  "car-ownership-v1.js 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // 基本工具
  // ============================================================

  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase 尚未初始化"
      );
    }

    return window.db;
  }

  function getCurrentOwnerId() {
    if (
      window.JLYIdentity &&
      typeof window
        .JLYIdentity
        .getCurrentPlayerId ===
        "function"
    ) {
      return window
        .JLYIdentity
        .getCurrentPlayerId();
    }

    return String(
      localStorage.getItem(
        "currentPlayerId"
      ) || ""
    ).trim();
  }

  function hasOwnerId(car) {
    return Boolean(
      car &&
      String(
        car.ownerId || ""
      ).trim()
    );
  }

  // ============================================================
  // 預覽 Migration
  //
  // 只找 ownerId 不存在或空白的舊車。
  // 不會修改任何資料。
  // ============================================================

  async function previewCarOwnershipMigration() {
    const db =
      getDb();

    const ownerId =
      getCurrentOwnerId();

    if (!ownerId) {
      throw new Error(
        "目前沒有 currentPlayerId"
      );
    }

    const snapshot =
      await db
        .collection("cars")
        .get();

    const allCars =
      snapshot.docs.map(
        function (doc) {
          return {
            id: doc.id,
            ...doc.data()
          };
        }
      );

    const targetCars =
      allCars.filter(
        function (car) {
          return !hasOwnerId(car);
        }
      );

    const alreadyOwnedCars =
      allCars.filter(
        function (car) {
          return hasOwnerId(car);
        }
      );

    const result = {
      ownerId,
      totalCars:
        allCars.length,

      targetCount:
        targetCars.length,

      alreadyOwnedCount:
        alreadyOwnedCars.length,

      targetCars:
        targetCars.map(
          function (car) {
            return {
              id:
                car.id,

              scriptName:
                car.scriptName ||
                car.activityName ||
                "未命名劇本",

              gameDate:
                car.gameDate ||
                "",

              status:
                car.status ||
                ""
            };
          }
        )
    };

    console.log(
      "🔍 Car Ownership Migration 預覽：",
      result
    );

    return result;
  }

  // ============================================================
  // 執行 Migration
  //
  // 安全規則：
  // 1. 只處理 ownerId 不存在或空白的車
  // 2. 已有 ownerId 絕不覆蓋
  // 3. 執行前再次讀取最新 Firestore
  // ============================================================

  async function runCarOwnershipMigration() {
    const db =
      getDb();

    const ownerId =
      getCurrentOwnerId();

    if (!ownerId) {
      throw new Error(
        "目前沒有 currentPlayerId"
      );
    }

    const preview =
      await previewCarOwnershipMigration();

    if (
      preview.targetCount === 0
    ) {
      alert(
        "沒有需要補 ownerId 的舊車。"
      );

      return {
        updatedCount: 0,
        skippedCount:
          preview.alreadyOwnedCount
      };
    }

    const confirmed =
      confirm(
        [
          "Car Ownership Migration V1",
          "",
          "目前 ownerId：",
          ownerId,
          "",
          "全部車團：" +
            preview.totalCars +
            " 台",
          "",
          "需要補 ownerId：" +
            preview.targetCount +
            " 台",
          "",
          "已有 ownerId：" +
            preview
              .alreadyOwnedCount +
            " 台",
          "",
          "只會更新 ownerId 為空白的舊車。",
          "已有 ownerId 的資料不會被覆蓋。",
          "",
          "確定執行嗎？"
        ].join("\n")
      );

    if (!confirmed) {
      console.log(
        "Migration 已取消"
      );

      return null;
    }

    const snapshot =
      await db
        .collection("cars")
        .get();

    let updatedCount = 0;
    let skippedCount = 0;

    const updateTasks = [];

    snapshot.docs.forEach(
      function (doc) {
        const car =
          doc.data() || {};

        if (hasOwnerId(car)) {
          skippedCount += 1;
          return;
        }

        updateTasks.push(
          doc.ref.update({
            ownerId,

            ownershipVersion:
              1,

            ownershipMigratedAt:
              new Date()
                .toISOString()
          }).then(
            function () {
              updatedCount += 1;
            }
          )
        );
      }
    );

    await Promise.all(
      updateTasks
    );

    const result = {
      ownerId,
      updatedCount,
      skippedCount
    };

    console.log(
      "✅ Car Ownership Migration 完成：",
      result
    );

    alert(
      [
        "Ownership Migration 完成",
        "",
        "已補 ownerId：" +
          updatedCount +
          " 台",
        "",
        "略過已有 ownerId：" +
          skippedCount +
          " 台"
      ].join("\n")
    );

    return result;
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYCarOwnershipMigration = {
    preview:
      previewCarOwnershipMigration,

    run:
      runCarOwnershipMigration
  };
})();