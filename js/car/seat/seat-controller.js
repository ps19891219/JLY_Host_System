console.log(
  "seat-controller.js V2 已成功載入！"
);

// ============================================================
// JLY Host System
// Seat Controller V2
//
// 負責：
// 1. 啟動 Seat Board
// 2. 啟動 Seat Row Drag
// 3. 啟動 Seat Player Drag
// 4. 接收席位變更結果
// 5. 處理玩家跨分類提醒
// 6. 重新整理座位畫面
//
// 不直接負責：
// - Firestore 寫入
// - Seat 規則判斷
// - Seat HTML
// ============================================================

(function () {
  "use strict";

  const controllerState = {
    container: null,
    car: null,
    players: [],
    options: {},
    pendingPlayerMove: null
  };

  // ------------------------------------------------------------
  // 模組檢查
  // ------------------------------------------------------------

  function isReady() {
    return Boolean(
      window.JLYSeatBoard &&
      typeof window
        .JLYSeatBoard
        .render === "function"
    );
  }

  function isRowDragReady() {
    return Boolean(
      window.JLYSeatDrag &&
      typeof window
        .JLYSeatDrag
        .bind === "function"
    );
  }

  function isPlayerDragReady() {
    return Boolean(
      window.JLYSeatPlayerDrag &&
      typeof window
        .JLYSeatPlayerDrag
        .bind === "function"
    );
  }

  function getPlayerMovePipeline() {
    const pipeline =
      window.JLYPlayerMovePipeline;

    if (!pipeline) {
      throw new Error(
        "Player Move Pipeline 尚未載入"
      );
    }

    return pipeline;
  }

  // ------------------------------------------------------------
  // 容器
  // ------------------------------------------------------------

  function resolveContainer(container) {
    if (!container) {
      return null;
    }

    if (
      container instanceof
      HTMLElement
    ) {
      return container;
    }

    const value =
      String(container);

    return (
      document.querySelector(value) ||
      document.getElementById(
        value.replace(/^#/, "")
      )
    );
  }

  // ------------------------------------------------------------
  // 複製資料
  // ------------------------------------------------------------

  function cloneValue(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  // ------------------------------------------------------------
  // 顯示訊息
  // ------------------------------------------------------------

  function showMessage(
    message,
    type
  ) {
    const container =
      controllerState.container;

    if (
      window.JLYSeatRender &&
      typeof window
        .JLYSeatRender
        .showActionMessage ===
        "function"
    ) {
      window.JLYSeatRender
        .showActionMessage(
          container,
          message,
          type
        );

      return;
    }

    if (type === "error") {
      alert(message);
    }
  }

  // ------------------------------------------------------------
  // 同步 Controller 狀態
  // ------------------------------------------------------------

  function updateControllerData(
    nextSlots,
    nextPlayers
  ) {
    if (
      controllerState.car &&
      Array.isArray(nextSlots)
    ) {
      controllerState.car.slots =
        cloneValue(nextSlots);
    }

    if (
      Array.isArray(nextPlayers)
    ) {
      controllerState.players =
        cloneValue(nextPlayers);

      if (controllerState.car) {
        controllerState.car.players =
          cloneValue(nextPlayers);
      }
    }
  }

  // ------------------------------------------------------------
  // 套用操作結果
  // ------------------------------------------------------------

  function applyActionResult(
    actionResult
  ) {
    const nextSlots =
      actionResult &&
      Array.isArray(
        actionResult.slots
      )
        ? actionResult.slots
        : [];

    const nextPlayers =
      actionResult &&
      Array.isArray(
        actionResult.players
      )
        ? actionResult.players
        : controllerState.players;

    if (nextSlots.length === 0) {
      console.error(
        "Seat Controller：沒有取得新的席位資料",
        actionResult
      );

      return {
        success: false,
        reason:
          "沒有取得新的席位資料"
      };
    }

    updateControllerData(
      nextSlots,
      nextPlayers
    );

    if (
      typeof controllerState
        .options
        .onSlotsChange ===
        "function"
    ) {
      controllerState.options
        .onSlotsChange(
          nextSlots,
          {
            ...actionResult,

            players:
              cloneValue(
                nextPlayers
              )
          }
        );
    }

    console.log(
      "✅ Seat Controller 已套用結果：",
      {
        actionResult,
        slots:
          controllerState.car
            ? controllerState
                .car
                .slots
            : [],
        players:
          controllerState.players
      }
    );

    refresh();

    return {
      success: true,
      slots: nextSlots,
      players: nextPlayers
    };
  }

  // ------------------------------------------------------------
  // 整列拖曳完成
  // ------------------------------------------------------------

  function handleSeatRowMove(
    moveResult
  ) {
    applyActionResult(
      moveResult
    );
  }

  // ------------------------------------------------------------
  // 玩家移動完成
  // ------------------------------------------------------------

  function handlePlayerMove(
    moveResult
  ) {
    controllerState.pendingPlayerMove =
      null;

    applyActionResult(
      moveResult
    );

    showMessage(
      "玩家席位已更新",
      "success"
    );
  }

  // ------------------------------------------------------------
  // 玩家移動失敗
  // ------------------------------------------------------------

  function handlePlayerMoveError(
    error,
    result
  ) {
    const message =
      result &&
      result.reason
        ? result.reason
        : (
            error &&
            error.message
              ? error.message
              : "玩家移動失敗"
          );

    console.error(
      "Seat Player Drag 發生錯誤：",
      error,
      result
    );

    showMessage(
      message,
      "error"
    );
  }

  // ------------------------------------------------------------
  // 主揪確認玩家位置
  //
  // 1：保留玩家原位置
  // 2：同步修改玩家位置
  // 0：取消
  // ------------------------------------------------------------

  function askPositionDecision(
    confirmation
  ) {
    const playerName =
      confirmation &&
      confirmation.playerName
        ? confirmation.playerName
        : "這位玩家";

    const currentPosition =
      confirmation &&
      confirmation
        .currentPositionLabel
        ? confirmation
            .currentPositionLabel
        : "原位置";

    const targetPosition =
      confirmation &&
      confirmation
        .targetPositionLabel
        ? confirmation
            .targetPositionLabel
        : "目標位置";

    const input =
      prompt(
        `⚠️ 更改玩家席位\n\n` +
        `${playerName}\n` +
        `目前設定：${currentPosition}\n` +
        `目標席位：${targetPosition}\n\n` +
        `請輸入：\n` +
        `1　保留玩家原位置\n` +
        `2　同步修改為 ${targetPosition}\n` +
        `0　取消移動`,
        "1"
      );

    if (
      input === null ||
      String(input).trim() ===
        "0"
    ) {
      return "cancel";
    }

    if (
      String(input).trim() ===
        "2"
    ) {
      return "update";
    }

    return "keep";
  }

  // ------------------------------------------------------------
  // 需要主揪確認
  // ------------------------------------------------------------

  function handleConfirmationRequired(
    pendingResult
  ) {
    controllerState.pendingPlayerMove =
      pendingResult;

    const decision =
      askPositionDecision(
        pendingResult.confirmation
      );

    if (decision === "cancel") {
      controllerState.pendingPlayerMove =
        null;

      showMessage(
        "已取消移動",
        "success"
      );

      return;
    }

    let result;

    try {
      result =
        getPlayerMovePipeline()
          .continueAfterConfirmation(
            pendingResult,
            decision
          );
    } catch (error) {
      controllerState.pendingPlayerMove =
        null;

      handlePlayerMoveError(
        error
      );

      return;
    }

    console.log(
      "🧍 Player Move 確認結果：",
      result
    );

    if (
      result.status ===
        "host-override-required"
    ) {
      controllerState.pendingPlayerMove =
        result;

      showMessage(
        "跨分類交換的最後執行層尚未接上",
        "error"
      );

      return;
    }

    if (!result.success) {
      controllerState.pendingPlayerMove =
        null;

      handlePlayerMoveError(
        new Error(
          result.reason ||
          "確認後仍無法移動"
        ),
        result
      );

      return;
    }

    handlePlayerMove(
      result
    );
  }

  // ------------------------------------------------------------
  // 綁定整列拖曳
  // ------------------------------------------------------------

  function bindRowDrag(boardData) {
    if (!isRowDragReady()) {
      console.warn(
        "Seat Controller：Seat Row Drag 尚未載入"
      );

      return {
        success: false,
        reason:
          "Seat Row Drag 尚未載入"
      };
    }

    return window
      .JLYSeatDrag
      .bind({
        container:
          controllerState.container,

        slots:
          boardData.slots,

        onMove:
          handleSeatRowMove
      });
  }

  // ------------------------------------------------------------
  // 綁定玩家拖曳
  // ------------------------------------------------------------

  function bindPlayerDrag(
    boardData
  ) {
    if (!isPlayerDragReady()) {
      console.warn(
        "Seat Controller：Player Drag 尚未載入"
      );

      return {
        success: false,
        reason:
          "Player Drag 尚未載入"
      };
    }

    return window
      .JLYSeatPlayerDrag
      .bind({
        container:
          controllerState.container,

        players:
          controllerState.players,

        slots:
          boardData.slots,

        onMove:
          handlePlayerMove,

        onConfirmationRequired:
          handleConfirmationRequired,

        onError:
          handlePlayerMoveError
      });
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  function render(
    container,
    car,
    players,
    options
  ) {
    const target =
      resolveContainer(
        container
      );

    if (!target) {
      console.error(
        "Seat Controller：找不到顯示容器",
        container
      );

      return {
        success: false,
        reason:
          "找不到座位顯示容器"
      };
    }

    if (!isReady()) {
      console.error(
        "Seat Controller：Seat Board 尚未載入"
      );

      return {
        success: false,
        reason:
          "Seat Board 尚未載入"
      };
    }

    controllerState.container =
      target;

    controllerState.car =
      car || {};

    controllerState.players =
      Array.isArray(players)
        ? cloneValue(players)
        : [];

    controllerState.options =
      options || {};

    const boardResult =
      window.JLYSeatBoard
        .render(
          target,
          controllerState.car,
          controllerState.players,
          controllerState.options
        );

    if (
      boardResult &&
      boardResult.success
    ) {
      if (
        controllerState.options
          .draggable !== false
      ) {
        bindRowDrag(
          boardResult.boardData
        );

        bindPlayerDrag(
          boardResult.boardData
        );
      }
    }

    return boardResult;
  }

  // ------------------------------------------------------------
  // Refresh
  // ------------------------------------------------------------

  function refresh() {
    if (
      !controllerState.container ||
      !controllerState.car
    ) {
      return {
        success: false,
        reason:
          "Seat Controller 尚未啟動"
      };
    }

    return render(
      controllerState.container,
      controllerState.car,
      controllerState.players,
      controllerState.options
    );
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatController = {
    isReady,

    render,

    refresh,

    applyActionResult,

    handlePlayerMove,

    handleConfirmationRequired,

    getState:
      function () {
        return {
          car:
            cloneValue(
              controllerState.car
            ),

          players:
            cloneValue(
              controllerState.players
            ),

          pendingPlayerMove:
            cloneValue(
              controllerState
                .pendingPlayerMove
            )
        };
      }
  };

  console.log(
    "✅ Seat Controller V2 已載入"
  );
})();