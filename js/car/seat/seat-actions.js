console.log("seat-actions.js 已成功載入！");

// ============================================================
// JLY Host System
// Seat Engine V2 - Actions
//
// 負責：
// 1. 整列座位移動與排序
// 2. 玩家在座位之間移動
// 3. 玩家從座位移回等候區
// 4. 等候玩家放入指定座位
// 5. 統一操作結果格式
//
// 不負責：
// - Firestore 寫入
// - 畫面 Render
// - DOM 拖曳事件
// - 玩家與座位規則本身
// ============================================================

(function () {
  "use strict";

  // ------------------------------------------------------------
  // 取得其他 Seat 模組
  // ------------------------------------------------------------

  function getSeatData() {
    if (!window.JLYSeatData) {
      throw new Error(
        "JLYSeatData 尚未載入，請先載入 seat-data.js"
      );
    }

    return window.JLYSeatData;
  }

  function getSeatAssignment() {
    if (!window.JLYSeatAssignment) {
      throw new Error(
        "JLYSeatAssignment 尚未載入，請先載入 seat-assignment.js"
      );
    }

    return window.JLYSeatAssignment;
  }

  // ------------------------------------------------------------
  // 標準操作結果
  // ------------------------------------------------------------

  function createActionResult(
    success,
    slots,
    options
  ) {
    const settings = options || {};

    return {
      success: Boolean(success),

      slots:
        Array.isArray(slots)
          ? slots
          : [],

      reason:
        settings.reason || "",

      action:
        settings.action || "",

      playerId:
        settings.playerId || "",

      sourceSlotId:
        settings.sourceSlotId || "",

      targetSlotId:
        settings.targetSlotId || "",

      waitingPlayers:
        Array.isArray(
          settings.waitingPlayers
        )
          ? settings.waitingPlayers
          : []
    };
  }

  // ------------------------------------------------------------
  // 重新整理 order
  // ------------------------------------------------------------

  function normalizeSlotOrders(slots) {
    const SeatData = getSeatData();

    return SeatData.cloneSlots(
      slots
    ).map(
      function (slot, index) {
        const order =
          index + 1;

        return {
          ...slot,
          order,
          updatedAt:
            SeatData.nowTime()
        };
      }
    );
  }

  // ------------------------------------------------------------
  // 整列座位移動
  //
  // 這個操作會搬走整列資料：
  // - 座位分類
  // - 角色名稱
  // - 玩家
  // - 座位設定
  //
  // 不會拆開玩家與角色。
  // ------------------------------------------------------------

  function moveSeatRow(
    slots,
    sourceSlotId,
    targetSlotId
  ) {
    const SeatData = getSeatData();
    const SeatAssignment =
      getSeatAssignment();

    const nextSlots =
      SeatData.cloneSlots(
        slots
      );

    const sourceIndex =
      nextSlots.findIndex(
        function (slot) {
          return (
            SeatAssignment.getSlotId(
              slot
            ) ===
            String(sourceSlotId || "")
          );
        }
      );

    const targetIndex =
      nextSlots.findIndex(
        function (slot) {
          return (
            SeatAssignment.getSlotId(
              slot
            ) ===
            String(targetSlotId || "")
          );
        }
      );

    if (
      sourceIndex === -1 ||
      targetIndex === -1
    ) {
      return createActionResult(
        false,
        nextSlots,
        {
          action: "move-seat-row",
          reason:
            "找不到要移動的座位"
        }
      );
    }

    if (
      sourceIndex ===
      targetIndex
    ) {
      return createActionResult(
        true,
        nextSlots,
        {
          action: "move-seat-row",
          sourceSlotId,
          targetSlotId
        }
      );
    }

    const movedRows =
      nextSlots.splice(
        sourceIndex,
        1
      );

    const movedRow =
      movedRows[0];

    nextSlots.splice(
      targetIndex,
      0,
      movedRow
    );

    return createActionResult(
      true,
      normalizeSlotOrders(
        nextSlots
      ),
      {
        action: "move-seat-row",
        sourceSlotId,
        targetSlotId
      }
    );
  }

  // ------------------------------------------------------------
  // 整列向上移一格
  // ------------------------------------------------------------

  function moveSeatRowUp(
    slots,
    slotId
  ) {
    const SeatData = getSeatData();
    const SeatAssignment =
      getSeatAssignment();

    const nextSlots =
      SeatData.cloneSlots(
        slots
      );

    const currentIndex =
      nextSlots.findIndex(
        function (slot) {
          return (
            SeatAssignment.getSlotId(
              slot
            ) ===
            String(slotId || "")
          );
        }
      );

    if (currentIndex === -1) {
      return createActionResult(
        false,
        nextSlots,
        {
          action:
            "move-seat-row-up",
          reason:
            "找不到指定座位"
        }
      );
    }

    if (currentIndex === 0) {
      return createActionResult(
        true,
        nextSlots,
        {
          action:
            "move-seat-row-up",
          sourceSlotId:
            slotId
        }
      );
    }

    const previousSlot =
      nextSlots[
        currentIndex - 1
      ];

    return moveSeatRow(
      nextSlots,
      slotId,
      SeatAssignment.getSlotId(
        previousSlot
      )
    );
  }

  // ------------------------------------------------------------
  // 整列向下移一格
  // ------------------------------------------------------------

  function moveSeatRowDown(
    slots,
    slotId
  ) {
    const SeatData = getSeatData();
    const SeatAssignment =
      getSeatAssignment();

    const nextSlots =
      SeatData.cloneSlots(
        slots
      );

    const currentIndex =
      nextSlots.findIndex(
        function (slot) {
          return (
            SeatAssignment.getSlotId(
              slot
            ) ===
            String(slotId || "")
          );
        }
      );

    if (currentIndex === -1) {
      return createActionResult(
        false,
        nextSlots,
        {
          action:
            "move-seat-row-down",
          reason:
            "找不到指定座位"
        }
      );
    }

    if (
      currentIndex ===
      nextSlots.length - 1
    ) {
      return createActionResult(
        true,
        nextSlots,
        {
          action:
            "move-seat-row-down",
          sourceSlotId:
            slotId
        }
      );
    }

    const nextSlot =
      nextSlots[
        currentIndex + 1
      ];

    return moveSeatRow(
      nextSlots,
      slotId,
      SeatAssignment.getSlotId(
        nextSlot
      )
    );
  }

  // ------------------------------------------------------------
  // 玩家在兩個座位之間移動
  //
  // 只移動玩家：
  // - 座位名稱不動
  // - 角色名稱不動
  // - 整列設定不動
  // ------------------------------------------------------------

  function movePlayer(
    players,
    slots,
    sourceSlotId,
    targetSlotId
  ) {
    const SeatData = getSeatData();
    const SeatAssignment =
      getSeatAssignment();

    const result =
      SeatAssignment
        .movePlayerBetweenSlots(
          players,
          slots,
          sourceSlotId,
          targetSlotId
        );

    if (!result.success) {
      return createActionResult(
        false,
        result.slots,
        {
          action:
            "move-player",
          reason:
            result.reason,
          sourceSlotId,
          targetSlotId
        }
      );
    }

    return createActionResult(
      true,
      result.slots,
      {
        action:
          "move-player",
        sourceSlotId,
        targetSlotId,

        waitingPlayers:
          SeatData
            .getWaitingPlayers(
              players,
              result.slots
            )
      }
    );
  }

  // ------------------------------------------------------------
  // 玩家移回等候區
  //
  // 玩家仍然保留在 car.players。
  // 只會清掉 slot.playerId。
  // ------------------------------------------------------------

  function movePlayerToWaiting(
    players,
    slots,
    playerId
  ) {
    const SeatData = getSeatData();
    const SeatAssignment =
      getSeatAssignment();

    const normalizedPlayerId =
      String(playerId || "");

    if (!normalizedPlayerId) {
      return createActionResult(
        false,
        SeatData.cloneSlots(
          slots
        ),
        {
          action:
            "move-player-to-waiting",
          reason:
            "缺少玩家編號"
        }
      );
    }

    const result =
      SeatAssignment
        .removePlayerFromSlots(
          slots,
          normalizedPlayerId
        );

    if (!result.success) {
      return createActionResult(
        false,
        result.slots,
        {
          action:
            "move-player-to-waiting",
          reason:
            "這位玩家目前不在座位中",
          playerId:
            normalizedPlayerId
        }
      );
    }

    return createActionResult(
      true,
      result.slots,
      {
        action:
          "move-player-to-waiting",

        playerId:
          normalizedPlayerId,

        waitingPlayers:
          SeatData
            .getWaitingPlayers(
              players,
              result.slots
            )
      }
    );
  }

  // ------------------------------------------------------------
  // 從等候區放入指定座位
  // ------------------------------------------------------------

  function moveWaitingPlayerToSlot(
    players,
    slots,
    playerId,
    targetSlotId
  ) {
    const SeatData = getSeatData();
    const SeatAssignment =
      getSeatAssignment();

    const normalizedPlayerId =
      String(playerId || "");

    const normalizedTargetSlotId =
      String(targetSlotId || "");

    if (!normalizedPlayerId) {
      return createActionResult(
        false,
        SeatData.cloneSlots(
          slots
        ),
        {
          action:
            "waiting-player-to-slot",
          reason:
            "缺少玩家編號"
        }
      );
    }

    if (
      !normalizedTargetSlotId
    ) {
      return createActionResult(
        false,
        SeatData.cloneSlots(
          slots
        ),
        {
          action:
            "waiting-player-to-slot",
          reason:
            "缺少目標座位"
        }
      );
    }

    const existingSeat =
      SeatAssignment.findPlayerSeat(
        slots,
        normalizedPlayerId
      );

    if (existingSeat) {
      return createActionResult(
        false,
        SeatData.cloneSlots(
          slots
        ),
        {
          action:
            "waiting-player-to-slot",
          reason:
            "這位玩家已經有座位",
          playerId:
            normalizedPlayerId,
          targetSlotId:
            normalizedTargetSlotId
        }
      );
    }

    const assignment =
      SeatAssignment
        .assignPlayerToSlot(
          players,
          slots,
          normalizedPlayerId,
          normalizedTargetSlotId
        );

    if (!assignment.success) {
      return createActionResult(
        false,
        assignment.slots,
        {
          action:
            "waiting-player-to-slot",
          reason:
            assignment.reason,
          playerId:
            normalizedPlayerId,
          targetSlotId:
            normalizedTargetSlotId
        }
      );
    }

    return createActionResult(
      true,
      assignment.slots,
      {
        action:
          "waiting-player-to-slot",

        playerId:
          normalizedPlayerId,

        targetSlotId:
          normalizedTargetSlotId,

        waitingPlayers:
          SeatData
            .getWaitingPlayers(
              players,
              assignment.slots
            )
      }
    );
  }

  // ------------------------------------------------------------
  // 自動把一位等候玩家放到最佳空位
  // ------------------------------------------------------------

  function autoPlaceWaitingPlayer(
    players,
    slots,
    playerId
  ) {
    const SeatData = getSeatData();
    const SeatAssignment =
      getSeatAssignment();

    const normalizedPlayerId =
      String(playerId || "");

    const player =
      SeatAssignment.getPlayerById(
        players,
        normalizedPlayerId
      );

    if (!player) {
      return createActionResult(
        false,
        SeatData.cloneSlots(
          slots
        ),
        {
          action:
            "auto-place-waiting-player",
          reason:
            "找不到這位玩家",
          playerId:
            normalizedPlayerId
        }
      );
    }

    const existingSeat =
      SeatAssignment.findPlayerSeat(
        slots,
        normalizedPlayerId
      );

    if (existingSeat) {
      return createActionResult(
        false,
        SeatData.cloneSlots(
          slots
        ),
        {
          action:
            "auto-place-waiting-player",
          reason:
            "這位玩家已經有座位",
          playerId:
            normalizedPlayerId
        }
      );
    }

    const targetSlot =
      SeatAssignment
        .findBestEmptySlot(
          player,
          slots
        );

    if (!targetSlot) {
      return createActionResult(
        false,
        SeatData.cloneSlots(
          slots
        ),
        {
          action:
            "auto-place-waiting-player",
          reason:
            "目前沒有符合分類的空位",
          playerId:
            normalizedPlayerId
        }
      );
    }

    return moveWaitingPlayerToSlot(
      players,
      slots,
      normalizedPlayerId,
      SeatAssignment.getSlotId(
        targetSlot
      )
    );
  }

  // ------------------------------------------------------------
  // 清除重複與失效座位
  // ------------------------------------------------------------

  function cleanSlots(
    players,
    slots
  ) {
    const SeatData = getSeatData();

    const cleanResult =
      SeatData.cleanSeatData(
        players,
        slots
      );

    return createActionResult(
      true,
      cleanResult.slots,
      {
        action:
          "clean-slots",

        waitingPlayers:
          cleanResult
            .waitingPlayers
      }
    );
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatActions = {
    createActionResult,

    normalizeSlotOrders,

    moveSeatRow,
    moveSeatRowUp,
    moveSeatRowDown,

    movePlayer,
    movePlayerToWaiting,
    moveWaitingPlayerToSlot,
    autoPlaceWaitingPlayer,

    cleanSlots
  };
})();