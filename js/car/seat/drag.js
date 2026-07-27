console.log(
  "seat-drag.js V1 已成功載入！"
);

// ============================================================
// JLY Host System
// Seat Drag Controller V1
//
// 負責：
// 1. 從左側拖曳把手啟動整列拖曳
// 2. 判斷來源座位與目標座位
// 3. 呼叫 JLYSeatActions.moveSeatRow()
// 4. 回傳移動結果給 Seat Board
// 5. 管理拖曳中的畫面狀態
//
// 不負責：
// - 直接修改 Firestore
// - 直接建立座位資料
// - 玩家交換
// - 等候區玩家拖曳
// ============================================================

(function () {
  "use strict";

  const dragState = {
    container: null,
    sourceSlotId: "",
    armedSlotId: "",
    sourceRow: null,
    targetRow: null
  };

  // ------------------------------------------------------------
  // 模組檢查
  // ------------------------------------------------------------

  function getSeatActions() {
    if (
      !window.JLYSeatActions ||
      typeof window
        .JLYSeatActions
        .moveSeatRow !== "function"
    ) {
      throw new Error(
        "JLYSeatActions 尚未載入"
      );
    }

    return window.JLYSeatActions;
  }

  function isReady() {
    return Boolean(
      window.JLYSeatActions &&
      typeof window
        .JLYSeatActions
        .moveSeatRow === "function"
    );
  }

  // ------------------------------------------------------------
  // 基本工具
  // ------------------------------------------------------------

  function getSlotId(element) {
    if (!element) {
      return "";
    }

    const row =
      element.closest(
        "[data-seat-row]"
      );

    if (!row) {
      return "";
    }

    return String(
      row.getAttribute(
        "data-slot-id"
      ) || ""
    );
  }

  function getSeatRow(element) {
    if (!element) {
      return null;
    }

    return element.closest(
      "[data-seat-row]"
    );
  }

  function clearTargetState() {
    if (dragState.targetRow) {
      dragState.targetRow
        .classList
        .remove(
          "is-drag-over"
        );
    }

    dragState.targetRow =
      null;
  }

  function clearDragState() {
    clearTargetState();

    if (dragState.sourceRow) {
      dragState.sourceRow
        .classList
        .remove(
          "is-dragging"
        );

      dragState.sourceRow
        .setAttribute(
          "draggable",
          "false"
        );
    }

    dragState.sourceSlotId =
      "";

    dragState.armedSlotId =
      "";

    dragState.sourceRow =
      null;
  }

  function prepareRows(container) {
    const rows =
      container.querySelectorAll(
        "[data-seat-row]"
      );

    rows.forEach(
      function (row) {
        row.setAttribute(
          "draggable",
          "false"
        );
      }
    );
  }

  // ------------------------------------------------------------
  // 啟動拖曳
  //
  // 只有按住左側拖曳把手，才允許整列拖曳。
  // ------------------------------------------------------------

  function handlePointerDown(event) {

    console.log("🟢 Handle Pointer Down");

    const handle =
      event.target.closest(
        ".seat-row-handle"
      );

    if (!handle) {
      return;
    }

    const row =
      getSeatRow(handle);

    const slotId =
      getSlotId(handle);

    if (
      !row ||
      !slotId
    ) {
      return;
    }

    dragState.armedSlotId =
      slotId;

    row.setAttribute(
      "draggable",
      "true"
    );
  }

  function handlePointerUp() {
    if (
      dragState.sourceSlotId
    ) {
      return;
    }

    if (
      !dragState.armedSlotId ||
      !dragState.container
    ) {
      return;
    }

    const escapedSlotId =
      window.CSS &&
      typeof window.CSS.escape ===
        "function"
        ? window.CSS.escape(
            dragState.armedSlotId
          )
        : dragState.armedSlotId;

    const row =
      dragState.container
        .querySelector(
          `[data-seat-row][data-slot-id="${escapedSlotId}"]`
        );

    if (row) {
      row.setAttribute(
        "draggable",
        "false"
      );
    }

    dragState.armedSlotId =
      "";
  }

  // ------------------------------------------------------------
  // Drag Start
  // ------------------------------------------------------------

  function handleDragStart(event) {
    const row =
      getSeatRow(
        event.target
      );

    if (!row) {
      return;
    }

    const slotId =
      getSlotId(row);

    if (
      !slotId ||
      slotId !==
        dragState.armedSlotId
    ) {
      event.preventDefault();

      row.setAttribute(
        "draggable",
        "false"
      );

      return;
    }

    dragState.sourceSlotId =
      slotId;

    dragState.sourceRow =
      row;

    row.classList.add(
      "is-dragging"
    );

    if (event.dataTransfer) {
      event.dataTransfer
        .setData(
          "text/plain",
          slotId
        );

      event.dataTransfer
        .effectAllowed =
          "move";
    }
  }

  // ------------------------------------------------------------
  // Drag Over
  // ------------------------------------------------------------

  function handleDragOver(event) {
    if (
      !dragState.sourceSlotId
    ) {
      return;
    }

    const targetRow =
      getSeatRow(
        event.target
      );

    if (!targetRow) {
      clearTargetState();
      return;
    }

    const targetSlotId =
      getSlotId(
        targetRow
      );

    if (
      !targetSlotId ||
      targetSlotId ===
        dragState.sourceSlotId
    ) {
      clearTargetState();
      return;
    }

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer
        .dropEffect =
          "move";
    }

    if (
      dragState.targetRow !==
      targetRow
    ) {
      clearTargetState();

      dragState.targetRow =
        targetRow;

      targetRow.classList.add(
        "is-drag-over"
      );
    }
  }

  // ------------------------------------------------------------
  // Drop
  // ------------------------------------------------------------

  function handleDrop(
    event,
    settings
  ) {
    if (
      !dragState.sourceSlotId
    ) {
      return;
    }

    const targetRow =
      getSeatRow(
        event.target
      );

    if (!targetRow) {
      clearDragState();
      return;
    }

    const targetSlotId =
      getSlotId(
        targetRow
      );

    if (
      !targetSlotId ||
      targetSlotId ===
        dragState.sourceSlotId
    ) {
      clearDragState();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const SeatActions =
      getSeatActions();

    const result =
      SeatActions.moveSeatRow(
        settings.slots,
        dragState.sourceSlotId,
        targetSlotId
      );

    clearDragState();

    if (!result.success) {
      alert(
        result.reason ||
        "座位移動失敗"
      );

      return;
    }

    if (
      typeof settings.onMove ===
      "function"
    ) {
      settings.onMove(
        result
      );
    }
  }

  // ------------------------------------------------------------
  // Drag End
  // ------------------------------------------------------------

  function handleDragEnd() {
    clearDragState();
  }

  // ------------------------------------------------------------
  // 綁定拖曳
  // ------------------------------------------------------------

  function bind(options) {
    const settings =
      options || {};

    const container =
      settings.container;

    if (
      !container ||
      !(container instanceof HTMLElement)
    ) {
      return {
        success: false,
        reason:
          "找不到 Seat Drag 顯示容器"
      };
    }

    if (!isReady()) {
      return {
        success: false,
        reason:
          "Seat Actions 尚未載入"
      };
    }

    dragState.container =
      container;

      console.log("✅ Seat Drag 已綁定");

    prepareRows(
      container
    );

    container.onpointerdown =
      function (event) {
        handlePointerDown(
          event
        );
      };

    container.onpointerup =
      handlePointerUp;

    container.onpointercancel =
      handlePointerUp;

    container.ondragstart =
      function (event) {
        handleDragStart(
          event
        );
      };

    container.ondragover =
      function (event) {
        handleDragOver(
          event
        );
      };

    container.ondrop =
      function (event) {
        handleDrop(
          event,
          settings
        );
      };

    container.ondragend =
      handleDragEnd;

    return {
      success: true
    };
  }

  // ------------------------------------------------------------
  // 解除拖曳
  // ------------------------------------------------------------

  function unbind(container) {
    if (!container) {
      return;
    }

    container.onpointerdown =
      null;

    container.onpointerup =
      null;

    container.onpointercancel =
      null;

    container.ondragstart =
      null;

    container.ondragover =
      null;

    container.ondrop =
      null;

    container.ondragend =
      null;

    clearDragState();
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatDrag = {
    isReady,
    bind,
    unbind
  };
})();