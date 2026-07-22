console.log("seat-data.js 已成功載入！");

// ============================================================
// JLY Host System
// Seat Engine V2 - Data
//
// 負責：
// 1. 統一玩家與席位資料格式
// 2. 建立席位
// 3. 複製席位資料
// 4. 找出已入座與等待安排的玩家
// 5. 清除一人多席與幽靈座位
//
// 不負責：
// - Firestore 寫入
// - 畫面 Render
// - 拖曳
// - 自動安排規則
// ============================================================

(function () {
  "use strict";

  function nowTime() {
    return new Date().toISOString();
  }

  // ------------------------------------------------------------
  // 基礎正規化
  // ------------------------------------------------------------

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizePosition(value) {
    const position = normalizeText(value).toLowerCase();

    if (
      position === "male" ||
      position === "男位" ||
      position === "男"
    ) {
      return "male";
    }

    if (
      position === "female" ||
      position === "女位" ||
      position === "女"
    ) {
      return "female";
    }

    return "flexible";
  }

  function getPlayerId(player, fallbackIndex) {
    const sourcePlayer = player || {};

    const rawId =
      sourcePlayer.playerId ||
      sourcePlayer.id ||
      sourcePlayer.profileId ||
      sourcePlayer.applicationId ||
      "";

    if (rawId) {
      return String(rawId);
    }

    if (
      typeof fallbackIndex === "number"
    ) {
      return (
        "legacy-player-" +
        String(fallbackIndex + 1)
      );
    }

    return "";
  }

  function getPlayerName(player) {
    const sourcePlayer = player || {};

    return (
      sourcePlayer.hostAlias ||
      sourcePlayer.name ||
      sourcePlayer.displayName ||
      sourcePlayer.playerName ||
      "未命名玩家"
    );
  }

  function getPlayerPosition(player) {
    const sourcePlayer = player || {};

    return normalizePosition(
      sourcePlayer.position ||
      sourcePlayer.role ||
      sourcePlayer.defaultPosition ||
      "不限"
    );
  }

  function isPlayerActive(player) {
    return Boolean(
      player &&
      player.status !== "已取消"
    );
  }

  function getActivePlayers(car) {
    const players =
      car &&
      Array.isArray(car.players)
        ? car.players
        : [];

    return players.filter(
      isPlayerActive
    );
  }

  // ------------------------------------------------------------
  // 席位建立與正規化
  // ------------------------------------------------------------

  function createSlot(
    order,
    originalType
  ) {
    const normalizedOrder =
      Number(order || 0);

    const normalizedType =
      normalizePosition(originalType);

    const slotId =
      "slot-" + normalizedOrder;

    return {
      id: slotId,
      slotId,
      order: normalizedOrder,

      originalType:
        normalizedType,

      type:
        normalizedType,

      roleName: "",
      seatLabel:
        String(normalizedOrder),

      playerId: null,
      player: null,

      createdAt:
        nowTime(),

      updatedAt:
        nowTime()
    };
  }

  function normalizeSlot(
    slot,
    index
  ) {
    const sourceSlot = slot || {};

    const order =
      Number(
        sourceSlot.order ||
        index + 1
      );

    const slotId =
      String(
        sourceSlot.slotId ||
        sourceSlot.id ||
        "slot-" + order
      );

    const originalType =
      normalizePosition(
        sourceSlot.originalType ||
        sourceSlot.type ||
        "flexible"
      );

    const currentType =
      normalizePosition(
        sourceSlot.type ||
        originalType
      );

    const playerId =
      sourceSlot.playerId
        ? String(sourceSlot.playerId)
        : null;

    return {
      ...sourceSlot,

      id: slotId,
      slotId,
      order,

      originalType,
      type: currentType,

      roleName:
        sourceSlot.roleName ||
        sourceSlot.characterName ||
        "",

      seatLabel:
        sourceSlot.seatLabel ||
        String(order),

      playerId,

      player:
        playerId
          ? (
              sourceSlot.player
                ? {
                    ...sourceSlot.player,
                    id:
                      sourceSlot.player.id ||
                      playerId
                  }
                : {
                    id: playerId,
                    name: ""
                  }
            )
          : null,

      createdAt:
        sourceSlot.createdAt ||
        nowTime(),

      updatedAt:
        sourceSlot.updatedAt ||
        nowTime()
    };
  }

  function cloneSlots(slots) {
    const sourceSlots =
      Array.isArray(slots)
        ? slots
        : [];

    return sourceSlots.map(
      function (slot, index) {
        return normalizeSlot(
          {
            ...slot,
            player:
              slot &&
              slot.player
                ? {
                    ...slot.player
                  }
                : null
          },
          index
        );
      }
    );
  }

  function buildSlots(car) {
    const sourceCar = car || {};

    if (
      Array.isArray(sourceCar.slots) &&
      sourceCar.slots.length > 0
    ) {
      return cloneSlots(
        sourceCar.slots
      );
    }

    const maleSlots =
      Math.max(
        0,
        Number(
          sourceCar.maleSlots || 0
        )
      );

    const femaleSlots =
      Math.max(
        0,
        Number(
          sourceCar.femaleSlots || 0
        )
      );

    let flexibleSlots =
      Math.max(
        0,
        Number(
          sourceCar.flexibleSlots ||
          sourceCar.flexSlots ||
          0
        )
      );

    const totalPeople =
      Math.max(
        0,
        Number(
          sourceCar.totalPeople ||
          sourceCar.capacity ||
          0
        )
      );

    const configuredTotal =
      maleSlots +
      femaleSlots +
      flexibleSlots;

    if (
      totalPeople >
      configuredTotal
    ) {
      flexibleSlots +=
        totalPeople -
        configuredTotal;
    }

    const slots = [];
    let order = 1;

    function appendSlots(
      count,
      type
    ) {
      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        slots.push(
          createSlot(
            order,
            type
          )
        );

        order += 1;
      }
    }

    appendSlots(
      maleSlots,
      "male"
    );

    appendSlots(
      femaleSlots,
      "female"
    );

    appendSlots(
      flexibleSlots,
      "flexible"
    );

    return slots;
  }

  // ------------------------------------------------------------
  // 玩家與席位對照
  // ------------------------------------------------------------

  function getOccupiedPlayerIds(slots) {
    const occupiedIds =
      new Set();

    cloneSlots(slots).forEach(
      function (slot) {
        if (slot.playerId) {
          occupiedIds.add(
            String(slot.playerId)
          );
        }
      }
    );

    return occupiedIds;
  }

  function findPlayerById(
    players,
    playerId
  ) {
    const targetId =
      String(playerId || "");

    if (!targetId) {
      return null;
    }

    const sourcePlayers =
      Array.isArray(players)
        ? players
        : [];

    return (
      sourcePlayers.find(
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

  function getWaitingPlayers(
    players,
    slots
  ) {
    const sourcePlayers =
      Array.isArray(players)
        ? players
        : [];

    const occupiedIds =
      getOccupiedPlayerIds(slots);

    return sourcePlayers
      .map(
        function (
          player,
          index
        ) {
          return {
            player,
            playerId:
              getPlayerId(
                player,
                index
              ),
            playerIndex:
              index
          };
        }
      )
      .filter(
        function (item) {
          return (
            isPlayerActive(
              item.player
            ) &&
            item.playerId &&
            !occupiedIds.has(
              item.playerId
            )
          );
        }
      );
  }

  // ------------------------------------------------------------
  // 資料清理
  // ------------------------------------------------------------

  function clearSlotPlayer(slot) {
    const cleanSlot =
      normalizeSlot(
        slot,
        Number(slot.order || 1) - 1
      );

    cleanSlot.playerId = null;
    cleanSlot.player = null;
    cleanSlot.updatedAt =
      nowTime();

    if (
      cleanSlot.originalType ===
      "flexible"
    ) {
      cleanSlot.type =
        "flexible";
    }

    return cleanSlot;
  }

  function cleanSeatData(
    players,
    slots
  ) {
    const sourcePlayers =
      Array.isArray(players)
        ? players
        : [];

    const validPlayerIds =
      new Set();

    sourcePlayers.forEach(
      function (
        player,
        index
      ) {
        if (
          !isPlayerActive(player)
        ) {
          return;
        }

        const playerId =
          getPlayerId(
            player,
            index
          );

        if (playerId) {
          validPlayerIds.add(
            playerId
          );
        }
      }
    );

    const alreadySeatedIds =
      new Set();

    const cleanedSlots =
      cloneSlots(slots).map(
        function (slot) {
          if (!slot.playerId) {
            return slot;
          }

          const playerId =
            String(
              slot.playerId
            );

          // 玩家已不在車團
          if (
            !validPlayerIds.has(
              playerId
            )
          ) {
            return clearSlotPlayer(
              slot
            );
          }

          // 同一玩家重複出現在多個席位
          if (
            alreadySeatedIds.has(
              playerId
            )
          ) {
            return clearSlotPlayer(
              slot
            );
          }

          alreadySeatedIds.add(
            playerId
          );

          return slot;
        }
      );

    return {
      slots: cleanedSlots,

      removedDuplicateCount:
        cloneSlots(slots).filter(
          function (slot) {
            return (
              slot.playerId &&
              !cleanedSlots.find(
                function (
                  cleanedSlot
                ) {
                  return (
                    cleanedSlot.slotId ===
                      slot.slotId &&
                    cleanedSlot.playerId ===
                      slot.playerId
                  );
                }
              )
            );
          }
        ).length,

      waitingPlayers:
        getWaitingPlayers(
          sourcePlayers,
          cleanedSlots
        )
    };
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatData = {
    nowTime,

    normalizeText,
    normalizePosition,

    getPlayerId,
    getPlayerName,
    getPlayerPosition,
    isPlayerActive,
    getActivePlayers,

    createSlot,
    normalizeSlot,
    cloneSlots,
    buildSlots,

    getOccupiedPlayerIds,
    findPlayerById,
    getWaitingPlayers,

    clearSlotPlayer,
    cleanSeatData
  };
})();