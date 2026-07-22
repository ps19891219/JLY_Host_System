console.log("seat.js Seat Engine V2 相容層已成功載入！");

// ============================================================
// JLY Host System
// Seat Engine V2 - Compatibility Bridge
//
// 目前責任：
// 1. 保留舊版全域函式，避免其他頁面立即失效
// 2. 優先使用新的 Seat Engine 模組
// 3. 新模組尚未載入時，提供安全的相容流程
// 4. Firestore 只留在同步流程中
//
// 後續方向：
// - cardetail.js 不再直接修改 slot.playerId
// - editcar.js 不再直接重建玩家席位
// - 所有席位操作統一經過 Seat Assignment
// ============================================================

(function () {
  "use strict";

  // ============================================================
  // 基本工具
  // ============================================================

  function seatNowTime() {
    return new Date().toISOString();
  }

  function cloneValue(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function normalizeSeatType(value) {
    const text =
      String(value || "")
        .trim()
        .toLowerCase();

    if (
      text === "male" ||
      text === "男" ||
      text === "男位"
    ) {
      return "male";
    }

    if (
      text === "female" ||
      text === "女" ||
      text === "女位"
    ) {
      return "female";
    }

    return "flexible";
  }

  function isCancelledPlayer(player) {
    const status =
      String(
        player && player.status
          ? player.status
          : ""
      ).trim();

    return (
      status === "已取消" ||
      status === "取消" ||
      status === "cancelled" ||
      status === "canceled"
    );
  }

  function getStablePlayerId(
    player,
    index
  ) {
    return String(
      (
        player &&
        (
          player.playerId ||
          player.id ||
          player.profileId ||
          player.applicationId
        )
      ) ||
      `legacy-player-${Number(index || 0) + 1}`
    );
  }

  function getPlayerDisplayName(player) {
    return String(
      (
        player &&
        (
          player.hostAlias ||
          player.name ||
          player.displayName ||
          player.playerName ||
          player.nickname
        )
      ) ||
      "未命名玩家"
    );
  }

  function getPlayerSeatType(player) {
    return normalizeSeatType(
      player &&
      (
        player.position ||
        player.role ||
        player.defaultPosition
      )
    );
  }

  function getSlotIdentity(slot, index) {
    return String(
      (
        slot &&
        (
          slot.slotId ||
          slot.id
        )
      ) ||
      `slot-${Number(index || 0) + 1}`
    );
  }

  function normalizeSlot(
    slot,
    index
  ) {
    const sourceSlot =
      slot || {};

    const slotId =
      getSlotIdentity(
        sourceSlot,
        index
      );

    const originalType =
      normalizeSeatType(
        sourceSlot.originalType ||
        sourceSlot.type
      );

    const currentType =
      sourceSlot.playerId
        ? normalizeSeatType(
            sourceSlot.type ||
            originalType
          )
        : originalType;

    return {
      ...sourceSlot,

      id:
        String(
          sourceSlot.id ||
          slotId
        ),

      slotId,

      order:
        Number(
          sourceSlot.order ||
          index + 1
        ),

      originalType,

      type:
        currentType,

      playerId:
        sourceSlot.playerId
          ? String(
              sourceSlot.playerId
            )
          : null,

      player:
        sourceSlot.player ||
        null,

      createdAt:
        sourceSlot.createdAt ||
        seatNowTime(),

      updatedAt:
        sourceSlot.updatedAt ||
        seatNowTime()
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
          cloneValue(slot),
          index
        );
      }
    );
  }

  // ============================================================
  // 建立席位
  // ============================================================

  function buildSlotsFallback(car) {
    const sourceCar =
      car || {};

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

    function addSlots(
      count,
      type
    ) {
      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        const slotId =
          `slot-${order}`;

        slots.push({
          id:
            slotId,

          slotId,

          order,

          originalType:
            type,

          type,

          playerId:
            null,

          player:
            null,

          createdAt:
            seatNowTime(),

          updatedAt:
            seatNowTime()
        });

        order += 1;
      }
    }

    addSlots(
      maleSlots,
      "male"
    );

    addSlots(
      femaleSlots,
      "female"
    );

    addSlots(
      flexibleSlots,
      "flexible"
    );

    return slots;
  }

  function buildSlots(car) {
    const SeatData =
      window.JLYSeatData;

    if (
      SeatData &&
      typeof SeatData.buildSlots ===
        "function"
    ) {
      try {
        return cloneSlots(
          SeatData.buildSlots(
            car || {}
          )
        );
      } catch (error) {
        console.warn(
          "JLYSeatData.buildSlots 執行失敗，改用相容流程：",
          error
        );
      }
    }

    return buildSlotsFallback(
      car
    );
  }

  // ============================================================
  // 舊版相容 API
  // ============================================================

  function getSlots(car) {
    if (!car) {
      return [];
    }

    if (
      !Array.isArray(car.slots) ||
      car.slots.length === 0
    ) {
      car.slots =
        buildSlots(car);
    } else {
      car.slots =
        cloneSlots(car.slots);
    }

    return car.slots;
  }

  function getSlotById(
    car,
    slotId
  ) {
    const targetId =
      String(slotId || "");

    return (
      getSlots(car).find(
        function (slot) {
          return (
            String(
              slot.slotId || ""
            ) === targetId ||
            String(
              slot.id || ""
            ) === targetId ||
            String(
              slot.order || ""
            ) === targetId
          );
        }
      ) ||
      null
    );
  }

  function getEmptySeatCount(car) {
    return getSlots(car)
      .filter(
        function (slot) {
          return !slot.playerId;
        }
      )
      .length;
  }

  function getOccupiedSeatCount(car) {
    return getSlots(car)
      .filter(
        function (slot) {
          return Boolean(
            slot.playerId
          );
        }
      )
      .length;
  }

  // ============================================================
  // 相容版安排玩家
  // ============================================================

  function assignPlayerFallback(
    slots,
    slotId,
    playerId,
    selectedType,
    playerData
  ) {
    const nextSlots =
      cloneSlots(slots);

    const normalizedPlayerId =
      String(playerId || "");

    const targetId =
      String(slotId || "");

    if (!normalizedPlayerId) {
      return {
        success:
          false,

        reason:
          "找不到玩家 ID",

        slots:
          nextSlots
      };
    }

    const targetSlot =
      nextSlots.find(
        function (slot) {
          return (
            String(
              slot.slotId
            ) === targetId ||
            String(
              slot.id
            ) === targetId ||
            String(
              slot.order
            ) === targetId
          );
        }
      );

    if (!targetSlot) {
      return {
        success:
          false,

        reason:
          "找不到指定席位",

        slots:
          nextSlots
      };
    }

    if (
      targetSlot.playerId &&
      String(
        targetSlot.playerId
      ) !== normalizedPlayerId
    ) {
      return {
        success:
          false,

        reason:
          "這個席位已經有人",

        slots:
          nextSlots
      };
    }

    nextSlots.forEach(
      function (slot) {
        if (
          String(
            slot.playerId || ""
          ) === normalizedPlayerId
        ) {
          slot.playerId =
            null;

          slot.player =
            null;

          slot.type =
            slot.originalType;

          slot.updatedAt =
            seatNowTime();
        }
      }
    );

    targetSlot.playerId =
      normalizedPlayerId;

    targetSlot.player =
      playerData
        ? cloneValue(playerData)
        : targetSlot.player ||
          null;

    if (
      targetSlot.originalType ===
      "flexible"
    ) {
      const normalizedType =
        normalizeSeatType(
          selectedType
        );

      targetSlot.type =
        normalizedType ===
          "male" ||
        normalizedType ===
          "female"
          ? normalizedType
          : "flexible";
    } else {
      targetSlot.type =
        targetSlot.originalType;
    }

    targetSlot.updatedAt =
      seatNowTime();

    return {
      success:
        true,

      reason:
        "",

      slots:
        nextSlots
    };
  }

  function assignPlayerToSeat(
    car,
    slotId,
    playerId,
    selectedType,
    playerData
  ) {
    if (
      !car ||
      !playerId
    ) {
      return false;
    }

    const SeatAssignment =
      window.JLYSeatAssignment;

    if (
      SeatAssignment &&
      typeof SeatAssignment.assignPlayerToSlot ===
        "function"
    ) {
      try {
        const result =
          SeatAssignment.assignPlayerToSlot(
            getSlots(car),
            slotId,
            playerId,
            selectedType,
            playerData
          );

        if (
          result &&
          Array.isArray(
            result.slots
          )
        ) {
          car.slots =
            cloneSlots(
              result.slots
            );

          return (
            result.success !==
            false
          );
        }

        if (
          Array.isArray(result)
        ) {
          car.slots =
            cloneSlots(result);

          return true;
        }
      } catch (error) {
        console.warn(
          "JLYSeatAssignment.assignPlayerToSlot 執行失敗，改用相容流程：",
          error
        );
      }
    }

    const fallbackResult =
      assignPlayerFallback(
        getSlots(car),
        slotId,
        playerId,
        selectedType,
        playerData
      );

    car.slots =
      fallbackResult.slots;

    return fallbackResult.success;
  }

  function removePlayerFromSeat(
    car,
    playerId
  ) {
    if (
      !car ||
      !playerId
    ) {
      return false;
    }

    const normalizedPlayerId =
      String(playerId);

    const SeatAssignment =
      window.JLYSeatAssignment;

    if (
      SeatAssignment &&
      typeof SeatAssignment.removePlayerFromSlots ===
        "function"
    ) {
      try {
        const result =
          SeatAssignment.removePlayerFromSlots(
            getSlots(car),
            normalizedPlayerId
          );

        if (
          result &&
          Array.isArray(
            result.slots
          )
        ) {
          car.slots =
            cloneSlots(
              result.slots
            );

          return (
            result.success !==
            false
          );
        }

        if (
          Array.isArray(result)
        ) {
          car.slots =
            cloneSlots(result);

          return true;
        }
      } catch (error) {
        console.warn(
          "JLYSeatAssignment.removePlayerFromSlots 執行失敗，改用相容流程：",
          error
        );
      }
    }

    let removed =
      false;

    car.slots =
      getSlots(car).map(
        function (slot) {
          const nextSlot = {
            ...slot
          };

          if (
            String(
              nextSlot.playerId ||
              ""
            ) === normalizedPlayerId
          ) {
            nextSlot.playerId =
              null;

            nextSlot.player =
              null;

            nextSlot.type =
              nextSlot.originalType;

            nextSlot.updatedAt =
              seatNowTime();

            removed =
              true;
          }

          return nextSlot;
        }
      );

    return removed;
  }

  // ============================================================
  // 配置統計
  // ============================================================

  function getOriginalSeatConfig(car) {
    const slots =
      getSlots(car);

    const male =
      slots.filter(
        function (slot) {
          return (
            slot.originalType ===
            "male"
          );
        }
      ).length;

    const female =
      slots.filter(
        function (slot) {
          return (
            slot.originalType ===
            "female"
          );
        }
      ).length;

    const flexible =
      slots.filter(
        function (slot) {
          return (
            slot.originalType ===
            "flexible"
          );
        }
      ).length;

    return {
      male,
      female,
      flexible,
      total:
        slots.length
    };
  }

  function getCurrentSeatConfig(car) {
    const slots =
      getSlots(car);

    let male = 0;
    let female = 0;
    let flexible = 0;

    slots.forEach(
      function (slot) {
        const type =
          normalizeSeatType(
            slot.type
          );

        if (
          type === "male"
        ) {
          male += 1;
          return;
        }

        if (
          type === "female"
        ) {
          female += 1;
          return;
        }

        flexible += 1;
      }
    );

    return {
      male,
      female,
      flexible,
      total:
        slots.length
    };
  }

  // ============================================================
  // 同步流程的內建安全版本
  //
  // 規則：
  // 1. 保留仍在車上的已入座玩家
  // 2. 清除已離開或取消的玩家
  // 3. 清除重複入座
  // 4. 只把玩家補進合法空位
  // 5. 不重新洗牌
  // 6. 放不下的玩家留在等待安排
  // ============================================================

  function syncPlayersFallback(
    slots,
    players
  ) {
    const activePlayers =
      (
        Array.isArray(players)
          ? players
          : []
      ).filter(
        function (player) {
          return !isCancelledPlayer(
            player
          );
        }
      );

    const playerMap =
      new Map();

    activePlayers.forEach(
      function (player, index) {
        const playerId =
          getStablePlayerId(
            player,
            index
          );

        playerMap.set(
          playerId,
          {
            player,
            playerId,
            playerIndex:
              index,

            positionType:
              getPlayerSeatType(
                player
              )
          }
        );
      }
    );

    const nextSlots =
      cloneSlots(slots);

    const occupiedIds =
      new Set();

    const removedPlayerIds =
      [];

    nextSlots.forEach(
      function (slot) {
        if (!slot.playerId) {
          slot.playerId =
            null;

          slot.player =
            null;

          slot.type =
            slot.originalType;

          return;
        }

        const playerId =
          String(
            slot.playerId
          );

        const playerItem =
          playerMap.get(
            playerId
          );

        if (
          !playerItem ||
          occupiedIds.has(
            playerId
          )
        ) {
          removedPlayerIds.push(
            playerId
          );

          slot.playerId =
            null;

          slot.player =
            null;

          slot.type =
            slot.originalType;

          slot.updatedAt =
            seatNowTime();

          return;
        }

        occupiedIds.add(
          playerId
        );

        slot.player = {
          id:
            playerId,

          name:
            getPlayerDisplayName(
              playerItem.player
            )
        };
      }
    );

    const waitingPlayers =
      [];

    playerMap.forEach(
      function (playerItem) {
        if (
          !occupiedIds.has(
            playerItem.playerId
          )
        ) {
          waitingPlayers.push(
            playerItem
          );
        }
      }
    );

    const assignedPlayers =
      [];

    const remainingPlayers =
      [];

    function findEmptySlotByType(
      type
    ) {
      return (
        nextSlots.find(
          function (slot) {
            return (
              !slot.playerId &&
              slot.originalType ===
                type
            );
          }
        ) ||
        null
      );
    }

    function findAnyEmptySlot() {
      return (
        nextSlots.find(
          function (slot) {
            return !slot.playerId;
          }
        ) ||
        null
      );
    }

    waitingPlayers.forEach(
      function (waitingPlayer) {
        const player =
          waitingPlayer.player;

        const playerId =
          waitingPlayer.playerId;

        const positionType =
          waitingPlayer.positionType;

        let targetSlot =
          null;

        if (
          positionType ===
          "male"
        ) {
          targetSlot =
            findEmptySlotByType(
              "male"
            ) ||
            findEmptySlotByType(
              "flexible"
            );
        } else if (
          positionType ===
          "female"
        ) {
          targetSlot =
            findEmptySlotByType(
              "female"
            ) ||
            findEmptySlotByType(
              "flexible"
            );
        } else {
          targetSlot =
            findEmptySlotByType(
              "flexible"
            ) ||
            findAnyEmptySlot();
        }

        if (!targetSlot) {
          remainingPlayers.push({
            ...waitingPlayer,

            waitingReason:
              "目前沒有符合的空位"
          });

          return;
        }

        targetSlot.playerId =
          playerId;

        targetSlot.player = {
          id:
            playerId,

          name:
            getPlayerDisplayName(
              player
            )
        };

        if (
          targetSlot.originalType ===
          "flexible"
        ) {
          targetSlot.type =
            positionType === "male" ||
            positionType === "female"
              ? positionType
              : "flexible";
        } else {
          targetSlot.type =
            targetSlot.originalType;
        }

        targetSlot.updatedAt =
          seatNowTime();

        occupiedIds.add(
          playerId
        );

        assignedPlayers.push({
          player,
          playerId,
          slotId:
            targetSlot.slotId
        });
      }
    );

    return {
      success:
        true,

      slots:
        nextSlots,

      assignedPlayers,

      importedPlayers:
        assignedPlayers.map(
          function (item) {
            return item.player;
          }
        ),

      removedPlayerIds,

      waitingPlayers:
        remainingPlayers,

      remainingPlayers:
        remainingPlayers.map(
          function (item) {
            return item.player;
          }
        ),

      needsSelection:
        remainingPlayers.length >
        0
    };
  }

  // ============================================================
  // 呼叫新的 Seat Assignment
  //
  // 這裡同時支援兩種常見介面：
  // syncPlayersToSeats(slots, players)
  // syncPlayersToSeats({ slots, players })
  //
  // 若目前模組介面不同或尚未載入，
  // 自動退回內建安全版本。
  // ============================================================

  function isValidSyncResult(result) {
    return Boolean(
      result &&
      Array.isArray(
        result.slots
      )
    );
  }

  function runSeatSyncEngine(
    slots,
    players,
    car
  ) {
    const SeatAssignment =
      window.JLYSeatAssignment;

    if (
      !SeatAssignment ||
      typeof SeatAssignment.syncPlayersToSeats !==
        "function"
    ) {
      return syncPlayersFallback(
        slots,
        players
      );
    }

    const attempts = [
      function () {
        return SeatAssignment
          .syncPlayersToSeats(
            cloneSlots(slots),
            cloneValue(players),
            {
              car:
                cloneValue(car)
            }
          );
      },

      function () {
        return SeatAssignment
          .syncPlayersToSeats({
            slots:
              cloneSlots(slots),

            players:
              cloneValue(players),

            car:
              cloneValue(car)
          });
      }
    ];

    for (
      let index = 0;
      index < attempts.length;
      index += 1
    ) {
      try {
        const result =
          attempts[index]();

        if (
          isValidSyncResult(
            result
          )
        ) {
          return {
            success:
              result.success !==
              false,

            slots:
              cloneSlots(
                result.slots
              ),

            assignedPlayers:
              Array.isArray(
                result.assignedPlayers
              )
                ? result.assignedPlayers
                : [],

            importedPlayers:
              Array.isArray(
                result.importedPlayers
              )
                ? result.importedPlayers
                : [],

            removedPlayerIds:
              Array.isArray(
                result.removedPlayerIds
              )
                ? result.removedPlayerIds
                : [],

            waitingPlayers:
              Array.isArray(
                result.waitingPlayers
              )
                ? result.waitingPlayers
                : [],

            remainingPlayers:
              Array.isArray(
                result.remainingPlayers
              )
                ? result.remainingPlayers
                : [],

            needsSelection:
              result.needsSelection ===
              true,

            reason:
              result.reason ||
              ""
          };
        }
      } catch (error) {
        console.warn(
          `Seat Assignment 同步介面 ${index + 1} 無法使用：`,
          error
        );
      }
    }

    console.warn(
      "新的 Seat Assignment 沒有回傳可用結果，改用內建安全流程。"
    );

    return syncPlayersFallback(
      slots,
      players
    );
  }

  // ============================================================
  // 顯示同步結果
  // ============================================================

  function getResultPlayerName(item) {
    if (!item) {
      return "未命名玩家";
    }

    return getPlayerDisplayName(
      item.player ||
      item
    );
  }

  function buildSyncMessage(result) {
    const assignedPlayers =
      Array.isArray(
        result.assignedPlayers
      )
        ? result.assignedPlayers
        : [];

    const importedPlayers =
      Array.isArray(
        result.importedPlayers
      )
        ? result.importedPlayers
        : [];

    const waitingPlayers =
      Array.isArray(
        result.waitingPlayers
      )
        ? result.waitingPlayers
        : [];

    const remainingPlayers =
      Array.isArray(
        result.remainingPlayers
      )
        ? result.remainingPlayers
        : [];

    const assignedItems =
      assignedPlayers.length > 0
        ? assignedPlayers
        : importedPlayers;

    const waitingItems =
      waitingPlayers.length > 0
        ? waitingPlayers
        : remainingPlayers;

    const assignedNames =
      assignedItems
        .map(
          getResultPlayerName
        )
        .filter(Boolean);

    const waitingNames =
      waitingItems
        .map(
          getResultPlayerName
        )
        .filter(Boolean);

    let message =
      "✅ 席位同步完成";

    if (
      assignedNames.length > 0
    ) {
      message +=
        `\n\n已安排 ${assignedNames.length} 位玩家：\n` +
        assignedNames.join("、");
    } else {
      message +=
        "\n\n原有席位已保留，沒有需要新增安排的玩家。";
    }

    if (
      Array.isArray(
        result.removedPlayerIds
      ) &&
      result.removedPlayerIds.length >
        0
    ) {
      message +=
        `\n\n已清除 ${result.removedPlayerIds.length} 個失效或重複席位。`;
    }

    if (
      waitingNames.length > 0
    ) {
      message +=
        `\n\n⏳ 等待安排 ${waitingNames.length} 位：\n` +
        waitingNames.join("、");
    }

    return message;
  }

  // ============================================================
  // Firestore 同步
  // ============================================================

  async function syncPlayersToSeats() {
    const db =
      window.db;

    const carId =
      new URLSearchParams(
        window.location.search
      ).get("id");

    if (!db) {
      alert(
        "Firebase 尚未載入"
      );

      return;
    }

    if (!carId) {
      alert(
        "找不到車團 ID"
      );

      return;
    }

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      const carDoc =
        await carRef.get();

      if (!carDoc.exists) {
        alert(
          "找不到這台車"
        );

        return;
      }

      const car =
        carDoc.data() ||
        {};

      const players =
        Array.isArray(
          car.players
        )
          ? car.players
          : [];

      const activePlayers =
        players.filter(
          function (player) {
            return !isCancelledPlayer(
              player
            );
          }
        );

      if (
        activePlayers.length === 0
      ) {
        alert(
          "這台車目前沒有可同步的玩家"
        );

        return;
      }

      const slots =
        buildSlots(car);

      if (
        slots.length === 0
      ) {
        alert(
          "無法建立席位，請檢查車團的總人數或男女配置"
        );

        return;
      }

      const result =
        runSeatSyncEngine(
          slots,
          activePlayers,
          car
        );

      if (
        !result ||
        !Array.isArray(
          result.slots
        )
      ) {
        throw new Error(
          "座位引擎沒有回傳有效席位資料"
        );
      }

      const history =
        Array.isArray(
          car.history
        )
          ? [
              ...car.history
            ]
          : [];

      const assignedCount =
        Array.isArray(
          result.assignedPlayers
        )
          ? result.assignedPlayers
              .length
          : (
              Array.isArray(
                result.importedPlayers
              )
                ? result
                    .importedPlayers
                    .length
                : 0
            );

      const waitingCount =
        Array.isArray(
          result.waitingPlayers
        )
          ? result.waitingPlayers
              .length
          : (
              Array.isArray(
                result.remainingPlayers
              )
                ? result
                    .remainingPlayers
                    .length
                : 0
            );

      history.push({
        type:
          "同步席位",

        text:
          assignedCount > 0
            ? (
                `已同步席位，新安排 ${assignedCount} 位玩家` +
                (
                  waitingCount > 0
                    ? `，另有 ${waitingCount} 位等待安排`
                    : ""
                )
              )
            : (
                waitingCount > 0
                  ? `已同步席位，${waitingCount} 位玩家等待安排`
                  : "已同步席位，原有安排保持不變"
              ),

        time:
          seatNowTime()
      });

      await carRef.update({
        slots:
          cloneSlots(
            result.slots
          ),

        history,

        schemaVersion:
          Math.max(
            Number(
              car.schemaVersion ||
              0
            ),
            2
          ),

        updatedAt:
          seatNowTime()
      });

      alert(
        buildSyncMessage(
          result
        )
      );

      if (
        typeof window.renderCarDetail ===
        "function"
      ) {
        await window
          .renderCarDetail();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error(
        "同步玩家與席位失敗：",
        error
      );

      alert(
        "同步席位失敗：" +
        (
          error &&
          error.message
            ? error.message
            : "未知錯誤"
        )
      );
    }
  }

  // ============================================================
  // 明確掛到 window
  //
  // 這些名稱暫時不能更改，
  // 因為 cardetail.js、editcar.js 等舊檔案仍在使用。
  // ============================================================

  window.seatNowTime =
    seatNowTime;

  window.buildSlots =
    buildSlots;

  window.getSlots =
    getSlots;

  window.getSlotById =
    getSlotById;

  window.getEmptySeatCount =
    getEmptySeatCount;

  window.getOccupiedSeatCount =
    getOccupiedSeatCount;

  window.assignPlayerToSeat =
    assignPlayerToSeat;

  window.removePlayerFromSeat =
    removePlayerFromSeat;

  window.getOriginalSeatConfig =
    getOriginalSeatConfig;

  window.getCurrentSeatConfig =
    getCurrentSeatConfig;

  window.syncPlayersToSeats =
    syncPlayersToSeats;

  // 額外提供給後續模組化使用
  window.JLYSeatBridge = {
    normalizeSeatType,
    getStablePlayerId,
    getPlayerDisplayName,
    getPlayerSeatType,
    cloneSlots,
    runSeatSyncEngine,
    syncPlayersFallback
  };
})();