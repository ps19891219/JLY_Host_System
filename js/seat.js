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

  // 舊的「只填總人數」資料，全部建立為不限位
  if (
    maleSlots === 0 &&
    femaleSlots === 0 &&
    flexibleSlots === 0 &&
    totalPeople > 0
  ) {
    flexibleSlots = totalPeople;
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