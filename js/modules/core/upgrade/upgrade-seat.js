console.log(
  "upgrade-seat.js 已成功載入！"
);

// ============================================================
// JLY Host System V2
// Seat Data Upgrade
//
// 負責：
// 1. 將舊席位整理成 Seat Engine V2 格式
// 2. 使用固定 playerId 重新連結玩家
// 3. 舊 playerId 失效時，使用唯一姓名安全配對
// 4. 清除已不存在於 car.players 的幽靈席位
// 5. 保證重複執行後，資料結果保持一致
//
// 不負責：
// - 修改 car.players
// - 寫入 Firestore
// - 畫面 Render
// - 更改座位 updatedAt
// - 自動安排玩家
// ============================================================

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 基礎文字整理
  // ------------------------------------------------------------

  function normalizeText(value) {
    return String(
      value == null
        ? ""
        : value
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  // ------------------------------------------------------------
  // 取得玩家固定 ID
  // ------------------------------------------------------------

  function getPlayerId(player) {
    if (
      !player ||
      typeof player !== "object"
    ) {
      return "";
    }

    return String(
      player.playerId ||
      player.id ||
      player.profileId ||
      player.applicationId ||
      ""
    ).trim();
  }

  // ------------------------------------------------------------
  // 取得玩家可能使用的名字
  // ------------------------------------------------------------

  function getPlayerNames(player) {
    if (
      !player ||
      typeof player !== "object"
    ) {
      return [];
    }

    const names = [
      player.hostAlias,
      player.displayName,
      player.playerName,
      player.nickname,
      player.name
    ]
      .map(normalizeText)
      .filter(Boolean);

    return Array.from(
      new Set(names)
    );
  }

  // ------------------------------------------------------------
  // 取得舊席位裡可能保存的玩家名字
  // ------------------------------------------------------------

  function getSeatPlayerNames(slot) {
    if (
      !slot ||
      typeof slot !== "object"
    ) {
      return [];
    }

    const seatPlayer =
      slot.player &&
      typeof slot.player === "object"
        ? slot.player
        : {};

    const names = [
      slot.hostAlias,
      slot.displayName,
      slot.playerName,
      slot.name,

      seatPlayer.hostAlias,
      seatPlayer.displayName,
      seatPlayer.playerName,
      seatPlayer.nickname,
      seatPlayer.name
    ]
      .map(normalizeText)
      .filter(Boolean);

    return Array.from(
      new Set(names)
    );
  }

  // ------------------------------------------------------------
  // 取得席位目前記錄的玩家 ID
  // ------------------------------------------------------------

  function getSeatPlayerId(slot) {
    if (
      !slot ||
      typeof slot !== "object"
    ) {
      return "";
    }

    const seatPlayer =
      slot.player &&
      typeof slot.player === "object"
        ? slot.player
        : {};

    return String(
      slot.playerId ||
      seatPlayer.playerId ||
      seatPlayer.id ||
      ""
    ).trim();
  }

  // ------------------------------------------------------------
  // 依固定 ID 尋找玩家
  // ------------------------------------------------------------

  function findPlayerById(
    players,
    playerId
  ) {
    const normalizedPlayerId =
      String(
        playerId || ""
      ).trim();

    if (!normalizedPlayerId) {
      return null;
    }

    return (
      players.find(
        function (player) {
          return (
            getPlayerId(player) ===
            normalizedPlayerId
          );
        }
      ) ||
      null
    );
  }

  // ------------------------------------------------------------
  // 依姓名尋找唯一玩家
  //
  // 若有兩位以上同名玩家，系統不自行猜測。
  // ------------------------------------------------------------

  function findUniquePlayerByName(
    players,
    seatNames
  ) {
    if (
      !Array.isArray(seatNames) ||
      seatNames.length === 0
    ) {
      return null;
    }

    const matches =
      players.filter(
        function (player) {
          const playerNames =
            getPlayerNames(player);

          return seatNames.some(
            function (seatName) {
              return playerNames.includes(
                seatName
              );
            }
          );
        }
      );

    if (matches.length !== 1) {
      return null;
    }

    return matches[0];
  }

  // ------------------------------------------------------------
  // 整理座位 ID
  // ------------------------------------------------------------

  function getSeatId(
    slot,
    index
  ) {
    return String(
      slot.seatId ||
      slot.slotId ||
      slot.id ||
      `slot-${index + 1}`
    );
  }

  // ------------------------------------------------------------
  // 整理原始座位分類
  // ------------------------------------------------------------

  function getOriginalType(slot) {
    return (
      slot.originalType ||
      slot.type ||
      "flexible"
    );
  }

  // ------------------------------------------------------------
  // 建立固定、可重複比較的基礎席位
  //
  // 不修改：
  // - createdAt
  // - updatedAt
  // - roleName
  // - 其他既有設定
  // ------------------------------------------------------------

  function buildBaseSeat(
    slot,
    index
  ) {
    const sourceSlot =
      slot &&
      typeof slot === "object"
        ? slot
        : {};

    const seatId =
      getSeatId(
        sourceSlot,
        index
      );

    const originalType =
      getOriginalType(
        sourceSlot
      );

    return {
      ...sourceSlot,

      id:
        sourceSlot.id ||
        seatId,

      seatId:
        sourceSlot.seatId ||
        seatId,

      slotId:
        sourceSlot.slotId ||
        seatId,

      order:
        Number.isFinite(
          Number(sourceSlot.order)
        )
          ? Number(sourceSlot.order)
          : index + 1,

      originalType,

      type:
        sourceSlot.type ||
        originalType
    };
  }

  // ------------------------------------------------------------
  // 建立空席位
  //
  // 若原本是 flexible，但曾因玩家改為 male／female，
  // 玩家被移除後要恢復 flexible。
  // ------------------------------------------------------------

  function buildEmptySeat(
    slot,
    index
  ) {
    const baseSeat =
      buildBaseSeat(
        slot,
        index
      );

    return {
      ...baseSeat,

      type:
        baseSeat.originalType ||
        baseSeat.type ||
        "flexible",

      playerId: null,
      player: null
    };
  }

  // ------------------------------------------------------------
  // 建立已入席座位
  //
  // 不產生新的時間資料，
  // 不修改席位 updatedAt。
  // ------------------------------------------------------------

  function buildOccupiedSeat(
    slot,
    index,
    matchedPlayer
  ) {
    const baseSeat =
      buildBaseSeat(
        slot,
        index
      );

    const playerId =
      getPlayerId(
        matchedPlayer
      );

    return {
      ...baseSeat,

      playerId,

      player: {
        ...matchedPlayer,

        playerId
      }
    };
  }

  // ------------------------------------------------------------
  // 整理單一席位
  // ------------------------------------------------------------

  function normalizeSeat(
    slot,
    index,
    players
  ) {
    const sourceSlot =
      slot &&
      typeof slot === "object"
        ? slot
        : {};

    const sourcePlayers =
      Array.isArray(players)
        ? players.filter(Boolean)
        : [];

    const seatPlayerId =
      getSeatPlayerId(
        sourceSlot
      );

    const seatNames =
      getSeatPlayerNames(
        sourceSlot
      );

    const hasPlayerData =
      Boolean(
        seatPlayerId ||
        seatNames.length > 0
      );

    // 完全沒有玩家資料，本來就是空位。
    if (!hasPlayerData) {
      return buildEmptySeat(
        sourceSlot,
        index
      );
    }

    // 第一順位：固定 playerId。
    const matchedById =
      findPlayerById(
        sourcePlayers,
        seatPlayerId
      );

    if (matchedById) {
      return buildOccupiedSeat(
        sourceSlot,
        index,
        matchedById
      );
    }

    // 第二順位：舊資料姓名。
    const matchedByName =
      findUniquePlayerByName(
        sourcePlayers,
        seatNames
      );

    if (matchedByName) {
      return buildOccupiedSeat(
        sourceSlot,
        index,
        matchedByName
      );
    }

    // ID 與姓名都找不到，代表玩家已不在 car.players。
    // 清除幽靈席位。
    return buildEmptySeat(
      sourceSlot,
      index
    );
  }

  // ------------------------------------------------------------
  // 整理整份席位
  // ------------------------------------------------------------

  function upgradeSeats(
    slots,
    players
  ) {
    if (!Array.isArray(slots)) {
      return [];
    }

    const sourcePlayers =
      Array.isArray(players)
        ? players
        : [];

    return slots.map(
      function (
        slot,
        index
      ) {
        return normalizeSeat(
          slot,
          index,
          sourcePlayers
        );
      }
    );
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYUpgradeSeat = {
    normalizeText,

    getPlayerId,
    getPlayerNames,

    getSeatPlayerId,
    getSeatPlayerNames,

    findPlayerById,
    findUniquePlayerByName,

    getSeatId,
    getOriginalType,

    buildBaseSeat,
    buildEmptySeat,
    buildOccupiedSeat,

    normalizeSeat,
    upgradeSeats
  };

  console.log(
    "✅ Upgrade Seat 已載入"
  );
})();