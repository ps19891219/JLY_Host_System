console.log("seat-render.js 已成功載入！");

// ============================================================
// JLY Host System
// Seat Engine V2 - Render
//
// 負責：
// 1. 畫出男位、女位、不限位分區
// 2. 畫出座位列
// 3. 畫出等待安排區
// 4. 提供拖曳需要的 DOM 標記
// 5. 顯示座位統計
//
// 不負責：
// - 修改座位資料
// - 安排玩家
// - Firestore 寫入
// - 綁定實際拖曳邏輯
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

  function getSeatLayout() {
    if (!window.JLYSeatLayout) {
      throw new Error(
        "JLYSeatLayout 尚未載入，請先載入 seat-layout.js"
      );
    }

    return window.JLYSeatLayout;
  }

  // ------------------------------------------------------------
  // HTML 安全處理
  // ------------------------------------------------------------

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ------------------------------------------------------------
  // 取得玩家顯示名稱
  // ------------------------------------------------------------

  function getWaitingPlayerName(
    waitingItem
  ) {
    const SeatData = getSeatData();

    if (!waitingItem) {
      return "未命名玩家";
    }

    const player =
      waitingItem.player ||
      waitingItem;

    return SeatData.getPlayerName(
      player
    );
  }

  function getWaitingPlayerId(
    waitingItem
  ) {
    if (!waitingItem) {
      return "";
    }

    return String(
      waitingItem.playerId ||
      waitingItem.id ||
      (
        waitingItem.player &&
        (
          waitingItem.player.playerId ||
          waitingItem.player.id
        )
      ) ||
      ""
    );
  }

  // ------------------------------------------------------------
  // 分區圖示
  // ------------------------------------------------------------

  function getSectionIcon(type) {
    if (type === "male") {
      return "♂";
    }

    if (type === "female") {
      return "♀";
    }

    return "◇";
  }

  // ------------------------------------------------------------
  // 座位狀態文字
  // ------------------------------------------------------------

  function getSeatStatusText(slot) {
    if (
      slot &&
      slot.playerId
    ) {
      return "已入座";
    }

    return "空位";
  }

  // ------------------------------------------------------------
  // 玩家名稱區
  //
  // 玩家名稱本身設 draggable，
  // 之後會用來實作「只拖玩家」。
  // ------------------------------------------------------------

  function renderPlayerContent(slot) {
    if (
      !slot ||
      !slot.playerId
    ) {
      return `
        <div class="seat-player seat-player-empty">
          <span class="seat-player-placeholder">
            等待安排
          </span>
        </div>
      `;
    }

    const playerName =
      (
        slot.player &&
        (
          slot.player.name ||
          slot.player.displayName
        )
      ) ||
      "未命名玩家";

    return `
      <div
        class="seat-player seat-player-occupied"
        draggable="true"
        data-seat-player-drag="true"
        data-player-id="${escapeHtml(
          slot.playerId
        )}"
        data-source-slot-id="${escapeHtml(
          slot.slotId
        )}"
      >
        <span class="seat-player-drag-icon">
          ⋮⋮
        </span>

        <span class="seat-player-name">
          ${escapeHtml(playerName)}
        </span>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 單一座位列
  //
  // 整列本身可拖曳：
  // data-seat-row-drag="true"
  //
  // 玩家名字也可單獨拖曳：
  // data-seat-player-drag="true"
  // ------------------------------------------------------------

  function renderSeatRow(slot) {
    const SeatLayout =
      getSeatLayout();

    const viewSlot =
      SeatLayout.buildSlotViewModel(
        slot
      );

    const statusClass =
      viewSlot.isOccupied
        ? "is-occupied"
        : "is-empty";

    return `
      <div
        class="seat-row ${statusClass}"
        draggable="true"
        data-seat-row="true"
        data-seat-row-drag="true"
        data-slot-id="${escapeHtml(
          viewSlot.slotId
        )}"
        data-slot-type="${escapeHtml(
          viewSlot.sectionType
        )}"
      >
        <div
          class="seat-row-handle"
          title="拖曳整列"
          aria-label="拖曳整列"
        >
          ☰
        </div>

        <div class="seat-row-main">
          <div class="seat-row-title-area">
            <span class="seat-row-title">
              ${escapeHtml(
                viewSlot.displayName
              )}
            </span>

            <span class="seat-row-status">
              ${escapeHtml(
                getSeatStatusText(
                  viewSlot
                )
              )}
            </span>
          </div>

          ${renderPlayerContent(
            viewSlot
          )}
        </div>

        <button
          type="button"
          class="seat-row-menu-button"
          data-seat-menu-button="true"
          data-slot-id="${escapeHtml(
            viewSlot.slotId
          )}"
          aria-label="座位選項"
        >
          ⋯
        </button>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 單一分區
  // ------------------------------------------------------------

  function renderSeatSection(section) {
    if (!section) {
      return "";
    }

    const rowsHtml =
      Array.isArray(section.slots)
        ? section.slots
            .map(renderSeatRow)
            .join("")
        : "";

    return `
      <section
        class="seat-section"
        data-seat-section="${escapeHtml(
          section.type
        )}"
      >
        <div class="seat-section-header">
          <div class="seat-section-title-area">
            <span class="seat-section-icon">
              ${escapeHtml(
                getSectionIcon(
                  section.type
                )
              )}
            </span>

            <h3 class="seat-section-title">
              ${escapeHtml(
                section.label
              )}
            </h3>
          </div>

          <div class="seat-section-count">
            ${Number(
              section.occupiedCount || 0
            )}
            /
            ${Number(
              section.totalCount || 0
            )}
          </div>
        </div>

        <div class="seat-section-list">
          ${rowsHtml}
        </div>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // 等候玩家列
  //
  // 玩家可以拖進指定空位。
  // ------------------------------------------------------------

  function renderWaitingPlayer(
    waitingItem
  ) {
    const playerId =
      getWaitingPlayerId(
        waitingItem
      );

    const playerName =
      getWaitingPlayerName(
        waitingItem
      );

    const waitingReason =
      String(
        waitingItem &&
        waitingItem.waitingReason
          ? waitingItem.waitingReason
          : ""
      ).trim();

    return `
      <div
        class="seat-waiting-player"
        draggable="true"
        data-waiting-player="true"
        data-player-id="${escapeHtml(
          playerId
        )}"
      >
        <div class="seat-waiting-player-main">
          <span class="seat-waiting-drag-icon">
            ⋮⋮
          </span>

          <span class="seat-waiting-player-name">
            ${escapeHtml(
              playerName
            )}
          </span>
        </div>

        ${
          waitingReason
            ? `
              <div class="seat-waiting-reason">
                ${escapeHtml(
                  waitingReason
                )}
              </div>
            `
            : ""
        }

        <button
          type="button"
          class="seat-auto-place-button"
          data-seat-auto-place="true"
          data-player-id="${escapeHtml(
            playerId
          )}"
        >
          自動安排
        </button>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 等候區
  // ------------------------------------------------------------

  function renderWaitingArea(
    waitingPlayers
  ) {
    const sourceWaiting =
      Array.isArray(waitingPlayers)
        ? waitingPlayers
        : [];

    const contentHtml =
      sourceWaiting.length > 0
        ? sourceWaiting
            .map(
              renderWaitingPlayer
            )
            .join("")
        : `
          <div class="seat-waiting-empty">
            目前沒有等待安排的玩家
          </div>
        `;

    return `
      <section
        class="seat-waiting-section"
        data-seat-waiting-area="true"
      >
        <div class="seat-section-header">
          <div class="seat-section-title-area">
            <span class="seat-section-icon">
              ⏳
            </span>

            <h3 class="seat-section-title">
              等待安排
            </h3>
          </div>

          <div class="seat-section-count">
            ${sourceWaiting.length}
          </div>
        </div>

        <div class="seat-waiting-list">
          ${contentHtml}
        </div>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // 統計列
  // ------------------------------------------------------------

  function renderSeatSummary(
    viewModel
  ) {
    return `
      <div class="seat-summary">
        <div class="seat-summary-item">
          <span class="seat-summary-label">
            已入座
          </span>

          <strong class="seat-summary-value">
            ${Number(
              viewModel.occupiedSeatCount ||
              0
            )}
          </strong>
        </div>

        <div class="seat-summary-item">
          <span class="seat-summary-label">
            空位
          </span>

          <strong class="seat-summary-value">
            ${Number(
              viewModel.emptySeatCount ||
              0
            )}
          </strong>
        </div>

        <div class="seat-summary-item">
          <span class="seat-summary-label">
            等待安排
          </span>

          <strong class="seat-summary-value">
            ${Number(
              viewModel.waitingCount ||
              0
            )}
          </strong>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 空座位狀態
  // ------------------------------------------------------------

  function renderNoSeats() {
    return `
      <div class="seat-empty-state">
        <div class="seat-empty-state-icon">
          🪑
        </div>

        <div class="seat-empty-state-title">
          尚未建立席位
        </div>

        <div class="seat-empty-state-text">
          請先設定男位、女位、不限位或總人數。
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 建立完整座位 HTML
  // ------------------------------------------------------------

  function buildSeatHtml(
    slots,
    waitingPlayers,
    options
  ) {
    const SeatLayout =
      getSeatLayout();

    const settings = {
      showSummary:
        true,

      showWaitingArea:
        true,

      includeEmptySections:
        false,

      ...(
        options || {}
      )
    };

    const viewModel =
      SeatLayout.buildViewModel(
        slots,
        waitingPlayers,
        {
          includeEmptySections:
            settings
              .includeEmptySections
        }
      );

    const sectionsHtml =
      viewModel.sections
        .map(renderSeatSection)
        .join("");

    const summaryHtml =
      settings.showSummary
        ? renderSeatSummary(
            viewModel
          )
        : "";

    const waitingHtml =
      settings.showWaitingArea
        ? renderWaitingArea(
            viewModel.waitingPlayers
          )
        : "";

    const seatBodyHtml =
      viewModel.totalSeatCount > 0
        ? sectionsHtml
        : renderNoSeats();

    return {
      html: `
        <div
          class="seat-engine"
          data-seat-engine="true"
        >
          ${summaryHtml}

          <div class="seat-engine-sections">
            ${seatBodyHtml}
          </div>

          ${waitingHtml}
        </div>
      `,

      viewModel
    };
  }

  // ------------------------------------------------------------
  // 畫進指定容器
  //
  // container 可以是：
  // 1. DOM 元素
  // 2. CSS selector
  // 3. id 字串
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

    const containerText =
      String(container);

    if (
      containerText.startsWith("#") ||
      containerText.startsWith(".") ||
      containerText.startsWith("[")
    ) {
      return document.querySelector(
        containerText
      );
    }

    return (
      document.getElementById(
        containerText
      ) ||
      document.querySelector(
        containerText
      )
    );
  }

  function render(
    container,
    slots,
    waitingPlayers,
    options
  ) {
    const targetContainer =
      resolveContainer(
        container
      );

    if (!targetContainer) {
      console.warn(
        "Seat Render：找不到指定容器",
        container
      );

      return {
        success: false,
        reason:
          "找不到座位顯示容器",
        viewModel: null
      };
    }

    const renderResult =
      buildSeatHtml(
        slots,
        waitingPlayers,
        options
      );

    targetContainer.innerHTML =
      renderResult.html;

    targetContainer
      .setAttribute(
        "data-seat-rendered",
        "true"
      );

    return {
      success: true,
      reason: "",
      container:
        targetContainer,
      viewModel:
        renderResult.viewModel
    };
  }

  // ------------------------------------------------------------
  // 更新單一玩家名稱
  //
  // 不重畫整區，
  // 之後主揪改顯示名稱時可以使用。
  // ------------------------------------------------------------

  function updatePlayerName(
    container,
    playerId,
    playerName
  ) {
    const targetContainer =
      resolveContainer(
        container
      );

    if (!targetContainer) {
      return false;
    }

    const normalizedPlayerId =
      String(playerId || "");

    const playerElement =
      targetContainer.querySelector(
        '[data-seat-player-drag="true"]' +
        '[data-player-id="' +
        CSS.escape(
          normalizedPlayerId
        ) +
        '"]'
      );

    if (!playerElement) {
      return false;
    }

    const nameElement =
      playerElement.querySelector(
        ".seat-player-name"
      );

    if (!nameElement) {
      return false;
    }

    nameElement.textContent =
      String(
        playerName ||
        "未命名玩家"
      );

    return true;
  }

  // ------------------------------------------------------------
  // 顯示操作錯誤
  // ------------------------------------------------------------

  function showActionMessage(
    container,
    message,
    type
  ) {
    const targetContainer =
      resolveContainer(
        container
      );

    if (!targetContainer) {
      return;
    }

    const oldMessage =
      targetContainer.querySelector(
        ".seat-action-message"
      );

    if (oldMessage) {
      oldMessage.remove();
    }

    const messageElement =
      document.createElement(
        "div"
      );

    messageElement.className =
      "seat-action-message " +
      (
        type === "error"
          ? "is-error"
          : "is-success"
      );

    messageElement.textContent =
      String(message || "");

    targetContainer.prepend(
      messageElement
    );

    window.setTimeout(
      function () {
        if (
          messageElement &&
          messageElement.parentNode
        ) {
          messageElement.remove();
        }
      },
      2500
    );
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatRender = {
    escapeHtml,

    getWaitingPlayerName,
    getWaitingPlayerId,

    getSectionIcon,
    getSeatStatusText,

    renderPlayerContent,
    renderSeatRow,
    renderSeatSection,

    renderWaitingPlayer,
    renderWaitingArea,

    renderSeatSummary,
    renderNoSeats,

    buildSeatHtml,
    resolveContainer,
    render,

    updatePlayerName,
    showActionMessage
  };
})();