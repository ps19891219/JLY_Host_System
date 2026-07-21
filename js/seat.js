console.log("seat.js 已成功載入！");

// ============================================================
// JLY Host System Seat Engine
// V1.1
// ============================================================

function seatNowTime() {
  return new Date().toISOString();
}

/**
 * 建立席位資料
 *
 * 支援：
 * 1. 固定男位、女位、不限位
 * 2. 只填總人數的全不限模式
 * 3. 舊資料自動建立席位
 */
function buildSlots(car) {
  const sourceCar = car || {};

  // 已經有席位就直接沿用，不重建
  if (
    Array.isArray(sourceCar.slots) &&
    sourceCar.slots.length > 0
  ) {
    return sourceCar.slots;
  }

  const maleSlots = Math.max(
    0,
    Number(sourceCar.maleSlots || 0)
  );

  const femaleSlots = Math.max(
    0,
    Number(sourceCar.femaleSlots || 0)
  );

  let flexibleSlots = Math.max(
    0,
    Number(
      sourceCar.flexibleSlots ||
      sourceCar.flexSlots ||
      0
    )
  );

  const totalPeople = Math.max(
    0,
    Number(
      sourceCar.totalPeople ||
      sourceCar.capacity ||
      0
    )
  );

    // 總人數大於已設定席位時，
  // 剩餘人數自動建立為不限位
  const configuredTotal =
    maleSlots +
    femaleSlots +
    flexibleSlots;

  if (totalPeople > configuredTotal) {
    flexibleSlots +=
      totalPeople - configuredTotal;
  }

  const slots = [];
  let order = 1;

  function addSlots(count, type) {
    for (let index = 0; index < count; index += 1) {
      const slotId = `slot-${order}`;

      slots.push({
        id: slotId,
        slotId: slotId,
        order: order,

        // 原始席位類型
        originalType: type,

        // 目前顯示類型
        type: type,

        playerId: null,
        player: null,
        createdAt: seatNowTime(),
        updatedAt: seatNowTime()
      });

      order += 1;
    }
  }

  addSlots(maleSlots, "male");
  addSlots(femaleSlots, "female");
  addSlots(flexibleSlots, "flexible");

  return slots;
}

/**
 * 取得車團席位
 */
function getSlots(car) {
  if (!car) {
    return [];
  }

  if (
    !Array.isArray(car.slots) ||
    car.slots.length === 0
  ) {
    car.slots = buildSlots(car);
  }

  return car.slots;
}

/**
 * 找到指定席位
 */
function getSlotById(car, slotId) {
  const targetId = String(slotId);

  return getSlots(car).find(function (slot) {
    return (
      String(slot.slotId) === targetId ||
      String(slot.id) === targetId ||
      String(slot.order) === targetId
    );
  }) || null;
}

/**
 * 計算空位數
 */
function getEmptySeatCount(car) {
  return getSlots(car).filter(function (slot) {
    return !slot.playerId;
  }).length;
}

/**
 * 計算已坐下人數
 */
function getOccupiedSeatCount(car) {
  return getSlots(car).filter(function (slot) {
    return Boolean(slot.playerId);
  }).length;
}

/**
 * 玩家坐下
 */
function assignPlayerToSeat(
  car,
  slotId,
  playerId,
  selectedType
) {
  if (!car || !playerId) {
    return false;
  }

  const slots = getSlots(car);
  const slot = getSlotById(car, slotId);

  if (!slot || slot.playerId) {
    return false;
  }

  // 避免同一玩家同時坐兩個位置
  slots.forEach(function (item) {
    if (item.playerId === playerId) {
      item.playerId = null;
      item.player = null;

      if (item.originalType === "flexible") {
        item.type = "flexible";
      }
    }
  });

  slot.playerId = playerId;
  slot.updatedAt = seatNowTime();

  // 不限位依照玩家這場選擇，顯示在男位或女位
  if (
    slot.originalType === "flexible" &&
    (selectedType === "male" ||
      selectedType === "female")
  ) {
    slot.type = selectedType;
  }

  return true;
}

/**
 * 玩家離席
 */
function removePlayerFromSeat(car, playerId) {
  let removed = false;

  getSlots(car).forEach(function (slot) {
    if (slot.playerId === playerId) {
      slot.playerId = null;
      slot.player = null;
      slot.updatedAt = seatNowTime();

      if (slot.originalType === "flexible") {
        slot.type = "flexible";
      }

      removed = true;
    }
  });

  return removed;
}

/**
 * 取得原始配置
 *
 * 例如：
 * 2男 2女 2不限
 */
function getOriginalSeatConfig(car) {
  const slots = getSlots(car);

  const male = slots.filter(function (slot) {
    return slot.originalType === "male";
  }).length;

  const female = slots.filter(function (slot) {
    return slot.originalType === "female";
  }).length;

  const flexible = slots.filter(function (slot) {
    return slot.originalType === "flexible";
  }).length;

  return {
    male: male,
    female: female,
    flexible: flexible,
    total: slots.length
  };
}

/**
 * 取得目前配置
 *
 * 不限席有玩家後，依照實際選擇計入男位或女位。
 */
function getCurrentSeatConfig(car) {
  const slots = getSlots(car);

  let male = 0;
  let female = 0;
  let flexible = 0;

  slots.forEach(function (slot) {
    if (slot.type === "male") {
      male += 1;
      return;
    }

    if (slot.type === "female") {
      female += 1;
      return;
    }

    flexible += 1;
  });

  return {
    male: male,
    female: female,
    flexible: flexible,
    total: slots.length
  };
}

/**
 * 將舊車 players 匯入新版 slots
 *
 * 流程：
 * 1. 沒有 slots 時，自動建立
 * 2. 跳過已取消玩家
 * 3. 跳過已經入座的玩家
 * 4. 優先安排符合位置的席位
 * 5. 寫回 Firestore
 */
async function syncPlayersToSeats() {
  const db = window.db;

  const carId =
    new URLSearchParams(
      window.location.search
    ).get("id");

  if (!db) {
    alert("Firebase 尚未載入");
    return;
  }

  if (!carId) {
    alert("找不到車團 ID");
    return;
  }

  try {
    const carRef = db
      .collection("cars")
      .doc(carId);

    const carDoc =
      await carRef.get();

    if (!carDoc.exists) {
      alert("找不到這台車");
      return;
    }

    const car =
      carDoc.data() || {};

    const players =
      Array.isArray(car.players)
        ? car.players
        : [];

    if (players.length === 0) {
      alert("這台車沒有原有玩家可以匯入");
      return;
    }

    const slots =
      buildSlots(car).map(function (slot) {
        return {
          ...slot
        };
      });

    if (slots.length === 0) {
      alert(
        "無法建立席位，請檢查車團的總人數或男女配置"
      );
      return;
    }

    function getImportPlayerId(
      player,
      index
    ) {
      return String(
        player.playerId ||
        player.id ||
        player.profileId ||
        player.applicationId ||
        `legacy-player-${index + 1}`
      );
    }

    function getImportPlayerName(player) {
      return (
        player.hostAlias ||
        player.name ||
        player.displayName ||
        player.playerName ||
        "未命名玩家"
      );
    }

    function getPositionType(player) {
      const position =
        String(
          player.position ||
          player.role ||
          "不限"
        );

      if (
        position === "男位" ||
        position === "male"
      ) {
        return "male";
      }

      if (
        position === "女位" ||
        position === "female"
      ) {
        return "female";
      }

      return "flexible";
    }

    const occupiedPlayerIds =
      new Set();

    slots.forEach(function (slot) {
      if (slot.playerId) {
        occupiedPlayerIds.add(
          String(slot.playerId)
        );
      }
    });

    const waitingPlayers = [];

    players.forEach(function (
      player,
      index
    ) {
      if (
        player.status === "已取消"
      ) {
        return;
      }

      const playerId =
        getImportPlayerId(
          player,
          index
        );

      if (
        occupiedPlayerIds.has(playerId)
      ) {
        return;
      }

      waitingPlayers.push({
        player,
        playerId,
        playerIndex: index,
        positionType:
          getPositionType(player)
      });
    });

    if (
      waitingPlayers.length === 0
    ) {
      alert(
        "所有原有玩家都已經有席位"
      );
      return;
    }

    const importedPlayers = [];
    const remainingPlayers = [];

    waitingPlayers.forEach(function (
      waitingPlayer
    ) {
      const player =
        waitingPlayer.player;

      const playerId =
        waitingPlayer.playerId;

      const positionType =
        waitingPlayer.positionType;

      let targetSlot = null;

      // 男位或女位先尋找固定席位
      if (
        positionType === "male" ||
        positionType === "female"
      ) {
        targetSlot =
          slots.find(function (slot) {
            return (
              !slot.playerId &&
              slot.originalType ===
                positionType
            );
          }) || null;
      }

      // 固定位置不足時，尋找不限位
      if (!targetSlot) {
        targetSlot =
          slots.find(function (slot) {
            return (
              !slot.playerId &&
              slot.originalType ===
                "flexible"
            );
          }) || null;
      }

      // 玩家位置為不限時，可使用任何剩餘位置
      if (
        !targetSlot &&
        positionType === "flexible"
      ) {
        targetSlot =
          slots.find(function (slot) {
            return !slot.playerId;
          }) || null;
      }

      if (!targetSlot) {
        remainingPlayers.push(player);
        return;
      }

      targetSlot.playerId =
        playerId;

      targetSlot.player = {
        id: playerId,
        name:
          getImportPlayerName(player)
      };

      targetSlot.updatedAt =
        seatNowTime();

      if (
        targetSlot.originalType ===
          "flexible"
      ) {
        targetSlot.type =
          positionType === "male" ||
          positionType === "female"
            ? positionType
            : "flexible";
      }

      importedPlayers.push(player);
    });

    if (
      importedPlayers.length === 0
    ) {
      const remainingNames =
        remainingPlayers
          .map(getImportPlayerName)
          .join("、");

      alert(
        "沒有玩家成功匯入席位。" +
        (
          remainingNames
            ? "\n\n尚未排入：" +
              remainingNames
            : ""
        )
      );

      return;
    }

    const history =
      Array.isArray(car.history)
        ? [...car.history]
        : [];

    history.push({
      type: "匯入原有玩家",
      text:
        `已將 ${importedPlayers.length} 位原有玩家匯入席位`,
      time: seatNowTime()
    });

    await carRef.update({
      slots,
      history,
      schemaVersion:
        Math.max(
          Number(car.schemaVersion || 0),
          2
        ),
      updatedAt: seatNowTime()
    });

    const importedNames =
      importedPlayers
        .map(getImportPlayerName)
        .join("、");

    const remainingNames =
      remainingPlayers
        .map(getImportPlayerName)
        .join("、");

    let message =
      `✅ 已成功匯入 ${importedPlayers.length} 位玩家\n\n` +
      importedNames;

    if (remainingNames) {
      message +=
        `\n\n⚠️ 尚未排入：\n${remainingNames}`;
    }

    alert(message);

    if (
      typeof window.renderCarDetail ===
      "function"
    ) {
      await window.renderCarDetail();
    } else {
      window.location.reload();
    }
  } catch (error) {
    console.error(
      "匯入原有玩家失敗：",
      error
    );

    alert(
      "匯入原有玩家失敗：" +
      (
        error &&
        error.message
          ? error.message
          : "未知錯誤"
      )
    );
  }
}

// 明確掛到 window，讓其他 JS 檔案可以共用
window.buildSlots = buildSlots;
window.getSlots = getSlots;
window.getSlotById = getSlotById;
window.getEmptySeatCount = getEmptySeatCount;
window.getOccupiedSeatCount = getOccupiedSeatCount;
window.assignPlayerToSeat = assignPlayerToSeat;
window.removePlayerFromSeat = removePlayerFromSeat;
window.getOriginalSeatConfig = getOriginalSeatConfig;
window.getCurrentSeatConfig = getCurrentSeatConfig;
window.syncPlayersToSeats =
  syncPlayersToSeats;