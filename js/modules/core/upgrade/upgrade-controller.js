console.log(
  "upgrade-controller.js 已成功載入！"
);

// ============================================================
// JLY Host System V2
// Upgrade Controller
//
// 負責：
// 1. 統一呼叫各資料升級模組
// 2. 控制玩家與席位升級順序
// 3. 比較升級前後資料
// 4. 回傳升級後的 car 與變更狀態
//
// 不負責：
// - 寫入 Firestore
// - 畫面 Render
// - DOM 操作
// ============================================================

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 複製一般資料
  // ------------------------------------------------------------

  function cloneValue(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  // ------------------------------------------------------------
  // 穩定排序物件欄位
  //
  // Firestore 重新讀取資料時，
  // 物件欄位順序可能不同。
  //
  // 若直接 JSON.stringify 比較，
  // 可能會把內容相同的資料誤判為不同。
  // ------------------------------------------------------------

  function normalizeForCompare(value) {
    if (Array.isArray(value)) {
      return value.map(
        function (item) {
          return normalizeForCompare(
            item
          );
        }
      );
    }

    if (
      value &&
      typeof value === "object"
    ) {
      return Object.keys(value)
        .sort()
        .reduce(
          function (
            result,
            key
          ) {
            result[key] =
              normalizeForCompare(
                value[key]
              );

            return result;
          },
          {}
        );
    }

    return value;
  }

  // ------------------------------------------------------------
  // 比較兩份資料內容是否相同
  // ------------------------------------------------------------

  function isSameData(
    firstValue,
    secondValue
  ) {
    return (
      JSON.stringify(
        normalizeForCompare(
          firstValue
        )
      ) ===
      JSON.stringify(
        normalizeForCompare(
          secondValue
        )
      )
    );
  }

  // ------------------------------------------------------------
  // 車團資料升級總流程
  // ------------------------------------------------------------

  function upgradeCarData(car) {
    const sourceCar =
      car &&
      typeof car === "object"
        ? cloneValue(car)
        : {};

    const PlayerUpgrade =
      window.JLYUpgradePlayer;

    const SeatUpgrade =
      window.JLYUpgradeSeat;

    if (
      !PlayerUpgrade ||
      typeof PlayerUpgrade.upgradePlayers !==
        "function"
    ) {
      throw new Error(
        "Player Upgrade 尚未載入"
      );
    }

    if (
      !SeatUpgrade ||
      typeof SeatUpgrade.upgradeSeats !==
        "function"
    ) {
      throw new Error(
        "Seat Upgrade 尚未載入"
      );
    }

    // ----------------------------------------------------------
    // 先升級玩家資料
    // ----------------------------------------------------------

    const playerResult =
      PlayerUpgrade.upgradePlayers(
        sourceCar.players
      );

    const upgradedPlayers =
      Array.isArray(
        playerResult.players
      )
        ? playerResult.players
        : [];

    // ----------------------------------------------------------
    // 再使用升級後的玩家資料整理席位
    // ----------------------------------------------------------

    const originalSlots =
      Array.isArray(sourceCar.slots)
        ? sourceCar.slots
        : [];

    const upgradedSlots =
      SeatUpgrade.upgradeSeats(
        originalSlots,
        upgradedPlayers
      );

    // ----------------------------------------------------------
    // 判斷資料是否真的改變
    // ----------------------------------------------------------

    const playerChanged =
      Boolean(
        playerResult.changed
      );

    const seatChanged =
      !isSameData(
        originalSlots,
        upgradedSlots
      );

    const changed =
      Boolean(
        playerChanged ||
        seatChanged
      );

    // ----------------------------------------------------------
    // 建立升級後的車團資料
    // ----------------------------------------------------------

    const nextCar = {
      ...sourceCar,

      players:
        upgradedPlayers,

      slots:
        upgradedSlots
    };

    console.log(
      "🧪 Upgrade Controller 狀態：",
      {
        playerChanged,
        seatChanged,
        changed
      }
    );

    return {
      car:
        nextCar,

      changed,

      playerChanged,

      seatChanged
    };
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYUpgradeController = {
    cloneValue,
    normalizeForCompare,
    isSameData,
    upgradeCarData
  };

  console.log(
    "✅ Upgrade Controller 已載入"
  );
})();