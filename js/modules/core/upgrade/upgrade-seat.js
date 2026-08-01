console.log(
  "upgrade-seat.js 已成功載入！"
);

// ============================================================
// JLY Host System V2
// Seat Data Upgrade
//
// 負責：
// 1. 將舊席位整理為 Seat Engine V2 格式
// 2. 優先使用固定 playerId 對應玩家
// 3. 舊 playerId 失效時，以姓名安全修復關聯
// 4. 找不到任何對應玩家時，清除幽靈席位
//
// 不負責：
// - 修改 car.players
// - 寫入 Firestore
// - 畫面 Render
// - 安排或拖曳玩家
// ============================================================

(function () {
  "use strict";

  function normalizeText(value) {
    return String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function getPlayerId(player) {
    if (!player) {
      return "";
    }

    return String(
      player.playerId ||
      player.id ||
      ""
    ).trim();
  }

  function getPlayerNames(player) {
    if (!player) {
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

  function getSeatPlayerNames(seat) {
    if (!seat) {
      return [];
    }

    const seatPlayer =
      seat.player || {};

    const names = [
      seat.hostAlias,
      seat.displayName,
      seat.playerName,
      seat.name,

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

  function findPlayerById(
    players,
    playerId
  ) {
    const normalizedPlayerId =
      String(playerId || "").trim();

    if (!normalizedPlayerId) {
      return null;
    }

    return (
      players.find(function (player) {
        return (
          getPlayerId(player) ===
          normalizedPlayerId
        );
      }) ||
      null
    );
  }

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
      players.filter(function (player) {
        const playerNames =
          getPlayerNames(player);

        return seatNames.some(
          function (seatName) {
            return playerNames.includes(
              seatName
            );
          }
        );
      });

    // 同名玩家超過一位時，不自動猜測。
    if (matches.length !== 1) {
      return null;
    }

    return matches[0];
  }

  function buildBaseSeat(
    seat,
    index
  ) {
    const fallbackSeatId =
      `slot-${index + 1}`;

    const seatId =
      seat.seatId ||
      seat.slotId ||
      seat.id ||
      fallbackSeatId;

    const originalType =
      seat.originalType ||
      seat.type ||
      "flexible";

    return {
      ...seat,

      seatId,
      slotId:
        seat.slotId ||
        seatId,

      id:
        seat.id ||
        seatId,

      type:
        seat.type ||
        originalType,

      originalType,

      order:
        typeof seat.order ===
        "number"
          ? seat.order
          : index + 1,

      updatedAt:
        seat.updatedAt ||
        null
    };
  }

  function buildEmptySeat(
    seat,
    index
  ) {
    const baseSeat =
      buildBaseSeat(
        seat,
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

  function buildOccupiedSeat(
    seat,
    index,
    matchedPlayer
  ) {
    const baseSeat =
      buildBaseSeat(
        seat,
        index
      );

    return {
      ...baseSeat,

      playerId:
        getPlayerId(
          matchedPlayer
        ),

      player: {
        ...matchedPlayer
      }
    };
  }

  function normalizeSeat(
    slot,
    index,
    players = []
  ) {
    const seat =
      slot &&
      typeof slot === "object"
        ? slot
        : {};

    const sourcePlayers =
      Array.isArray(players)
        ? players.filter(Boolean)
        : [];

    const seatPlayerId =
      String(
        seat.playerId ||
        (
          seat.player &&
          (
            seat.player.playerId ||
            seat.player.id
          )
        ) ||
        ""
      ).trim();

    // 空席位本來就不需要尋找玩家。
    if (
      !seatPlayerId &&
      !seat.player
    ) {
      return buildEmptySeat(
        seat,
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
        seat,
        index,
        matchedById
      );
    }

    // 第二順位：舊資料中的姓名。
    const seatNames =
      getSeatPlayerNames(
        seat
      );

    const matchedByName =
      findUniquePlayerByName(
        sourcePlayers,
        seatNames
      );

    if (matchedByName) {
      return buildOccupiedSeat(
        seat,
        index,
        matchedByName
      );
    }

    // ID 與姓名皆無法確認，判定為幽靈席位。
    return buildEmptySeat(
      seat,
      index
    );
  }

  function upgradeSeats(
    slots,
    players = []
  ) {
    if (!Array.isArray(slots)) {
      return [];
    }

    return slots.map(
      function (
        slot,
        index
      ) {
        return normalizeSeat(
          slot,
          index,
          players
        );
      }
    );
  }

  window.JLYUpgradeSeat = {
    normalizeText,
    getPlayerId,
    getPlayerNames,
    getSeatPlayerNames,

    findPlayerById,
    findUniquePlayerByName,

    normalizeSeat,
    upgradeSeats
  };

  console.log(
    "✅ Upgrade Seat 已載入"
  );
})();