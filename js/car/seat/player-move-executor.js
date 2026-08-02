/*
====================================================

JLY Host System

Module：
Player Move Executor V2

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

  function normalizePosition(value) {
    const SeatData =
      getSeatData();

    return SeatData.normalizePosition(
      value
    );
  }

  function normalizeGender(value) {
    const text =
      String(value || "")
        .trim()
        .toLowerCase();

    if (
      text === "male" ||
      text === "男" ||
      text === "男性" ||
      text === "m"
    ) {
      return "male";
    }

    if (
      text === "female" ||
      text === "女" ||
      text === "女性" ||
      text === "f"
    ) {
      return "female";
    }

    return "";
  }

  function getPlayerGender(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return normalizeGender(
      source.gender ||
      source.playerGender ||
      source.sex
    );
  }

  function getPlayerPlayPosition(player) {
    const source =
      player &&
      typeof player === "object"
        ? player
        : {};

    return normalizePosition(
      source.playPosition ||
      source.position ||
      source.requestedPosition
    );
  }

  function getTargetPosition(
    slot,
    player
  ) {
    const source =
      slot &&
      typeof slot === "object"
        ? slot
        : {};

    const originalType =
      normalizePosition(
        source.originalType ||
        source.type
      );

    if (
      originalType === "male" ||
      originalType === "female"
    ) {
      return originalType;
    }

    const currentPlayerPosition =
      getPlayerPlayPosition(
        player

              );

    if (
      currentPlayerPosition === "male" ||
      currentPlayerPosition === "female"
    ) {
      return currentPlayerPosition;
    }

    const currentSlotType =
      normalizePosition(
        source.type
      );

    if (
      currentSlotType === "male" ||
      currentSlotType === "female"
    ) {
      return currentSlotType;
    }

    return "flexible";
  }

  function getPositionLabel(position) {
    const normalized =
      normalizePosition(position);

    if (normalized === "male") {
      return "男位";
    }

    if (normalized === "female") {
      return "女位";
    }

    return "不限";
  }

  function calculateCrossPlay(
    player,
    playPosition
  ) {
    const gender =
      getPlayerGender(player);

    const position =
      normalizePosition(
        playPosition
      );

    if (
      !gender ||
      (
        position !== "male" &&
        position !== "female"
      )
    ) {
      return false;
    }

    return gender !== position;
  }

  function syncPlayerForSlot(
    players,
    playerId,
    slot
  ) {
    const nextPlayers =
      cloneValue(
        Array.isArray(players)
          ? players
          : []
      );

    const targetId =
      normalizeId(playerId);

    const playerIndex =
      nextPlayers.findIndex(
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
      );

    if (playerIndex < 0) {
      return {
        success:
          false,

        reason:
          "找不到要同步的玩家",

        players:
          nextPlayers,

        player:
          null
      };
    }

    const currentPlayer =
      nextPlayers[playerIndex];

    const nextPosition =
      getTargetPosition(
        slot,
        currentPlayer
      );

    const isCrossPlay =
      calculateCrossPlay(
        currentPlayer,
        nextPosition
      );

    nextPlayers[playerIndex] = {
      ...currentPlayer,

      playPosition:
        nextPosition,

      position:
        getPositionLabel(
          nextPosition
        ),

      isCrossPlay,

      updatedAt:
        getSeatData().nowTime()
    };

    return {
      success:
        true,

      reason:
        "",

      players:
        nextPlayers,

      player:
        nextPlayers[playerIndex],

      playPosition:
        nextPosition,

      isCrossPlay
    };
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
    let nextPlayers =
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
        success: false,
        reason: "找不到玩家資料",
        players: nextPlayers,
        slots: nextSlots
      };
    }

    const targetSlot =
      getSlotById(
        nextSlots,
        targetSlotId
      );

    if (!targetSlot) {
      return {
        success: false,
        reason: "找不到目標席位",
        players: nextPlayers,
        slots: nextSlots
      };
    }

    if (targetSlot.playerId) {
      return {
        success: false,
        reason: "這個位置已經有人",
        players: nextPlayers,
        slots: nextSlots
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

    const syncResult =
      syncPlayerForSlot(
        nextPlayers,
        playerId,
        refreshedTarget
      );

    if (!syncResult.success) {
      return {
        success: false,
        reason: syncResult.reason,
        players: nextPlayers,
        slots: nextSlots
      };
    }

    nextPlayers =
      syncResult.players;

    refreshedTarget.playerId =
      normalizeId(playerId);

    refreshedTarget.player =
      createPlayerSnapshot(
        syncResult.player,
        playerId
      );

    refreshedTarget.updatedAt =
      getSeatData().nowTime();

    applyFlexibleType(
      refreshedTarget,
      syncResult.player
    );

    return {
      success: true,
      reason: "",
      action: "waiting-to-seat-host",
      playerId: normalizeId(playerId),
      targetSlotId: normalizeId(targetSlotId),
      playPosition:
        syncResult.playPosition,
      isCrossPlay:
        syncResult.isCrossPlay,
      players: nextPlayers,
      slots: nextSlots
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
    let nextPlayers =
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
        success: false,
        reason:
          "找不到來源或目標席位",
        players: nextPlayers,
        slots: nextSlots
      };
    }

    if (!sourceSlot.playerId) {
      return {
        success: false,
        reason:
          "來源席位沒有玩家",
        players: nextPlayers,
        slots: nextSlots
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
        success: false,
        reason:
          "找不到來源玩家資料",
        players: nextPlayers,
        slots: nextSlots
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

    const sourceSync =
      syncPlayerForSlot(
        nextPlayers,
        sourcePlayerId,
        targetSlot
      );

    if (!sourceSync.success) {
      return {
        success: false,
        reason: sourceSync.reason,
        players: nextPlayers,
        slots: nextSlots
      };
    }

    nextPlayers =
      sourceSync.players;

    let targetSync =
      null;

    if (targetPlayerId) {
      targetSync =
        syncPlayerForSlot(
          nextPlayers,
          targetPlayerId,
          sourceSlot
        );

      if (!targetSync.success) {
        return {
          success: false,
          reason: targetSync.reason,
          players: nextPlayers,
          slots: nextSlots
        };
      }

      nextPlayers =
        targetSync.players;
    }

        const syncedSourcePlayer =
      getPlayerById(
        nextPlayers,
        sourcePlayerId
      );

    targetSlot.playerId =
      sourcePlayerId;

    targetSlot.player =
      createPlayerSnapshot(
        syncedSourcePlayer,
        sourcePlayerId
      );

    targetSlot.updatedAt =
      getSeatData().nowTime();

    applyFlexibleType(
      targetSlot,
      syncedSourcePlayer
    );

    if (targetPlayerId) {
      const syncedTargetPlayer =
        getPlayerById(
          nextPlayers,
          targetPlayerId
        );

      sourceSlot.playerId =
        targetPlayerId;

      sourceSlot.player =
        createPlayerSnapshot(
          syncedTargetPlayer,
          targetPlayerId
        );

      sourceSlot.updatedAt =
        getSeatData().nowTime();

      applyFlexibleType(
        sourceSlot,
        syncedTargetPlayer
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
      success: true,
      reason: "",
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
      playPosition:
        sourceSync.playPosition,
      isCrossPlay:
        sourceSync.isCrossPlay,
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

    normalizePosition,

    normalizeGender,

    getPlayerGender,

    getPlayerPlayPosition,

    getTargetPosition,

    getPositionLabel,

    calculateCrossPlay,

    syncPlayerForSlot,

    createPlayerSnapshot,

    clearSlot,

    applyFlexibleType,

    removePlayerEverywhere,

    assignWaitingPlayer,

    movePlayerBetweenSeats,

    movePlayerToWaiting
  };

  console.log(
    "✅ Player Move Executor V2 已載入"
  );
})();