console.log(
  "seat-controller.js V1 已成功載入！"
);

// ============================================================
// JLY Host System
// Seat Controller V1
//
// 負責：
// 1. 啟動 Seat Board
// 2. 啟動 Seat Drag
// 3. 接收拖曳後的新席位資料
// 4. 重新整理座位畫面
//
// 暫時不負責：
// - Firestore 儲存
// - 歷史紀錄
// - Undo
// - 玩家拖入與交換
// ============================================================

(function () {
  "use strict";

  const controllerState = {
    container: null,
    car: null,
    players: [],
    options: {}
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

  function isDragReady() {
    return Boolean(
      window.JLYSeatDrag &&
      typeof window
        .JLYSeatDrag
        .bind === "function"
    );
  }

  // ------------------------------------------------------------
  // 容器
  // ------------------------------------------------------------

  function resolveContainer(
    container
  ) {
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
      document.querySelector(
        value
      ) ||
      document.getElementById(
        value.replace(/^#/, "")
      )
    );
  }

  // ------------------------------------------------------------
  // 拖曳完成
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

  if (nextSlots.length === 0) {
    console.error(
      "Seat Controller：沒有取得新的席位資料",
      actionResult
    );

    return;
  }

  if (controllerState.car) {
    controllerState.car.slots =
      JSON.parse(
        JSON.stringify(
          nextSlots
        )
      );
  }

  if (
    typeof controllerState
      .options
      .onSlotsChange ===
        "function"
  ) {
    controllerState.options
      .onSlotsChange(
        nextSlots,
        actionResult
      );
  }

  console.log(
  "Controller car.slots",
  controllerState.car.slots
);

  refresh();
}

function handleSeatMove(
  moveResult
) {
  applyActionResult(
    moveResult
  );
}
  // ------------------------------------------------------------
  // 啟動拖曳
  // ------------------------------------------------------------

  function bindDrag(
    boardData
  ) {
    if (!isDragReady()) {
      console.warn(
        "Seat Controller：Seat Drag 尚未載入"
      );

      return {
        success: false,
        reason:
          "Seat Drag 尚未載入"
      };
    }

    return window
      .JLYSeatDrag
      .bind({
        container:
          controllerState
            .container,

        slots:
          boardData.slots,

        onMove:
          handleSeatMove
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
      car;

    controllerState.players =
      Array.isArray(players)
        ? players
        : [];

    controllerState.options =
      options || {};

    const boardResult =
      window.JLYSeatBoard
        .render(
          target,
          car,
          players,
          options
        );

    if (
  boardResult &&
  boardResult.success &&
  (options?.draggable ?? true)
) {
  bindDrag(
    boardResult.boardData
  );
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
  applyActionResult
};
})();