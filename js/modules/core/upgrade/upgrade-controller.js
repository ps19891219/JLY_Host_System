console.log(
  "upgrade-controller.js 已成功載入！"
);

// ============================================================
// JLY Host System V2
// Upgrade Controller
//
// 負責：
// 1. 統一呼叫各資料升級模組
// 2. 控制升級順序
// 3. 回傳升級後的 car 與變更狀態
//
// 暫時不負責：
// - 寫入 Firestore
// - 畫面 Render
// - 自動執行升級
// ============================================================

(function () {
  "use strict";

  function cloneValue(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function upgradeCarData(car) {
    const sourceCar =
      car && typeof car === "object"
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

    const playerResult =
      PlayerUpgrade.upgradePlayers(
        sourceCar.players
      );

    const upgradedSlots =
  SeatUpgrade.upgradeSeats(
    sourceCar.slots,
    playerResult.players
  );

  const seatChanged =
  JSON.stringify(
    Array.isArray(sourceCar.slots)
      ? sourceCar.slots
      : []
  ) !==
  JSON.stringify(upgradedSlots);

    const nextCar = {
      ...sourceCar,

      players:
        playerResult.players,

      slots:
        upgradedSlots
    };

    console.log(
  "🧪 Upgrade Controller 狀態：",
  {
    playerChanged:
      Boolean(playerResult.changed),

    seatChanged,

    changed:
      Boolean(
        playerResult.changed ||
        seatChanged
      )
  }
);

    return {
  car: nextCar,

  changed:
    Boolean(
      playerResult.changed ||
      seatChanged
    ),

  playerChanged:
    Boolean(
      playerResult.changed
    ),

  seatChanged
};

  window.JLYUpgradeController = {
    upgradeCarData
  };

  console.log(
    "✅ Upgrade Controller 已載入"
  );
})();