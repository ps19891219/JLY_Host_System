console.log("seat-assignment.js 已成功載入！");

// ============================================================
// JLY Host System
// Seat Engine V2 - Assignment
//
// 負責：
// 1. 判斷玩家能否坐進指定分類
// 2. 一位玩家只能坐一個位置
// 3. 安排、離席、交換玩家
// 4. 同步時保留既有座位，不重新洗牌
// 5. 人數超過空位時停止自動安排
// 6. 未入座玩家保留在等候區
//
// 不負責：
// - Firestore 寫入
// - 畫面 Render
// - 整列拖曳排序
// ============================================================

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 取得 Seat Data
  // ------------------------------------------------------------

  function getSeatData() {
    if (!window.JLYSeatData) {
      throw new Error(
        "JLYSeatData 尚未載入，請先載入 seat-data.js"
      );
    }

    return window.JLYSeatData;
  }

  // ------------------------------------------------------------
  // 基礎工具
  // ------------------------------------------------------------

  function clonePlayerData(player, playerId) {
    const SeatData = getSeatData();

    return {
      id: playerId,
      name:
        SeatData.getPlayerName(player)
    };
  }

  function getSlotId(slot) {
    if (!slot) {
      return "";
    }

    return String(
      slot.slotId ||
      slot.id ||
      slot.order ||
      ""
    );
  }

  function getSlotById(
    slots,
    slotId
  ) {
    const targetId =
      String(slotId || "");

    const sourceSlots =
      Array.isArray(slots)
        ? slots
        : [];

    return (
      sourceSlots.find(
        function (slot) {
          return (
            String(slot.slotId || "") ===
              targetId ||
            String(slot.id || "") ===
              targetId ||
            String(slot.order || "") ===
              targetId
          );
        }
      ) ||
      null
    );
  }

  function getPlayerById(
    players,
    playerId
  ) {
    const SeatData = getSeatData();

    return SeatData.findPlayerById(
      players,
      playerId
    );
  }

  function findPlayerSeat(
    slots,
    playerId
  ) {
    const targetId =
      String(playerId || "");

    if (!targetId) {
      return null;
    }

    const sourceSlots =
      Array.isArray(slots)
        ? slots
        : [];

    return (
      sourceSlots.find(
        function (slot) {
          return (
            slot.playerId &&
            String(slot.playerId) ===
              targetId
          );
        }
      ) ||
      null
    );
  }

  // ------------------------------------------------------------
  // 分類規則
  // ------------------------------------------------------------

  function canPlayerUseSlot(
    player,
    slot
  ) {
    const SeatData = getSeatData();

    if (!player || !slot) {
      return false;
    }

    const playerPosition =
      SeatData.getPlayerPosition(
        player
      );

    const slotType =
      SeatData.normalizePosition(
        slot.originalType ||
        slot.type ||
        "flexible"
      );

    // 不限位可以安排任何玩家
    if (slotType === "flexible") {
      return true;
    }

    // 玩家選擇不限，可使用任何固定位置
    if (
      playerPosition ===
      "flexible"
    ) {
      return true;
    }

    // 固定位置必須同分類
    return (
      playerPosition ===
      slotType
    );
  }

  function getPlacementReason(
    player,
    slot
  ) {
    if (!player) {
      return "找不到玩家資料";
    }

    if (!slot) {
      return "找不到座位資料";
    }

    if (slot.playerId) {
      return "這個位置已經有人";
    }

    if (
      !canPlayerUseSlot(
        player,
        slot
      )
    ) {
      return "玩家的位置分類與座位不符合";
    }

    return "";
  }

  // ------------------------------------------------------------
  // 尋找合適空位
  // ------------------------------------------------------------

  function getCompatibleEmptySlots(
    player,
    slots
  ) {
    const SeatData = getSeatData();

    const sourceSlots =
      Array.isArray(slots)
        ? slots
        : [];

    const playerPosition =
      SeatData.getPlayerPosition(
        player
      );

    const compatibleSlots =
      sourceSlots.filter(
        function (slot) {
          return (
            !slot.playerId &&
            canPlayerUseSlot(
              player,
              slot
            )
          );
        }
      );

    // 玩家為不限時，維持畫面原始順序
    if (
      playerPosition ===
      "flexible"
    ) {
      return compatibleSlots.sort(
        function (a, b) {
          return (
            Number(a.order || 0) -
            Number(b.order || 0)
          );
        }
      );
    }

    // 固定位置玩家：
    // 先找同分類，再找不限位
    return compatibleSlots.sort(
      function (a, b) {
        const aType =
          SeatData.normalizePosition(
            a.originalType ||
            a.type
          );

        const bType =
          SeatData.normalizePosition(
            b.originalType ||
            b.type
          );

        const aPriority =
          aType === playerPosition
            ? 0
            : 1;

        const bPriority =
          bType === playerPosition
            ? 0
            : 1;

        if (
          aPriority !==
          bPriority
        ) {
          return (
            aPriority -
            bPriority
          );
        }

        return (
          Number(a.order || 0) -
          Number(b.order || 0)
        );
      }
    );
  }

  function findBestEmptySlot(
    player,
    slots
  ) {
    return (
      getCompatibleEmptySlots(
        player,
        slots
      )[0] ||
      null
    );
  }

  // ------------------------------------------------------------
  // 清空座位
  // ------------------------------------------------------------

  function clearSlot(slot) {
    const SeatData = getSeatData();

    const cleanSlot =
      SeatData.normalizeSlot(
        slot,
        Number(
          slot.order || 1
        ) - 1
      );

    cleanSlot.playerId = null;
    cleanSlot.player = null;
    cleanSlot.updatedAt =
      SeatData.nowTime();

    if (
      cleanSlot.originalType ===
      "flexible"
    ) {
      cleanSlot.type =
        "flexible";
    }

    return cleanSlot;
  }

  // ------------------------------------------------------------
  // 安排單一玩家
  // ------------------------------------------------------------

  function assignPlayerToSlot(
    players,
    slots,
    playerId,
    slotId
  ) {
    const SeatData = getSeatData();

    const sourcePlayers =
      Array.isArray(players)
        ? players
        : [];

    const nextSlots =
      SeatData.cloneSlots(slots);

    const targetPlayer =
      getPlayerById(
        sourcePlayers,
        playerId
      );

    if (!targetPlayer) {
      return {
        success: false,
        reason:
          "找不到這位玩家",
        slots: nextSlots
      };
    }

    const targetSlot =
      getSlotById(
        nextSlots,
        slotId
      );

    if (!targetSlot) {
      return {
        success: false,
        reason:
          "找不到指定座位",
        slots: nextSlots
      };
    }

    if (targetSlot.playerId) {
      return {
        success: false,
        reason:
          "這個位置已經有人",
        slots: nextSlots
      };
    }

    if (
      !canPlayerUseSlot(
        targetPlayer,
        targetSlot
      )
    ) {
      return {
        success: false,
        reason:
          "玩家的位置分類與座位不符合",
        slots: nextSlots
      };
    }

    const normalizedPlayerId =
      String(playerId);

    // 一人只能坐一席
    nextSlots.forEach(
      function (
        slot,
        index
      ) {
        if (
          slot.playerId &&
          String(slot.playerId) ===
            normalizedPlayerId
        ) {
          nextSlots[index] =
            clearSlot(slot);
        }
      }
    );

    targetSlot.playerId =
      normalizedPlayerId;

    targetSlot.player =
      clonePlayerData(
        targetPlayer,
        normalizedPlayerId
      );

    targetSlot.updatedAt =
      SeatData.nowTime();

    if (
      targetSlot.originalType ===
      "flexible"
    ) {
      targetSlot.type =
        SeatData.getPlayerPosition(
          targetPlayer
        );
    }

    return {
      success: true,
      reason: "",
      slots: nextSlots,
      slotId:
        getSlotId(targetSlot),
      playerId:
        normalizedPlayerId
    };
  }

  // ------------------------------------------------------------
  // 玩家離席
  // ------------------------------------------------------------

  function removePlayerFromSlots(
    slots,
    playerId
  ) {
    const SeatData = getSeatData();

    const targetId =
      String(playerId || "");

    let removed = false;

    const nextSlots =
      SeatData.cloneSlots(
        slots
      ).map(
        function (slot) {
          if (
            slot.playerId &&
            String(slot.playerId) ===
              targetId
          ) {
            removed = true;

            return clearSlot(
              slot
            );
          }

          return slot;
        }
      );

    return {
      success: removed,
      slots: nextSlots
    };
  }

  // ------------------------------------------------------------
  // 只移動玩家名字
  //
  // 拖到空位：
  // 玩家移動，原位清空。
  //
  // 拖到有人座位：
  // 只交換兩位玩家，角色與座位不動。
  // ------------------------------------------------------------

  function movePlayerBetweenSlots(
    players,
    slots,
    sourceSlotId,
    targetSlotId
  ) {
    const SeatData = getSeatData();

    const sourcePlayers =
      Array.isArray(players)
        ? players
        : [];

    const nextSlots =
      SeatData.cloneSlots(
        slots
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
          "找不到要移動的座位",
        slots: nextSlots
      };
    }

    if (!sourceSlot.playerId) {
      return {
        success: false,
        reason:
          "原本的位置沒有玩家",
        slots: nextSlots
      };
    }

    if (
      getSlotId(sourceSlot) ===
      getSlotId(targetSlot)
    ) {
      return {
        success: true,
        reason: "",
        slots: nextSlots
      };
    }

    const sourcePlayer =
      getPlayerById(
        sourcePlayers,
        sourceSlot.playerId
      );

    if (!sourcePlayer) {
      return {
        success: false,
        reason:
          "找不到原座位玩家資料",
        slots: nextSlots
      };
    }

    const targetPlayer =
      targetSlot.playerId
        ? getPlayerById(
            sourcePlayers,
            targetSlot.playerId
          )
        : null;

    // 原玩家必須能坐進目標座位
    if (
      !canPlayerUseSlot(
        sourcePlayer,
        targetSlot
      )
    ) {
      return {
        success: false,
        reason:
          "原玩家不能安排到目標分類",
        slots: nextSlots
      };
    }

    // 如果目標有人，對方也必須能坐回原位置
    if (
      targetPlayer &&
      !canPlayerUseSlot(
        targetPlayer,
        sourceSlot
      )
    ) {
      return {
        success: false,
        reason:
          "交換後另一位玩家不符合原座位分類",
        slots: nextSlots
      };
    }

    const sourcePlayerId =
      String(
        sourceSlot.playerId
      );

    const sourcePlayerData =
      sourceSlot.player
        ? {
            ...sourceSlot.player
          }
        : clonePlayerData(
            sourcePlayer,
            sourcePlayerId
          );

    const targetPlayerId =
      targetSlot.playerId
        ? String(
            targetSlot.playerId
          )
        : null;

    const targetPlayerData =
      targetSlot.player
        ? {
            ...targetSlot.player
          }
        : (
            targetPlayer
              ? clonePlayerData(
                  targetPlayer,
                  targetPlayerId
                )
              : null
          );

    // 目標位置放入原玩家
    targetSlot.playerId =
      sourcePlayerId;

    targetSlot.player =
      sourcePlayerData;

    targetSlot.updatedAt =
      SeatData.nowTime();

    if (
      targetSlot.originalType ===
      "flexible"
    ) {
      targetSlot.type =
        SeatData.getPlayerPosition(
          sourcePlayer
        );
    }

    // 原位置放入目標玩家，或變空位
    if (targetPlayerId) {
      sourceSlot.playerId =
        targetPlayerId;

      sourceSlot.player =
        targetPlayerData;

      sourceSlot.updatedAt =
        SeatData.nowTime();

      if (
        sourceSlot.originalType ===
        "flexible"
      ) {
        sourceSlot.type =
          SeatData.getPlayerPosition(
            targetPlayer
          );
      }
    } else {
      const clearedSource =
        clearSlot(
          sourceSlot
        );

      Object.assign(
        sourceSlot,
        clearedSource
      );
    }

    return {
      success: true,
      reason: "",
      slots: nextSlots
    };
  }

  // ------------------------------------------------------------
  // 同步玩家座位
  //
  // 核心規則：
  // 1. 保留目前已坐好的玩家。
  // 2. 清除已離開車團與重複座位。
  // 3. 新玩家只補合法空位。
  // 4. 不重新排序、不洗牌。
  // 5. 等候人數大於空位時，不擅自挑人。
  // ------------------------------------------------------------

  function syncPlayersToSeats(
    car,
    options
  ) {
    const SeatData = getSeatData();

    const settings = {
      autoAssign:
        true,

      stopWhenOverflow:
        true,

      ...(
        options || {}
      )
    };

    const sourceCar =
      car || {};

    const activePlayers =
      SeatData.getActivePlayers(
        sourceCar
      );

    const initialSlots =
      SeatData.buildSlots(
        sourceCar
      );

    const cleanupResult =
      SeatData.cleanSeatData(
        activePlayers,
        initialSlots
      );

    let nextSlots =
      SeatData.cloneSlots(
        cleanupResult.slots
      );

    let waitingPlayers =
      SeatData.getWaitingPlayers(
        activePlayers,
        nextSlots
      );

    const emptySlotCount =
      nextSlots.filter(
        function (slot) {
          return !slot.playerId;
        }
      ).length;

    const result = {
      slots: nextSlots,

      waitingPlayers:
        waitingPlayers,

      assignedPlayers: [],

      removedDuplicateCount:
        cleanupResult
          .removedDuplicateCount ||
        0,

      needsSelection:
        false,

      overflowCount:
        Math.max(
          waitingPlayers.length -
            emptySlotCount,
          0
        )
    };

    if (
      !settings.autoAssign ||
      waitingPlayers.length === 0
    ) {
      return result;
    }

    // 等候人數大於空位：
    // 不依陣列順序替主揪挑人
    if (
      settings.stopWhenOverflow &&
      waitingPlayers.length >
        emptySlotCount
    ) {
      result.needsSelection =
        true;

      return result;
    }

    const stillWaiting = [];

    waitingPlayers.forEach(
      function (waitingItem) {
        const player =
          waitingItem.player;

        const targetSlot =
          findBestEmptySlot(
            player,
            nextSlots
          );

        if (!targetSlot) {
          stillWaiting.push(
            {
              ...waitingItem,
              waitingReason:
                "沒有符合分類規則的空位"
            }
          );

          return;
        }

        const assignment =
          assignPlayerToSlot(
            activePlayers,
            nextSlots,
            waitingItem.playerId,
            getSlotId(
              targetSlot
            )
          );

        if (!assignment.success) {
          stillWaiting.push(
            {
              ...waitingItem,
              waitingReason:
                assignment.reason ||
                "無法安排座位"
            }
          );

          return;
        }

        nextSlots =
          assignment.slots;

        result.assignedPlayers.push(
          {
            player:
              waitingItem.player,

            playerId:
              waitingItem.playerId,

            slotId:
              assignment.slotId
          }
        );
      }
    );

    result.slots =
      nextSlots;

    result.waitingPlayers =
      SeatData.getWaitingPlayers(
        activePlayers,
        nextSlots
      ).map(
        function (waitingItem) {
          const matched =
            stillWaiting.find(
              function (item) {
                return (
                  item.playerId ===
                  waitingItem.playerId
                );
              }
            );

          return matched
            ? {
                ...waitingItem,
                waitingReason:
                  matched.waitingReason
              }
            : waitingItem;
        }
      );

    result.overflowCount =
      Math.max(
        result.waitingPlayers.length -
          nextSlots.filter(
            function (slot) {
              return !slot.playerId;
            }
          ).length,
        0
      );

    return result;
  }

  // ------------------------------------------------------------
  // 主揪選定玩家後，再同步選中的人
  //
  // 用於：
  // 人數高於空位時顯示名單，
  // 主揪勾選要入座的人。
  // ------------------------------------------------------------

  function assignSelectedWaitingPlayers(
    car,
    selectedPlayerIds
  ) {
    const SeatData = getSeatData();

    const sourceCar =
      car || {};

    const selectedIds =
      new Set(
        (
          Array.isArray(
            selectedPlayerIds
          )
            ? selectedPlayerIds
            : []
        ).map(String)
      );

    const activePlayers =
      SeatData.getActivePlayers(
        sourceCar
      );

    const cleanupResult =
      SeatData.cleanSeatData(
        activePlayers,
        SeatData.buildSlots(
          sourceCar
        )
      );

    let nextSlots =
      SeatData.cloneSlots(
        cleanupResult.slots
      );

    const waitingPlayers =
      SeatData.getWaitingPlayers(
        activePlayers,
        nextSlots
      );

    const assignedPlayers = [];
    const failedPlayers = [];

    waitingPlayers.forEach(
      function (waitingItem) {
        if (
          !selectedIds.has(
            waitingItem.playerId
          )
        ) {
          return;
        }

        const targetSlot =
          findBestEmptySlot(
            waitingItem.player,
            nextSlots
          );

        if (!targetSlot) {
          failedPlayers.push(
            {
              ...waitingItem,
              waitingReason:
                "沒有符合分類規則的空位"
            }
          );

          return;
        }

        const assignment =
          assignPlayerToSlot(
            activePlayers,
            nextSlots,
            waitingItem.playerId,
            getSlotId(
              targetSlot
            )
          );

        if (!assignment.success) {
          failedPlayers.push(
            {
              ...waitingItem,
              waitingReason:
                assignment.reason
            }
          );

          return;
        }

        nextSlots =
          assignment.slots;

        assignedPlayers.push(
          {
            player:
              waitingItem.player,

            playerId:
              waitingItem.playerId,

            slotId:
              assignment.slotId
          }
        );
      }
    );

    return {
      slots: nextSlots,

      assignedPlayers,

      failedPlayers,

      waitingPlayers:
        SeatData.getWaitingPlayers(
          activePlayers,
          nextSlots
        )
    };
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatAssignment = {
    getSlotId,
    getSlotById,
    getPlayerById,
    findPlayerSeat,

    canPlayerUseSlot,
    getPlacementReason,

    getCompatibleEmptySlots,
    findBestEmptySlot,

    clearSlot,

    assignPlayerToSlot,
    removePlayerFromSlots,
    movePlayerBetweenSlots,

    syncPlayersToSeats,
    assignSelectedWaitingPlayers
  };
})();