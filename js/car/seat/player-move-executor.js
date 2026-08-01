/*
====================================================

JLY Host System

Module：
Player Move Executor V1

用途：
1. 執行主揪已確認的玩家移動
2. 支援等待安排 → 席位
3. 支援席位 → 空位
4. 支援兩位玩家交換
5. 支援席位 → 等待安排
6. 不受自動排位的嚴格分類限制

規則：
- 只有確認流程可以呼叫
- 不直接寫入 Firestore
- 不直接操作 DOM
- 不影響自動排位
- 一位玩家只能佔一個席位

依賴：
- window.JLYSeatData
- window.JLYSeatAssignment

====================================================
*/

console.log(
  "player-move-executor.js 已成功載入！"
);

(function () {
  "use strict";

  function getSeatData() {
    if (!window.JLYSeatData) {
      throw new Error(
        "JLYSeatData 尚未載入"
      );
    }

    return window.JLYSeatData;
  }

  function getSeatAssignment() {
    if (!window.JLYSeatAssignment) {
      throw new Error(
        "JLYSeatAssignment 尚未載入"
      );
    }

    return window.JLYSeatAssignment;
  }

  function cloneValue(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function normalizeId(value) {
    return String(
      value || ""
    ).trim();
  }

  function getPlayerId(
    player,
    index
  ) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return normalizeId(
      source.playerId ||
      source.id ||
      source.profileId ||
      source.applicationId ||
      (
        Number.isInteger(index)
          ? `legacy-player-${index + 1}`
          : ""
      )
    );
  }

  function getPlayerById(
    players,
    playerId
  ) {
    const targetId =
      normalizeId(playerId);

    return (
      (
        Array.isArray(players)
          ? players
          : []
      ).find(
        function (
          player,
          index
        ) {
          return (
            getPlayerId(
              player,
              index
            ) === targetId
          );
        }
      ) ||
      null
    );
  }

  function getPlayerName(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return String(
      source.hostAlias ||
      source.displayName ||
      source.playerName ||
      source.name ||
      source.nickname ||
      "未命名玩家"
    );
  }

  function getSlotById(
    slots,
    slotId
  ) {
    return getSeatAssignment()
      .getSlotById(
        slots,
        slotId
      );
  }

  function getSlotId(slot) {
    return getSeatAssignment()
      .getSlotId(
        slot
      );
  }

  function createPlayerSnapshot(
    player,
    playerId
  ) {
    return {
      ...cloneValue(
        player || {}
      ),

      id:
        normalizeId(playerId),

      playerId:
        normalizeId(playerId),

      name:
        getPlayerName(player),

      displayName:
        getPlayerName(player)
    };
  }

  function clearSlot(slot) {
    const SeatData =
      getSeatData();

    const cleanSlot = {
      ...cloneValue(slot),

      playerId:
        null,

      player:
        null,

      updatedAt:
        SeatData.nowTime()
    };

    if (
      cleanSlot.originalType ===
        "flexible"
    ) {
      cleanSlot.type =
        "flexible";
    }

    return cleanSlot;
  }

  function applyFlexibleType(
    slot,
    player
  ) {
    if (
      !slot ||
      slot.originalType !==
        "flexible"
    ) {
      return;
    }

    slot.type =
      getSeatData()
        .getPlayerPosition(
          player || {}
        );
  }

  function removePlayerEverywhere(
    slots,
    playerId,
    exceptSlotId
  ) {
    const targetPlayerId =
      normalizeId(playerId);

    const ignoredSlotId =
      normalizeId(exceptSlotId);

    return (
      Array.isArray(slots)
        ? slots
        : []
    ).map(
      function (slot) {
        const currentSlotId =
          getSlotId(slot);

        if (
          currentSlotId ===
            ignoredSlotId
        ) {
          return slot;
        }

        if (
          normalizeId(
            slot.playerId
          ) === targetPlayerId
        ) {
          return clearSlot(slot);
        }

        return slot;
      }
    );
  }

  // ------------------------------------------------------------
  // 等待安排 → 指定席位
  // ------------------------------------------------------------

  function assignWaitingPlayer(
    players,
    slots,
    playerId,
    targetSlotId
  ) {
    const nextPlayers =
      cloneValue(
        Array.isArray(players)
          ? players
          : []
      );

    let nextSlots =
      cloneValue(
        Array.isArray(slots)
          ? slots
          : []
      );

    const player =
      getPlayerById(
        nextPlayers,
        playerId
      );

    if (!player) {
      return {
        success:
          false,

        reason:
          "找不到玩家資料",

        players:
          nextPlayers,

        slots:
          nextSlots
      };
    }

    const targetSlot =
      getSlotById(
        nextSlots,
        targetSlotId
      );

    if (!targetSlot) {
      return {
        success:
          false,

        reason:
          "找不到目標席位",

        players:
          nextPlayers,

        slots:
          nextSlots
      };
    }

    if (targetSlot.playerId) {
      return {
        success:
          false,

        reason:
          "這個位置已經有人",

        players:
          nextPlayers,

        slots:
          nextSlots
      };
    }

    nextSlots =
      removePlayerEverywhere(
        nextSlots,
        playerId,
        targetSlotId
      );

    const refreshedTarget =
      getSlotById(
        nextSlots,
        targetSlotId
      );

    refreshedTarget.playerId =
      normalizeId(playerId);

    refreshedTarget.player =
      createPlayerSnapshot(
        player,
        playerId
      );

    refreshedTarget.updatedAt =
      getSeatData().nowTime();

    applyFlexibleType(
      refreshedTarget,
      player
    );

    return {
      success:
        true,

      reason:
        "",

      action:
        "waiting-to-seat-host",

      playerId:
        normalizeId(playerId),

      targetSlotId:
        normalizeId(targetSlotId),

      players:
        nextPlayers,

      slots:
        nextSlots
    };
  }

  // ------------------------------------------------------------
  // 席位 → 席位
  // 空位時移動，有人時交換
  // ------------------------------------------------------------

  function movePlayerBetweenSeats(
    players,
    slots,
    sourceSlotId,
    targetSlotId
  ) {
    const nextPlayers =
      cloneValue(
        Array.isArray(players)
          ? players
          : []
      );

    const nextSlots =
      cloneValue(
        Array.isArray(slots)
          ? slots
          : []
      );

    const sourceSlot =
      getSlotById(
        nextSlots,
        sourceSlotId
      );

    const targetSlot =
      getSlotById(
        nextSlots,
        targetSlotId
      );

    if (
      !sourceSlot ||
      !targetSlot
    ) {
      return {
        success:
          false,

        reason:
          "找不到來源或目標席位",

        players:
          nextPlayers,

        slots:
          nextSlots
      };
    }

    if (!sourceSlot.playerId) {
      return {
        success:
          false,

        reason:
          "來源席位沒有玩家",

        players:
          nextPlayers,

        slots:
          nextSlots
      };
    }

    const sourcePlayerId =
      normalizeId(
        sourceSlot.playerId
      );

    const sourcePlayer =
      getPlayerById(
        nextPlayers,
        sourcePlayerId
      );

    if (!sourcePlayer) {
      return {
        success:
          false,

        reason:
          "找不到來源玩家資料",

        players:
          nextPlayers,

        slots:
          nextSlots
      };
    }

    const targetPlayerId =
      normalizeId(
        targetSlot.playerId
      );

    const targetPlayer =
      targetPlayerId
        ? getPlayerById(
            nextPlayers,
            targetPlayerId
          )
        : null;

    const sourceSnapshot =
      createPlayerSnapshot(
        sourcePlayer,
        sourcePlayerId
      );

    const targetSnapshot =
      targetPlayer
        ? createPlayerSnapshot(
            targetPlayer,
            targetPlayerId
          )
        : null;

    targetSlot.playerId =
      sourcePlayerId;

    targetSlot.player =
      sourceSnapshot;

    targetSlot.updatedAt =
      getSeatData().nowTime();

    applyFlexibleType(
      targetSlot,
      sourcePlayer
    );

    if (targetPlayerId) {
      sourceSlot.playerId =
        targetPlayerId;

      sourceSlot.player =
        targetSnapshot;

      sourceSlot.updatedAt =
        getSeatData().nowTime();

      applyFlexibleType(
        sourceSlot,
        targetPlayer
      );
    } else {
      Object.assign(
        sourceSlot,
        clearSlot(
          sourceSlot
        )
      );
    }

    return {
      success:
        true,

      reason:
        "",

      action:
        targetPlayerId
          ? "swap-players-host"
          : "seat-to-seat-host",

      playerId:
        sourcePlayerId,

      sourceSlotId:
        normalizeId(
          sourceSlotId
        ),

      targetSlotId:
        normalizeId(
          targetSlotId
        ),

      swappedPlayerId:
        targetPlayerId,

      players:
        nextPlayers,

      slots:
        nextSlots
    };
  }

  // ------------------------------------------------------------
  // 席位 → 等待安排
  // ------------------------------------------------------------

  function movePlayerToWaiting(
    players,
    slots,
    playerId
  ) {
    const nextPlayers =
      cloneValue(
        Array.isArray(players)
          ? players
          : []
      );

    const beforeSlots =
      cloneValue(
        Array.isArray(slots)
          ? slots
          : []
      );

    const nextSlots =
      removePlayerEverywhere(
        beforeSlots,
        playerId,
        ""
      );

    const changed =
      JSON.stringify(
        beforeSlots
      ) !==
      JSON.stringify(
        nextSlots
      );

    return {
      success:
        changed,

      reason:
        changed
          ? ""
          : "這位玩家目前沒有座位",

      action:
        "seat-to-waiting-host",

      playerId:
        normalizeId(playerId),

      players:
        nextPlayers,

      slots:
        nextSlots
    };
  }

  window.JLYPlayerMoveExecutor = {
    getPlayerId,

    getPlayerById,

    getPlayerName,

    createPlayerSnapshot,

    clearSlot,

    applyFlexibleType,

    removePlayerEverywhere,

    assignWaitingPlayer,

    movePlayerBetweenSeats,

    movePlayerToWaiting
  };

  console.log(
    "✅ Player Move Executor V1 已載入"
  );
})();