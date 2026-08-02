console.log(
  "seat-render.js V5 已成功載入！"
);

// ============================================================
// JLY Host System
// Seat Engine V5 - Render
//
// 負責：
// 1. 畫出男位、女位、不限位分區
// 2. 畫出座位列
// 3. 畫出待安排區
// 4. 提供拖曳需要的 DOM 標記
// 5. 顯示座位統計
// 6. 顯示玩家狀態
//
// 現行顯示規則：
// - 不顯示玩家本人性別符號
// - 玩家名字保留獨立名字框
// - 「反串」顯示於名字框外右側
// - 沒有反串時不顯示狀態標籤
//
// 不負責：
// - 修改座位資料
// - 安排玩家
// - Firestore 寫入
// - 綁定實際拖曳邏輯
// ============================================================

(function () {
  "use strict";

  // ============================================================
  // 模組取得
  // ============================================================

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

  // ============================================================
  // HTML 安全處理
  // ============================================================

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

  // ============================================================
  // 容器
  // ============================================================

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

  // ============================================================
  // 玩家資料
  //
  // 未來可以直接拆到：
  // render/player-card-render.js
  // ============================================================

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
    const source =
      value || {};

    const player =
      getPlayerSource(value);

    return String(
      source.playerId ||
      source.id ||
      player.playerId ||
      player.id ||
      player.profileId ||
      player.applicationId ||
      ""
    );
  }

  function isCrossPlayPlayer(
    value
  ) {
    const player =
      getPlayerSource(value);

    return (
      player.isCrossPlay === true
    );
  }

  // ============================================================
  // 狀態欄
  //
  // 現階段只顯示「反串」。
  // 未來新增其他狀態時，可在這裡延伸，
  // 不需要修改玩家名字框。
  // ============================================================

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

    if (items.length === 0) {
      return "";
    }

    const itemsHtml =
      items
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
        .join("");

    return `
      <span
        class="seat-player-status-column"
        aria-label="${escapeHtml(
          items
            .map(
              function (item) {
                return item.label;
              }
            )
            .join("、")
        )}"
      >
        ${itemsHtml}
      </span>
    `;
  }

  // ============================================================
  // 分區圖示
  // ============================================================

  function getSectionIcon(type) {
    if (type === "male") {
      return "♂";
    }

    if (type === "female") {
      return "♀";
    }

    return "◇";
  }

  // ============================================================
  // 玩家名字框
  // ============================================================

  function renderPlayerNameBox(
    player
  ) {
    return `
      <span
        class="seat-player-name-box"
      >
        <span
          class="seat-player-name"
        >
          ${escapeHtml(
            getPlayerName(player)
          )}
        </span>
      </span>
    `;
  }

  // ============================================================
  // 座位內玩家
  // ============================================================

  function renderPlayerContent(
    slot
  ) {
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
        </div>
      `;
    }

    const player =
      slot.player || {};

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
        ${renderPlayerNameBox(
          player
        )}

        ${renderPlayerStatusColumn(
          player
        )}
      </div>
    `;
  }

  // ============================================================
  // 單一座位列
  // ============================================================

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

  // ============================================================
  // 單一分區
  // ============================================================

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

  // ============================================================
  // 待安排玩家
  // ============================================================

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

  function renderWaitingPlayer(
    waitingItem
  ) {
    const playerId =
      getWaitingPlayerId(
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
          ${renderPlayerNameBox(
            player
          )}

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

  // ============================================================
  // 待安排區
  // ============================================================

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

  // ============================================================
// 目前車配統計
//
// 顯示：
// 男位／女位／待入座
//
// 規則：
// - 男位區入座者計入男位
// - 女位區入座者計入女位
// - 不限位依玩家本場選擇的男位／女位計算
// - 待入座顯示尚未放進任何席位的人數
// - 不負責顯示缺額，缺額直接看下方空位
// ============================================================

function normalizePlayerPosition(
  value
) {
  const text =
    String(
      value == null
        ? ""
        : value
    )
      .trim()
      .toLowerCase();

  if (
    text === "male" ||
    text === "m" ||
    text === "男" ||
    text === "男位" ||
    text === "boy"
  ) {
    return "male";
  }

  if (
    text === "female" ||
    text === "f" ||
    text === "女" ||
    text === "女位" ||
    text === "girl"
  ) {
    return "female";
  }

  return "";
}

// ============================================================
// 取得玩家本場實際選擇位置
// ============================================================

function getPlayerActualPosition(
  value
) {
  const source =
    value || {};

  const player =
    getPlayerSource(
      value
    );

  const candidates = [
    player.currentPosition,
    player.playPosition,
    player.position,
    player.requestedPosition,
    player.selectedPosition,
    player.genderPosition,

    source.currentPosition,
    source.playPosition,
    source.position,
    source.requestedPosition,
    source.selectedPosition
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const normalized =
      normalizePlayerPosition(
        candidates[index]
      );

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

// ============================================================
// 取得座位所屬分區
// ============================================================

function getSlotSectionType(
  slot
) {
  const source =
    slot || {};

  const candidates = [
    source.sectionType,
    source.slotType,
    source.type,
    source.currentType,
    source.originalType,
    source.positionType
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const normalized =
      normalizePlayerPosition(
        candidates[index]
      );

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

// ============================================================
// 計算目前男位／女位／待入座
// ============================================================

function getCurrentSeatSummary(
  viewModel
) {
  const safeViewModel =
    viewModel || {};

  const sections =
    Array.isArray(
      safeViewModel.sections
    )
      ? safeViewModel.sections
      : [];

  let maleCount = 0;
  let femaleCount = 0;

  sections.forEach(
    function (section) {
      const safeSection =
        section || {};

      const sectionType =
        normalizePlayerPosition(
          safeSection.type ||
          safeSection.sectionType
        );

      const slots =
        Array.isArray(
          safeSection.slots
        )
          ? safeSection.slots
          : [];

      slots.forEach(
        function (slot) {
          const safeSlot =
            slot || {};

          if (
            !safeSlot.playerId
          ) {
            return;
          }

          /*
           * 男位區、女位區直接以目前所在分區為準。
           *
           * 不限位則讀取玩家本場實際選擇，
           * 將其併入男位或女位統計。
           */
          let actualPosition =
            sectionType;

          if (
            actualPosition !==
              "male" &&
            actualPosition !==
              "female"
          ) {
            actualPosition =
              getPlayerActualPosition(
                safeSlot
              );
          }

          /*
           * 若 section.type 使用 flexible／any，
           * 但 slot 本身保存了男位或女位，
           * 再從 slot 資料補一次。
           */
          if (
            actualPosition !==
              "male" &&
            actualPosition !==
              "female"
          ) {
            actualPosition =
              getSlotSectionType(
                safeSlot
              );
          }

          if (
            actualPosition ===
            "male"
          ) {
            maleCount += 1;
          } else if (
            actualPosition ===
            "female"
          ) {
            femaleCount += 1;
          }
        }
      );
    }
  );

  return {
    maleCount,

    femaleCount,

    waitingCount:
      Number(
        safeViewModel.waitingCount ||
        (
          Array.isArray(
            safeViewModel.waitingPlayers
          )
            ? safeViewModel
                .waitingPlayers
                .length
            : 0
        )
      )
  };
}

// ============================================================
// 統計列
// ============================================================

function renderSeatSummary(
  viewModel
) {
  const summary =
    getCurrentSeatSummary(
      viewModel
    );

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
          男位
        </span>

        <strong
          class="seat-summary-value"
        >
          ${Number(
            summary.maleCount || 0
          )}
        </strong>
      </div>

      <div
        class="seat-summary-item"
      >
        <span
          class="seat-summary-label"
        >
          女位
        </span>

        <strong
          class="seat-summary-value"
        >
          ${Number(
            summary.femaleCount || 0
          )}
        </strong>
      </div>

      <div
        class="seat-summary-item"
      >
        <span
          class="seat-summary-label"
        >
          待入座
        </span>

        <strong
          class="seat-summary-value"
        >
          ${Number(
            summary.waitingCount || 0
          )}
        </strong>
      </div>
    </div>
  `;
}
  // ============================================================
  // 尚未建立座位
  // ============================================================

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

  // ============================================================
  // 建立完整 HTML
  // ============================================================

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

  // ============================================================
  // Render
  // ============================================================

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

  // ============================================================
  // 操作訊息
  // ============================================================

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

  // ============================================================
  // 局部更新玩家名稱
  // ============================================================

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

    const targetPlayerId =
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
          targetPlayerId
        ) {
          return;
        }

        const nameElement =
          element.querySelector(
            ".seat-player-name"
          );

        if (!nameElement) {
          return;
        }

        nameElement.textContent =
          String(
            playerName ||
            "未命名玩家"
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
          : "找不到玩家顯示位置",

      updatedCount
    };
  }

  // ============================================================
  // 局部更新玩家狀態
  // ============================================================

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

    const targetPlayerId =
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
          targetPlayerId
        ) {
          return;
        }

        const oldStatus =
          element.querySelector(
            ".seat-player-status-column"
          );

        const statusHtml =
          renderPlayerStatusColumn(
            player
          );

        if (!statusHtml) {
          if (oldStatus) {
            oldStatus.remove();

            updatedCount += 1;
          }

          return;
        }

        const wrapper =
          document.createElement(
            "div"
          );

        wrapper.innerHTML =
          statusHtml.trim();

        const nextStatus =
          wrapper.firstElementChild;

        if (!nextStatus) {
          return;
        }

        if (oldStatus) {
          oldStatus.replaceWith(
            nextStatus
          );
        } else {
          element.appendChild(
            nextStatus
          );
        }

        updatedCount += 1;
      }
    );

    return {
      success:
        updatedCount > 0,

      reason:
        updatedCount > 0
          ? ""
          : "找不到玩家狀態位置",

      updatedCount
    };
  }

  // ============================================================
  // 模組狀態
  // ============================================================

  function isReady() {
    return Boolean(
      window.JLYSeatData &&
      window.JLYSeatLayout
    );
  }

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYSeatRender = {
    isReady,

    escapeHtml,

    resolveContainer,

    getPlayerSource,

    getPlayerName,

    getPlayerId,

    isCrossPlayPlayer,

    buildPlayerStatusItems,

    renderPlayerStatusColumn,

    renderPlayerNameBox,

    getSectionIcon,

    renderPlayerContent,

    renderSeatRow,

    renderSeatSection,

    getWaitingPlayerName,

    getWaitingPlayerId,

    renderWaitingPlayer,

    renderWaitingArea,

normalizePlayerPosition,

getPlayerActualPosition,

getSlotSectionType,

getCurrentSeatSummary,

renderSeatSummary,

    renderNoSeats,

    buildSeatHtml,

    render,

    showActionMessage,

    updatePlayerName,

    updatePlayerStatus
  };

  console.log(
    "✅ Seat Render V5 已載入"
  );
})();