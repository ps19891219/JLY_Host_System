/*
====================================================

JLY Host System V3

Module：
Car Detail Loader

用途：
1. 讀取 Firestore 車團資料
2. 呼叫 Detail Upgrade Bridge
3. 建立車團詳情頁標準資料
4. 不負責 Render 與 DOM 操作

依賴：
- window.db
- window.JLYCarDetailUpgrade

====================================================
*/

console.log(
  "detail-loader.js 已成功載入！"
);

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 建立標準錯誤
  // ------------------------------------------------------------

  function createLoaderError(
    code,
    message
  ) {
    const error =
      new Error(message);

    error.code =
      code;

    return error;
  }

  // ------------------------------------------------------------
  // 取得玩家
  // ------------------------------------------------------------

  function getPlayers(car) {
    return (
      car &&
      Array.isArray(car.players)
        ? car.players
        : []
    );
  }

  // ------------------------------------------------------------
  // 取得有效玩家
  // ------------------------------------------------------------

  function getActivePlayers(car) {
    return getPlayers(car).filter(
      function (player) {
        return (
          player &&
          player.status !==
            "已取消"
        );
      }
    );
  }

  // ------------------------------------------------------------
  // 取得報名申請
  // ------------------------------------------------------------

  function getApplications(car) {
    return (
      car &&
      Array.isArray(
        car.applications
      )
        ? car.applications
        : []
    );
  }

  // ------------------------------------------------------------
  // 取得歷史紀錄
  // ------------------------------------------------------------

  function getHistory(car) {
    return (
      car &&
      Array.isArray(car.history)
        ? car.history
        : []
    );
  }

  // ------------------------------------------------------------
  // 取得席位
  // ------------------------------------------------------------

  function getSlots(car) {
    if (
      car &&
      Array.isArray(car.slots)
    ) {
      return car.slots;
    }

    return [];
  }

  // ------------------------------------------------------------
  // 建立沒有 Upgrade Bridge 時的安全結果
  // ------------------------------------------------------------

  function createFallbackPreparedResult(
    rawCar
  ) {
    return {
      car:
        rawCar,

      upgradeResult: {
        car:
          rawCar,

        changed:
          false,

        playerChanged:
          false,

        seatChanged:
          false
      },

      repairResult: {
        repaired:
          false,

        reason:
          "bridge-not-loaded"
      }
    };
  }

  // ------------------------------------------------------------
  // 執行 Upgrade Bridge
  // ------------------------------------------------------------

  async function prepareCar(
    carId,
    rawCar
  ) {
    const upgradeBridge =
      window.JLYCarDetailUpgrade;

    if (
      !upgradeBridge ||
      typeof upgradeBridge.prepareCar !==
        "function"
    ) {
      console.warn(
        "Detail Loader：Upgrade Bridge 尚未載入"
      );

      return createFallbackPreparedResult(
        rawCar
      );
    }

    return upgradeBridge.prepareCar(
      carId,
      rawCar
    );
  }

  // ------------------------------------------------------------
  // 讀取單一車團
  // ------------------------------------------------------------

  async function loadCar(carId) {
    const db =
      window.db;

    if (!db) {
      throw createLoaderError(
        "firebase-not-ready",
        "Firebase 尚未載入"
      );
    }

    if (!carId) {
      throw createLoaderError(
        "missing-car-id",
        "找不到車團 ID"
      );
    }

    const carDoc =
      await db
        .collection("cars")
        .doc(carId)
        .get();

    if (!carDoc.exists) {
      throw createLoaderError(
        "car-not-found",
        "找不到這台車"
      );
    }

    const rawCar = {
      id:
        carDoc.id,

      ...carDoc.data()
    };

    const preparedResult =
      await prepareCar(
        carId,
        rawCar
      );

    const car =
      preparedResult &&
      preparedResult.car
        ? preparedResult.car
        : rawCar;

    const players =
      getPlayers(car);

    const activePlayers =
      getActivePlayers(car);

    const applications =
      getApplications(car);

    const history =
      getHistory(car);

    const slots =
      getSlots(car);

    const result = {
      carId,

      rawCar,

      car,

      players,

      activePlayers,

      applications,

      history,

      slots,

      upgradeResult:
        preparedResult.upgradeResult,

      repairResult:
        preparedResult.repairResult
    };

    console.log(
      "📦 Detail Loader 完成：",
      {
        carId,

        playerCount:
          players.length,

        activePlayerCount:
          activePlayers.length,

        applicationCount:
          applications.length,

        slotCount:
          slots.length,

        upgradeChanged:
          Boolean(
            result.upgradeResult &&
            result.upgradeResult.changed
          )
      }
    );

    return result;
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailLoader = {
    createLoaderError,

    getPlayers,

    getActivePlayers,

    getApplications,

    getHistory,

    getSlots,

    createFallbackPreparedResult,

    prepareCar,

    loadCar
  };

  console.log(
    "✅ Car Detail Loader 已載入"
  );
})();