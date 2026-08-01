console.log(
  "upgrade-player.js 已成功載入！"
);

// ============================================================
// JLY Host System V2
// Player Data Upgrade
//
// 負責：
// 1. 補齊 car.players 內缺少的固定 playerId
// 2. 保留既有玩家資料
// 3. 回傳升級後 players 與變更狀態
//
// 不負責：
// - 修改 slots
// - 寫入 Firestore
// - 畫面 render
// - LINE 登入
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

  function createStablePlayerId() {
    return (
      "car-player-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }

  function upgradePlayers(players) {
    const sourcePlayers =
      Array.isArray(players)
        ? players
        : [];

    let changed = false;

    const nextPlayers =
      sourcePlayers.map(
        function (player) {
          const sourcePlayer =
            player || {};

          const existingPlayerId =
            String(
              sourcePlayer.playerId ||
              sourcePlayer.id ||
              ""
            ).trim();

          if (existingPlayerId) {
            return cloneValue(
              sourcePlayer
            );
          }

          changed = true;

          return {
            ...cloneValue(sourcePlayer),

            playerId:
              createStablePlayerId(),

            source:
              sourcePlayer.source ||
              "legacy_migration",

            playerType:
              sourcePlayer.playerType ||
              "legacy"
          };
        }
      );

    return {
      players: nextPlayers,
      changed
    };
  }

  window.JLYUpgradePlayer = {
    upgradePlayers
  };
})();