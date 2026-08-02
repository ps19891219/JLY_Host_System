console.log(
  "seat-render.js V3 已成功載入！"
);

// ============================================================
// JLY Host System
// Seat Engine V3 - Render
//
// 負責：
// 1. 畫出男位、女位、不限位分區
// 2. 畫出座位列
// 3. 畫出待安排區
// 4. 提供拖曳需要的 DOM 標記
// 5. 顯示座位統計
// 6. 顯示玩家本人性別
// 7. 顯示右側玩家狀態欄
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
    return String(
      value == null
        ? ""
        : value
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ------------------------------------------------------------
  // 玩家基本資料
  //
  // 未來可直接搬至：
  // render/player-status-render.js
  // ------------------------------------------------------------

  function getPlayerSource(value) {
    if (!value) {
      return {};
    }

    if (
      value.player &&
      typeof value.player ===
        "object"
    ) {
      return value.player;
    }

    return value;
  }

  function getPlayerName(value) {
    const player =
      getPlayerSource(value);

    if (
      window.JLYSeatData &&
      typeof window
        .JLYSeatData
        .getPlayerName ===
        "function"
    ) {
      return window
        .JLYSeatData
        .getPlayerName(
          player
        );
    }

    return String(
      player.hostAlias ||
      player.displayName ||
      player.playerName ||
      player.name ||
      player.nickname ||
      "未命名玩家"
    );
  }

  function getPlayerId(value) {
    const player =
      getPlayerSource(value);

    return String(
      value.playerId ||
      value.id ||
      player.playerId ||
      player.id ||
      player.profileId ||
      player.applicationId ||
      ""
    );
  }

  function normalizeGender(value) {
    const text =
      String(value || "")
        .trim()
        .toLowerCase();

    if (
      text === "male" ||
      text === "男" ||
      text === "男性" ||
      text === "m"
    ) {
      return "male";
    }

    if (
      text === "female" ||
      text === "女" ||
      text === "女性" ||
      text === "f"
    ) {
      return "female";
    }

    return "";
  }

  function getPlayerGender(value) {
    const player =
      getPlayerSource(value);

    return normalizeGender(
      player.gender ||
      player.playerGender ||
      player.sex
    );
  }

  function getGenderSymbol(value) {
    const gender =
      getPlayerGender(value);

    if (gender === "male") {
      return "♂";
    }

    if (gender === "female") {
      return "♀";
    }

    return "";
  }

  function isCrossPlayPlayer(value) {
    const player =
      getPlayerSource(value);

    return (
      player.isCrossPlay === true
    );
  }

  // ------------------------------------------------------------
  // 玩家狀態欄
  // ------------------------------------------------------------

  function buildPlayerStatusItems(
    value
  ) {
    const items = [];

    if (
      isCrossPlayPlayer(value)
    ) {
      items.push({
        key:
          "cross-play",

        label:
          "反串",

        className:
          "is-cross-play"
      });
    }

    return items;
  }

  function renderPlayerStatusColumn(
    value
  ) {
    const items =
      buildPlayerStatusItems(
        value
      );

    const content =
      items.length > 0
        ? items
            .map(
              function (item) {
                return `
                  <span
                    class="seat-player-status-badge ${escapeHtml(
                      item.className
                    )}"
                    data-player-status="${escapeHtml(
                      item.key
                    )}"
                  >
                    ${escapeHtml(
                      item.label
                    )}
                  </span>
                `;
              }
            )
            .join("")
        : "";

    return `
      <span
        class="seat-player-status-column"
        aria-label="${
          items.length > 0
            ? escapeHtml(
                items
                  .map(
                    function (item) {
                      return item.label;
                    }
                  )
                  .join("、")
              )
            : ""
        }"
      >
        ${content}
      </span>
    `;
  }

  // ------------------------------------------------------------
  // 待安排玩家資料
  // ------------------------------------------------------------

  function getWaitingPlayerName(
    waitingItem
  ) {
    return getPlayerName(
      waitingItem
    );
  }

  function getWaitingPlayerId(
    waitingItem
  ) {
    return getPlayerId(
      waitingItem
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
  // 玩家列內容
  // ------------------------------------------------------------

  function renderGenderCell(value) {
    const symbol =
      getGenderSymbol(value);

    return `
      <span
        class="seat-player-gender"
        aria-label="${
          symbol === "♂"
            ? "男性"
            : symbol === "♀"
              ? "女性"
              : "未設定性別"
        }"
      >
        ${escapeHtml(symbol)}
      </span>
    `;
  }

  function renderPlayerContent(slot) {
    if (
      !slot ||
      !slot.playerId
    ) {
      return `
        <div
          class="seat-player seat-player-empty"
        >
          <span
            class="seat-player-placeholder"
          >
            等待安排
          </span>

          <span
            class="seat-player-status-column"
            aria-hidden="true"
          ></span>
        </div>
      `;
    }

    const player =
      slot.player || {};

    const playerName =
      getPlayerName(
        player
      );

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
        <span
          class="seat-player-identity"
        >
          ${renderGenderCell(
            player
          )}

          <span
            class="seat-player-name"
          >
            ${escapeHtml(
              playerName
            )}
          </span>
        </span>

        ${renderPlayerStatusColumn(
          player
        )}
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 單一座位列
  // ------------------------------------------------------------

  function renderSeatRow(slot) {
    const SeatLayout =
      getSeatLayout();

    const viewSlot =
      SeatLayout
        .buildSlotViewModel(
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

        <div
          class="seat-row-main"
        >
          <div
            class="seat-row-label-cell"
            data-seat-label-edit="true"
            data-slot-id="${escapeHtml(
              viewSlot.slotId
            )}"
            role="button"
            tabindex="0"
            title="點擊修改角色名稱"
          >
            ${escapeHtml(
              viewSlot.displayName
            )}
          </div>

          <div
            class="seat-row-player-cell"
          >
            ${renderPlayerContent(
              viewSlot
            )}
          </div>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 單一分區
  // ------------------------------------------------------------

  function renderSeatSection(
    section
  ) {
    if (!section) {
      return "";
    }

    const rowsHtml =
      Array.isArray(
        section.slots
      )
        ? section.slots
            .map(
              renderSeatRow
            )
            .join("")
        : "";

    return `
      <section
        class="seat-section"
        data-seat-section="${escapeHtml(
          section.type
        )}"
      >
        <div
          class="seat-section-header"
        >
          <div
            class="seat-section-title-area"
          >
            <span
              class="seat-section-icon"
            >
              ${escapeHtml(
                getSectionIcon(
                  section.type
                )
              )}
            </span>

            <h3
              class="seat-section-title"
            >
              ${escapeHtml(
                section.label
              )}
            </h3>
          </div>

          <div
            class="seat-section-count"
          >
            ${Number(
              section.occupiedCount ||
              0
            )}
            /
            ${Number(
              section.totalCount ||
              0
            )}
          </div>
        </div>

        <div
          class="seat-section-list"
        >
          ${rowsHtml}
        </div>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // 待安排玩家
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

    const player =
      getPlayerSource(
        waitingItem
      );

    const waitingReason =
      String(
        waitingItem &&
        waitingItem.waitingReason
          ? waitingItem
              .waitingReason
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
        <div
          class="seat-waiting-player-main"
        >
          <span
            class="seat-player-identity"
          >
            ${renderGenderCell(
              player
            )}

            <span
              class="seat-waiting-player-name"
            >
              ${escapeHtml(
                playerName
              )}
            </span>
          </span>

          ${renderPlayerStatusColumn(
            player
          )}
        </div>

        ${
          waitingReason
            ? `
              <div
                class="seat-waiting-reason"
              >
                ${escapeHtml(
                  waitingReason
                )}
              </div>
            `
            : ""
        }

        <div
          class="seat-waiting-drag-hint"
        >
          拖曳到席位進行安排
        </div>
      </div>
    `;
  }

    // ------------------------------------------------------------
  // 待安排區
  // ------------------------------------------------------------

  function renderWaitingArea(
    waitingPlayers
  ) {
    const sourceWaiting =
      Array.isArray(
        waitingPlayers
      )
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
          <div
            class="seat-waiting-empty"
          >
            目前沒有待安排的玩家
          </div>
        `;

    return `
      <section
        class="seat-waiting-section"
        data-seat-waiting-area="true"
      >
        <div
          class="seat-section-header"
        >
          <div
            class="seat-section-title-area"
          >
            <span
              class="seat-section-icon"
            >
              ⏳
            </span>

            <h3
              class="seat-section-title"
            >
              待安排
            </h3>
          </div>

          <div
            class="seat-section-count"
          >
            ${sourceWaiting.length}
          </div>
        </div>

        <div
          class="seat-waiting-list"
        >
          ${contentHtml}
        </div>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // 統計列
  //
  // 目前先保留原本三格。
  // 男位／女位統計會在下一階段由
  // Seat Layout 提供正式數值。
  // ------------------------------------------------------------

  function renderSeatSummary(
    viewModel
  ) {
    return `
      <div
        class="seat-summary"
      >
        <div
          class="seat-summary-item"
        >
          <span
            class="seat-summary-label"
          >
            已入座
          </span>

          <strong
            class="seat-summary-value"
          >
            ${Number(
              viewModel
                .occupiedSeatCount ||
              0
            )}
          </strong>
        </div>

        <div
          class="seat-summary-item"
        >
          <span
            class="seat-summary-label"
          >
            空位
          </span>

          <strong
            class="seat-summary-value"
          >
            ${Number(
              viewModel
                .emptySeatCount ||
              0
            )}
          </strong>
        </div>

        <div
          class="seat-summary-item"
        >
          <span
            class="seat-summary-label"
          >
            待安排
          </span>

          <strong
            class="seat-summary-value"
          >
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
  // 沒有席位
  // ------------------------------------------------------------

  function renderNoSeats() {
    return `
      <div
        class="seat-empty-state"
      >
        <div
          class="seat-empty-state-icon"
        >
          🪑
        </div>

        <div
          class="seat-empty-state-title"
        >
          尚未建立席位
        </div>

        <div
          class="seat-empty-state-text"
        >
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
        .map(
          renderSeatSection
        )
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
            viewModel
              .waitingPlayers
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

          <div
            class="seat-engine-sections"
          >
            ${seatBodyHtml}
          </div>

          ${waitingHtml}
        </div>
      `,

      viewModel
    };
  }

  // ------------------------------------------------------------
  // 找到顯示容器
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
  // Render
  // ------------------------------------------------------------

  function render(
    container,
    slots,
    waitingPlayers,
    options
  ) {
    const target =
      resolveContainer(
        container
      );

    if (!target) {
      return {
        success:
          false,

        reason:
          "找不到座位顯示容器",

        html:
          "",

        viewModel:
          null
      };
    }

    const result =
      buildSeatHtml(
        slots,
        waitingPlayers,
        options
      );

    target.innerHTML =
      result.html;

    return {
      success:
        true,

      reason:
        "",

      html:
        result.html,

      viewModel:
        result.viewModel,

      container:
        target
    };
  }

    // ------------------------------------------------------------
  // 操作訊息
  // ------------------------------------------------------------

  function showActionMessage(
    container,
    message,
    type
  ) {
    const target =
      resolveContainer(
        container
      );

    if (!target) {
      return;
    }

    const oldMessage =
      target.querySelector(
        ".seat-action-message"
      );

    if (oldMessage) {
      oldMessage.remove();
    }

    const messageBox =
      document.createElement(
        "div"
      );

    messageBox.className =
          "seat-action-message " +
      (
        type === "error"
          ? "is-error"
          : type === "success"
            ? "is-success"
            : "is-info"
      );

    messageBox.setAttribute(
      "role",
      type === "error"
        ? "alert"
        : "status"
    );

    messageBox.textContent =
      String(
        message || ""
      );

    target.prepend(
      messageBox
    );

    window.setTimeout(
      function () {
        if (
          messageBox &&
          messageBox.parentNode
        ) {
          messageBox.remove();
        }
      },
      2200
    );
  }

  // ------------------------------------------------------------
  // 更新單一玩家名稱
  //
  // 不重新畫整個 Seat Board。
  // 主揪修改顯示名稱後可以使用。
  // ------------------------------------------------------------

  function updatePlayerName(
    container,
    playerId,
    playerName
  ) {
    const target =
      resolveContainer(
        container
      );

    if (!target) {
      return {
        success:
          false,

        reason:
          "找不到座位顯示容器"
      };
    }

    const normalizedPlayerId =
      String(
        playerId || ""
      );

    const playerElements =
      target.querySelectorAll(
        "[data-player-id]"
      );

    let updatedCount = 0;

    playerElements.forEach(
      function (element) {
        const currentPlayerId =
          String(
            element.getAttribute(
              "data-player-id"
            ) || ""
          );

        if (
          currentPlayerId !==
          normalizedPlayerId
        ) {
          return;
        }

        const nameElement =
          element.querySelector(
            ".seat-player-name, .seat-waiting-player-name"
          );

        if (nameElement) {
          nameElement.textContent =
            String(
              playerName ||
              "未命名玩家"
            );

          updatedCount += 1;
        }
      }
    );

    return {
      success:
        updatedCount > 0,

      reason:
        updatedCount > 0
          ? ""
          : "找不到玩家顯示位置",

      updatedCount
    };
  }

  // ------------------------------------------------------------
  // 更新單一玩家狀態欄
  //
  // 未來付款、候補等狀態，
  // 可以沿用這個入口。
  // ------------------------------------------------------------

  function updatePlayerStatus(
    container,
    playerId,
    player
  ) {
    const target =
      resolveContainer(
        container
      );

    if (!target) {
      return {
        success:
          false,

        reason:
          "找不到座位顯示容器"
      };
    }

    const normalizedPlayerId =
      String(
        playerId || ""
      );

    const playerElements =
      target.querySelectorAll(
        "[data-player-id]"
      );

    let updatedCount = 0;

    playerElements.forEach(
      function (element) {
        const currentPlayerId =
          String(
            element.getAttribute(
              "data-player-id"
            ) || ""
          );

        if (
          currentPlayerId !==
          normalizedPlayerId
        ) {
          return;
        }

        const statusElement =
          element.querySelector(
            ".seat-player-status-column"
          );

        if (!statusElement) {
          return;
        }

        const statusHtml =
          renderPlayerStatusColumn(
            player
          );

        const wrapper =
          document.createElement(
            "div"
          );

        wrapper.innerHTML =
          statusHtml.trim();

        const nextStatusElement =
          wrapper.firstElementChild;

        if (nextStatusElement) {
          statusElement.replaceWith(
            nextStatusElement
          );

          updatedCount += 1;
        }
      }
    );

    return {
      success:
        updatedCount > 0,

      reason:
        updatedCount > 0
          ? ""
          : "找不到玩家狀態欄",

      updatedCount
    };
  }

  // ------------------------------------------------------------
  // 更新單一玩家性別符號
  // ------------------------------------------------------------

  function updatePlayerGender(
    container,
    playerId,
    player
  ) {
    const target =
      resolveContainer(
        container
      );

    if (!target) {
      return {
        success:
          false,

        reason:
          "找不到座位顯示容器"
      };
    }

    const normalizedPlayerId =
      String(
        playerId || ""
      );

    const playerElements =
      target.querySelectorAll(
        "[data-player-id]"
      );

    let updatedCount = 0;

    playerElements.forEach(
      function (element) {
        const currentPlayerId =
          String(
            element.getAttribute(
              "data-player-id"
            ) || ""
          );

        if (
          currentPlayerId !==
          normalizedPlayerId
        ) {
          return;
        }

        const genderElement =
          element.querySelector(
            ".seat-player-gender"
          );

        if (!genderElement) {
          return;
        }

        const symbol =
          getGenderSymbol(
            player
          );

        genderElement.textContent =
          symbol;

        genderElement.setAttribute(
          "aria-label",
          symbol === "♂"
            ? "男性"
            : symbol === "♀"
              ? "女性"
              : "未設定性別"
        );

        updatedCount += 1;
      }
    );

    return {
      success:
        updatedCount > 0,

      reason:
        updatedCount > 0
          ? ""
          : "找不到玩家性別欄位",

      updatedCount
    };
  }

  // ------------------------------------------------------------
  // 檢查模組狀態
  // ------------------------------------------------------------

  function isReady() {
    return Boolean(
      window.JLYSeatData &&
      window.JLYSeatLayout
    );
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYSeatRender = {
    isReady,

    escapeHtml,

    getPlayerSource,

    getPlayerName,

    getPlayerId,

    normalizeGender,

    getPlayerGender,

    getGenderSymbol,

    isCrossPlayPlayer,

    buildPlayerStatusItems,

    renderPlayerStatusColumn,

    getWaitingPlayerName,

    getWaitingPlayerId,

    getSectionIcon,

    renderGenderCell,

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

    showActionMessage,

    updatePlayerName,

    updatePlayerStatus,

    updatePlayerGender
  };

  console.log(
    "✅ Seat Render V3 已載入"
  );
})();