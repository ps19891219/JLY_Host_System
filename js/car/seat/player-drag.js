/*
====================================================

JLY Host System

Module：
Seat Player Drag V1

用途：
1. 辨識席位中的玩家拖曳
2. 辨識等待安排玩家拖曳
3. 辨識目標席位
4. 辨識等待安排區
5. 建立標準玩家移動請求
6. 交給 Player Move Pipeline 評估

目前階段：
- 已完成 Drag Start
- 已完成 Drop Target
- 已接 Player Move Pipeline
- 尚未由 Controller 正式儲存結果

規則：
- 不直接修改 slots
- 不直接修改 players
- 不直接寫入 Firestore
- 不影響原本 Seat Row Drag

依賴：
- window.JLYPlayerMovePipeline

====================================================
*/

console.log(
  "player-drag.js 已成功載入！"
);

(function () {
  "use strict";

  const dragState = {
    container:
      null,

    sourceType:
      "",

    playerId:
      "",

    sourceSlotId:
      "",

    sourceElement:
      null,

    targetElement:
      null
  };

  // ------------------------------------------------------------
  // 模組
  // ------------------------------------------------------------

  function getPipeline() {
    const pipeline =
      window.JLYPlayerMovePipeline;

    if (!pipeline) {
      throw new Error(
        "Player Move Pipeline 尚未載入"
      );
    }

    return pipeline;
  }

  function isReady() {
    return Boolean(
      window.JLYPlayerMovePipeline
    );
  }

  // ------------------------------------------------------------
  // 基礎工具
  // ------------------------------------------------------------

  function normalizeId(value) {
    return String(
      value || ""
    ).trim();
  }

  function getSeatRow(element) {
    if (!element) {
      return null;
    }

    return element.closest(
      "[data-seat-row]"
    );
  }

  function getSeatId(element) {
    const row =
      getSeatRow(element);

    if (!row) {
      return "";
    }

    return normalizeId(
      row.getAttribute(
        "data-slot-id"
      )
    );
  }

  function getSeatedPlayerElement(
    element
  ) {
    if (!element) {
      return null;
    }

    return element.closest(
      '[data-seat-player-drag="true"]'
    );
  }

  function getWaitingPlayerElement(
    element
  ) {
    if (!element) {
      return null;
    }

    return element.closest(
      '[data-waiting-player="true"]'
    );
  }

  function getWaitingArea(element) {
    if (!element) {
      return null;
    }

    return element.closest(
      '[data-seat-waiting-area="true"]'
    );
  }

  function getPlayerId(element) {
    if (!element) {
      return "";
    }

    return normalizeId(
      element.getAttribute(
        "data-player-id"
      )
    );
  }

  function getSourceSlotId(element) {
    if (!element) {
      return "";
    }

    return normalizeId(
      element.getAttribute(
        "data-source-slot-id"
      ) ||
      getSeatId(element)
    );
  }

  // ------------------------------------------------------------
  // 畫面狀態
  // ------------------------------------------------------------

  function clearTargetState() {
    if (dragState.targetElement) {
      dragState.targetElement
        .classList
        .remove(
          "is-player-drag-over"
        );
    }

    dragState.targetElement =
      null;
  }

  function clearDragState() {
    clearTargetState();

    if (dragState.sourceElement) {
      dragState.sourceElement
        .classList
        .remove(
          "is-player-dragging"
        );
    }

    dragState.sourceType =
      "";

    dragState.playerId =
      "";

    dragState.sourceSlotId =
      "";

    dragState.sourceElement =
      null;
  }

  function setTargetElement(element) {
    if (
      dragState.targetElement ===
      element
    ) {
      return;
    }

    clearTargetState();

    dragState.targetElement =
      element;

    if (element) {
      element.classList.add(
        "is-player-drag-over"
      );
    }
  }

  // ------------------------------------------------------------
  // Drag Start
  // ------------------------------------------------------------

  function handleDragStart(event) {
    const seatedElement =
      getSeatedPlayerElement(
        event.target
      );

    const waitingElement =
      getWaitingPlayerElement(
        event.target
      );

    const sourceElement =
      seatedElement ||
      waitingElement;

    if (!sourceElement) {
      return;
    }

    const playerId =
      getPlayerId(
        sourceElement
      );

    if (!playerId) {
      event.preventDefault();

      return;
    }

    const sourceType =
      seatedElement
        ? "seat"
        : "waiting";

    const sourceSlotId =
      seatedElement
        ? getSourceSlotId(
            seatedElement
          )
        : "";

    dragState.sourceType =
      sourceType;

    dragState.playerId =
      playerId;

    dragState.sourceSlotId =
      sourceSlotId;

    dragState.sourceElement =
      sourceElement;

    sourceElement.classList.add(
      "is-player-dragging"
    );

    if (event.dataTransfer) {
      event.dataTransfer
        .setData(
          "application/x-jly-player",
          JSON.stringify({
            sourceType,
            playerId,
            sourceSlotId
          })
        );

      event.dataTransfer
        .setData(
          "text/plain",
          playerId
        );

      event.dataTransfer
        .effectAllowed =
        "move";
    }

    console.log(
      "🧍 Player Drag Start：",
      {
        sourceType,
        playerId,
        sourceSlotId
      }
    );
  }

  // ------------------------------------------------------------
  // Drag Over
  // ------------------------------------------------------------

  function handleDragOver(event) {
    if (!dragState.playerId) {
      return;
    }

    const targetSeat =
      getSeatRow(
        event.target
      );

    const waitingArea =
      getWaitingArea(
        event.target
      );

    if (
      !targetSeat &&
      !waitingArea
    ) {
      clearTargetState();

      return;
    }

    if (targetSeat) {
      const targetSlotId =
        getSeatId(
          targetSeat
        );

      if (
        dragState.sourceType ===
          "seat" &&
        targetSlotId ===
          dragState.sourceSlotId
      ) {
        clearTargetState();

        return;
      }
    }

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer
        .dropEffect =
        "move";
    }

    setTargetElement(
      targetSeat ||
      waitingArea
    );
  }

  // ------------------------------------------------------------
  // 建立移動請求
  // ------------------------------------------------------------

  function createMoveRequest(
    event
  ) {
    const targetSeat =
      getSeatRow(
        event.target
      );

    const waitingArea =
      getWaitingArea(
        event.target
      );

    if (targetSeat) {
      return {
        sourceType:
          dragState.sourceType,

        targetType:
          "seat",

        playerId:
          dragState.playerId,

        sourceSlotId:
          dragState.sourceSlotId,

        targetSlotId:
          getSeatId(
            targetSeat
          )
      };
    }

    if (
      waitingArea &&
      dragState.sourceType ===
        "seat"
    ) {
      return {
        sourceType:
          "seat",

        targetType:
          "waiting",

        playerId:
          dragState.playerId,

        sourceSlotId:
          dragState.sourceSlotId,

        targetSlotId:
          ""
      };
    }

    return null;
  }

  // ------------------------------------------------------------
  // 執行 Pipeline
  // ------------------------------------------------------------

  function runPipeline(
    request,
    settings
  ) {
    const pipeline =
      getPipeline();

    if (
      request.sourceType ===
        "waiting" &&
      request.targetType ===
        "seat"
    ) {
      return pipeline
        .moveWaitingPlayerToSeat(
          settings.players,
          settings.slots,
          request.playerId,
          request.targetSlotId,
          {
            mode:
              window.JLYSeatRules
                .MODES.HOST
          }
        );
    }

    if (
      request.sourceType ===
        "seat" &&
      request.targetType ===
        "seat"
    ) {
      return pipeline
        .moveSeatedPlayer(
          settings.players,
          settings.slots,
          request.sourceSlotId,
          request.targetSlotId,
          {
            mode:
              window.JLYSeatRules
                .MODES.HOST
          }
        );
    }

    if (
      request.sourceType ===
        "seat" &&
      request.targetType ===
        "waiting"
    ) {
      return pipeline
        .movePlayerToWaiting(
          settings.players,
          settings.slots,
          request.playerId
        );
    }

    return {
      success:
        false,

      status:
        "failed",

      reason:
        "目前不支援這種玩家移動"
    };
  }

  // ------------------------------------------------------------
  // Drop
  // ------------------------------------------------------------

  function handleDrop(
    event,
    settings
  ) {
    if (!dragState.playerId) {
      return;
    }

    const request =
      createMoveRequest(
        event
      );

    event.preventDefault();
    event.stopPropagation();

    clearDragState();

    if (!request) {
      return;
    }

    let result;

    try {
      result =
        runPipeline(
          request,
          settings
        );
    } catch (error) {
      console.error(
        "Player Drag Pipeline 發生錯誤：",
        error
      );

      if (
        typeof settings.onError ===
          "function"
      ) {
        settings.onError(
          error
        );
      }

      return;
    }

    console.log(
      "🧍 Player Drag Result：",
      result
    );

    if (
      result.status ===
        "confirmation-required"
    ) {
      if (
        typeof settings
          .onConfirmationRequired ===
          "function"
      ) {
        settings
          .onConfirmationRequired(
            result
          );
      }

      return;
    }

    if (!result.success) {
      if (
        typeof settings.onError ===
          "function"
      ) {
        settings.onError(
          new Error(
            result.reason ||
            "玩家移動失敗"
          ),
          result
        );
      }

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
  // 綁定
  // ------------------------------------------------------------

  function bind(options) {
    const settings =
      options || {};

    const container =
      settings.container;

    if (
      !container ||
      !(
        container instanceof
        HTMLElement
      )
    ) {
      return {
        success:
          false,

        reason:
          "找不到 Player Drag 容器"
      };
    }

    if (!isReady()) {
      return {
        success:
          false,

        reason:
          "Player Move Pipeline 尚未載入"
      };
    }

    dragState.container =
      container;

    container.addEventListener(
      "dragstart",
      handleDragStart
    );

    container.addEventListener(
      "dragover",
      handleDragOver
    );

    container.addEventListener(
      "drop",
      function (event) {
        handleDrop(
          event,
          settings
        );
      }
    );

    container.addEventListener(
      "dragend",
      clearDragState
    );

    console.log(
      "✅ Seat Player Drag 已綁定"
    );

    return {
      success:
        true
    };
  }

  // ------------------------------------------------------------
  // 解除
  // ------------------------------------------------------------

  function unbind(container) {
    if (!container) {
      return;
    }

    container.removeEventListener(
      "dragstart",
      handleDragStart
    );

    container.removeEventListener(
      "dragover",
      handleDragOver
    );

    container.removeEventListener(
      "dragend",
      clearDragState
    );

    clearDragState();
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatPlayerDrag = {
    isReady,

    getSeatId,

    getPlayerId,

    createMoveRequest,

    runPipeline,

    bind,

    unbind,

    getState:
      function () {
        return {
          sourceType:
            dragState.sourceType,

          playerId:
            dragState.playerId,

          sourceSlotId:
            dragState.sourceSlotId
        };
      }
  };

  console.log(
    "✅ Seat Player Drag V1 已載入"
  );
})();