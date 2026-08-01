console.log(
  "detail-upgrade.js 已成功載入！"
);

// ============================================================
// JLY Host System V2
// Car Detail - Upgrade Bridge
//
// 負責：
// 1. 呼叫 Upgrade Controller
// 2. 建立安全的升級結果
// 3. 將必要修復永久寫回 Firestore
// 4. 提供 Car Detail 頁面統一使用
//
// 不負責：
// - 畫面 Render
// - Seat 操作
// - 玩家操作
// - 報名審核
// ============================================================

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 時間
  // ------------------------------------------------------------

  function nowTime() {
    return new Date().toISOString();
  }

  // ------------------------------------------------------------
  // 複製 Slots
  // ------------------------------------------------------------

  function cloneSlots(slots) {
    if (!Array.isArray(slots)) {
      return [];
    }

    return slots.map(
      function (slot) {
        return {
          ...slot,

          player:
            slot &&
            slot.player &&
            typeof slot.player ===
              "object"
              ? {
                  ...slot.player
                }
              : null
        };
      }
    );
  }

  // ------------------------------------------------------------
  // 建立安全的 Upgrade Result
  // ------------------------------------------------------------

  function createFallbackResult(car) {
    const safeCar =
      car &&
      typeof car === "object"
        ? car
        : {};

    return {
      car: safeCar,

      changed: false,

      playerChanged: false,

      seatChanged: false
    };
  }

  // ------------------------------------------------------------
  // 執行資料升級
  // ------------------------------------------------------------

  function upgradeCarData(rawCar) {
    const controller =
      window.JLYUpgradeController;

    if (
      !controller ||
      typeof controller.upgradeCarData !==
        "function"
    ) {
      console.warn(
        "Car Detail Upgrade：Upgrade Controller 尚未載入"
      );

      return createFallbackResult(
        rawCar
      );
    }

    try {
      const result =
        controller.upgradeCarData(
          rawCar
        );

      if (
        !result ||
        !result.car
      ) {
        return createFallbackResult(
          rawCar
        );
      }

      return {
        car:
          result.car,

        changed:
          result.changed === true,

        playerChanged:
          result.playerChanged ===
          true,

        seatChanged:
          result.seatChanged ===
          true
      };
    } catch (error) {
      console.error(
        "Car Detail Upgrade 執行失敗：",
        error
      );

      return createFallbackResult(
        rawCar
      );
    }
  }

  // ------------------------------------------------------------
  // 建立 Firestore 更新資料
  // ------------------------------------------------------------

  function buildRepairData(
    upgradeResult
  ) {
    if (
      !upgradeResult ||
      upgradeResult.changed !== true ||
      !upgradeResult.car
    ) {
      return null;
    }

    const upgradedCar =
      upgradeResult.car;

    const updateData = {
      updatedAt:
        nowTime()
    };

    if (
      upgradeResult.playerChanged ===
        true &&
      Array.isArray(
        upgradedCar.players
      )
    ) {
      updateData.players =
        upgradedCar.players.map(
          function (player) {
            return {
              ...player
            };
          }
        );
    }

    if (
      upgradeResult.seatChanged ===
        true &&
      Array.isArray(
        upgradedCar.slots
      )
    ) {
      updateData.slots =
        cloneSlots(
          upgradedCar.slots
        );
    }

    if (
      Object.keys(updateData)
        .length <= 1
    ) {
      return null;
    }

    return updateData;
  }

  // ------------------------------------------------------------
  // 永久修復 Firestore 資料
  //
  // 不顯示 alert。
  // 玩家、主揪與工作室都不需要知道。
  // 僅在 Console 留管理者紀錄。
  // ------------------------------------------------------------

  async function repairUpgradedCarData(
    carId,
    upgradeResult
  ) {
    const db =
      window.db;

    if (
      !db ||
      !carId
    ) {
      return {
        repaired: false,
        reason:
          "missing-context"
      };
    }

    const updateData =
      buildRepairData(
        upgradeResult
      );

    if (!updateData) {
      return {
        repaired: false,
        reason:
          "no-change"
      };
    }

    try {
      await db
        .collection("cars")
        .doc(carId)
        .update(
          updateData
        );

      console.log(
        "✅ Car Detail Auto Repair 完成",
        {
          carId,

          playerRepaired:
            Array.isArray(
              updateData.players
            ),

          seatRepaired:
            Array.isArray(
              updateData.slots
            )
        }
      );

      return {
        repaired: true,
        reason: ""
      };
    } catch (error) {
      console.error(
        "Car Detail Auto Repair 失敗：",
        error
      );

      return {
        repaired: false,
        reason:
          "write-failed",
        error
      };
    }
  }

  // ------------------------------------------------------------
  // 升級＋修復完整流程
  // ------------------------------------------------------------

  async function prepareCar(
    carId,
    rawCar
  ) {
    const upgradeResult =
      upgradeCarData(
        rawCar
      );

    const repairResult =
      await repairUpgradedCarData(
        carId,
        upgradeResult
      );

    return {
      car:
        upgradeResult.car,

      upgradeResult,

      repairResult
    };
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailUpgrade = {
    cloneSlots,

    createFallbackResult,

    upgradeCarData,

    buildRepairData,

    repairUpgradedCarData,

    prepareCar
  };

  // ------------------------------------------------------------
  // 相容目前 cardetail.js
  //
  // 舊檔仍呼叫 repairUpgradedCarData()。
  // 先由新模組接管，確認穩定後再刪除舊函式。
  // ------------------------------------------------------------

  window.repairUpgradedCarData =
    repairUpgradedCarData;

  console.log(
    "✅ Car Detail Upgrade Bridge 已載入"
  );
})();