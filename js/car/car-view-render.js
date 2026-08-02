console.log("car-view-render.js 已成功載入！");

(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getText(value, fallback) {
    const text = String(
      value == null ? "" : value
    ).trim();

    return text || fallback || "未提供";
  }

  function getPlayers(car) {
    const players = Array.isArray(
      car && car.players
    )
      ? car.players
      : [];

    return players.filter(function (player) {
      if (!player) {
        return false;
      }

      const status = String(
        player.status || ""
      ).trim();

      return (
        status !== "已取消" &&
        status !== "取消" &&
        status !== "cancelled" &&
        status !== "canceled"
      );
    });
  }

  function normalizeStaffItem(
    item,
    index,
    legacyTitle
  ) {
    if (!item) {
      return null;
    }

    if (typeof item === "string") {
      const name = item.trim();

      if (!name) {
        return null;
      }

      return {
        id: "legacy-staff-" + index,
        title: legacyTitle || "",
        name: name
      };
    }

    const title = String(
      item.title ||
      item.role ||
      item.jobTitle ||
      item.staffTitle ||
      legacyTitle ||
      ""
    ).trim();

    const name = String(
      item.name ||
      item.displayName ||
      item.staffName ||
      item.dmName ||
      ""
    ).trim();

    if (!title && !name) {
      return null;
    }

    return {
      id:
        item.id ||
        item.staffId ||
        "staff-" + index,
      title: title,
      name: name
    };
  }

  function getStaffList(car) {
  const sourceCar =
    car || {};

  // ========================================
  // V2：正式工作人員席位
  // ========================================

  if (
    Array.isArray(
      sourceCar.staffSlots
    ) &&
    sourceCar.staffSlots.length > 0
  ) {
    return sourceCar.staffSlots
      .map(
        function (
          slot,
          index
        ) {
          const sourceSlot =
            slot || {};

          return {
            id:
              sourceSlot.id ||
              sourceSlot.slotId ||
              (
                "staff-slot-" +
                index
              ),

            order:
              Number(
                sourceSlot.order ||
                index + 1
              ),

            label:
              String(
                sourceSlot.label ||
                sourceSlot.roleLabel ||
                sourceSlot.title ||
                index + 1
              ).trim(),

            name:
              String(
                sourceSlot.displayName ||
                sourceSlot.name ||
                ""
              ).trim(),

            playerId:
              String(
                sourceSlot.playerId ||
                sourceSlot.profileId ||
                ""
              ).trim(),

            isCrossPlay:
              sourceSlot.isCrossPlay ===
                true ||
              (
                sourceSlot.player &&
                sourceSlot.player
                  .isCrossPlay === true
              ),

            player:
              sourceSlot.player &&
              typeof sourceSlot.player ===
                "object"
                ? {
                    ...sourceSlot.player
                  }
                : null
          };
        }
      )
      .sort(
        function (a, b) {
          return (
            Number(a.order || 0) -
            Number(b.order || 0)
          );
        }
      );
  }

  // ========================================
  // 舊版 staffList 相容
  // ========================================

  if (
    Array.isArray(
      sourceCar.staffList
    ) &&
    sourceCar.staffList.length > 0
  ) {
    return sourceCar.staffList
      .map(
        function (
          item,
          index
        ) {
          const staff =
            normalizeStaffItem(
              item,
              index,
              ""
            );

          if (!staff) {
            return null;
          }

          return {
            ...staff,

            order:
              index + 1,

            label:
              String(
                staff.title ||
                index + 1
              ),

            isCrossPlay:
              Boolean(
                item &&
                typeof item ===
                  "object" &&
                item.isCrossPlay ===
                  true
              )
          };
        }
      )
      .filter(Boolean);
  }

  // ========================================
  // 舊版 dmList 相容
  //
  // 只相容資料，不把 DM 寫死在席位名稱。
  // 席位仍顯示 1、2、3。
  // ========================================

  if (
    Array.isArray(
      sourceCar.dmList
    ) &&
    sourceCar.dmList.length > 0
  ) {
    return sourceCar.dmList
      .map(
        function (
          item,
          index
        ) {
          const staff =
            normalizeStaffItem(
              item,
              index,
              ""
            );

          if (!staff) {
            return null;
          }

          return {
            ...staff,

            order:
              index + 1,

            label:
              String(
                index + 1
              ),

            isCrossPlay:
              Boolean(
                item &&
                typeof item ===
                  "object" &&
                item.isCrossPlay ===
                  true
              )
          };
        }
      )
      .filter(Boolean);
  }

  // ========================================
  // 更舊版單一工作人員資料
  // ========================================

  const legacyDm =
    sourceCar.dm ||
    sourceCar.dmName;

  if (
    String(
      legacyDm || ""
    ).trim()
  ) {
    return [
      {
        id:
          "legacy-single-staff",

        order:
          1,

        label:
          "1",

        name:
          String(
            legacyDm
          ).trim(),

        isCrossPlay:
          false,

        player:
          null
      }
    ];
  }

  return [];
}

 function renderStaffValue(car) {
  const staffList =
    getStaffList(car);

  if (
    staffList.length === 0
  ) {
    return (
      '<div class="staff-seat-list">' +

      '<div class="seat-row staff-seat-row is-empty">' +

      '<div class="seat-row-handle" aria-hidden="true">' +
      "☰" +
      "</div>" +

      '<div class="seat-row-main">' +

      '<div class="seat-row-label-cell">' +
      "1" +
      "</div>" +

      '<div class="seat-row-player-cell">' +

      '<div class="seat-player seat-player-empty">' +

'<span class="seat-player-name-box">' +

'<span class="seat-player-placeholder">' +
'尚未安排' +
'</span>' +

'</span>' +

'</div>'
    );
  }

  return (
    '<div class="staff-seat-list">' +

    staffList
      .map(
        function (
          staff,
          index
        ) {
          const label =
            String(
              staff.label ||
              staff.order ||
              index + 1
            ).trim();

          const displayName =
            String(
              staff.name ||
              ""
            ).trim();

          const statusHtml =
            staff.isCrossPlay ===
              true
              ? (
                  '<span class="seat-player-status-column">' +

                  '<span class="seat-player-status-badge is-cross-play" ' +
                  'data-player-status="cross-play">' +
                  "反串" +
                  "</span>" +

                  "</span>"
                )
              : "";

          const playerHtml =
            displayName
              ? (
                  '<div class="seat-player seat-player-occupied">' +

                  '<span class="seat-player-name-box">' +

                  '<span class="seat-player-name">' +
                  escapeHtml(
                    displayName
                  ) +
                  "</span>" +

                  "</span>" +

                  statusHtml +

                  "</div>"
                )
              : (
                  '<div class="seat-player seat-player-empty">' +

                  '<span class="seat-player-placeholder">' +
                  "尚未安排" +
                  "</span>" +

                  "</div>"
                );

          return (
            '<div class="seat-row staff-seat-row ' +
            (
              displayName
                ? "is-occupied"
                : "is-empty"
            ) +
            '">' +

            '<div class="seat-row-handle" aria-hidden="true">' +
            "☰" +
            "</div>" +

            '<div class="seat-row-main">' +

            '<div class="seat-row-label-cell">' +
            escapeHtml(label) +
            "</div>" +

            '<div class="seat-row-player-cell">' +
            playerHtml +
            "</div>" +

            "</div>" +

            "</div>"
          );
        }
      )
      .join("") +

    "</div>"
  );
}

  function getTotal(car) {
    const total = Number(
      (
        car &&
        (
          car.totalPeople ||
          car.capacity
        )
      ) || 0
    );

    const male = Number(
      (
        car &&
        (
          car.maleSlots ||
          car.maleCount
        )
      ) || 0
    );

    const female = Number(
      (
        car &&
        (
          car.femaleSlots ||
          car.femaleCount
        )
      ) || 0
    );

    const flexible = Number(
      (
        car &&
        (
          car.flexibleSlots ||
          car.flexSlots ||
          car.anySlots ||
          car.flexibleCount
        )
      ) || 0
    );

    return total > 0
      ? total
      : male + female + flexible;
  }

  function getStatus(car) {
    const originalStatus =
      String(
        (
          car &&
          car.status
        ) || ""
      ).trim();

    if (
      originalStatus === "已取消" ||
      originalStatus === "取消"
    ) {
      return "已取消";
    }

    if (
      originalStatus === "已結束" ||
      originalStatus === "結束"
    ) {
      return "已結束";
    }

    const total = getTotal(car);

    if (total <= 0) {
      return (
        originalStatus ||
        "招募中"
      );
    }

    return (
      getPlayers(car).length >= total
        ? "已滿團"
        : "招募中"
    );
  }

    // ============================================================
  // 第 2 / 6 段
  // 金額、資訊列、報名狀態
  // ============================================================

  function getPriceValue(car) {
    const sourceCar = car || {};

    const candidates = [
      sourceCar.price,
      sourceCar.playerPrice,
      sourceCar.fee,
      sourceCar.amount,
      sourceCar.gamePrice,
      sourceCar.unitPrice
    ];

    for (
      let index = 0;
      index < candidates.length;
      index += 1
    ) {
      const value = candidates[index];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    return null;
  }

  function formatPrice(car) {
    const rawValue = getPriceValue(car);

    if (rawValue === null) {
      return "未提供";
    }

    const text = String(rawValue).trim();

    if (!text) {
      return "未提供";
    }

    /*
     * 如果原始內容已包含：
     * 元、NT$、每人、／人等文字，
     * 就保留原本格式。
     */
    if (/[^\d.,-]/.test(text)) {
      return text;
    }

    const numberValue = Number(
      text.replace(/,/g, "")
    );

    if (!Number.isFinite(numberValue)) {
      return text;
    }

    return (
      "NT$ " +
      numberValue.toLocaleString("zh-TW") +
      "／人"
    );
  }

  function getStudioText(car) {
    const sourceCar = car || {};

    return getText(
      sourceCar.studioName ||
        sourceCar.studio ||
        sourceCar.organizerName ||
        sourceCar.organizer,
      "未提供"
    );
  }

  function getLocationText(car) {
    const sourceCar = car || {};

    return getText(
      sourceCar.location ||
        sourceCar.address ||
        sourceCar.gameLocation,
      "未提供"
    );
  }

  function getDateText(car) {
    const sourceCar = car || {};

    return getText(
      sourceCar.gameDate ||
        sourceCar.date,
      "未提供"
    );
  }

  function getTimeText(car) {
    const sourceCar = car || {};

    return getText(
      sourceCar.gameTime ||
        sourceCar.time,
      "未提供"
    );
  }

  function renderInfoRow(
    icon,
    label,
    value,
    options
  ) {
    const settings = Object.assign(
      {
        html: false,
        emphasized: false,
        fullWidth: false
      },
      options || {}
    );

    const classNames = [
      "car-view-info-row"
    ];

    if (settings.emphasized) {
      classNames.push(
        "is-emphasized"
      );
    }

    if (settings.fullWidth) {
      classNames.push(
        "is-full-width"
      );
    }

    const valueHtml = settings.html
      ? value
      : escapeHtml(
          getText(
            value,
            "未提供"
          )
        );

    return (
      '<div class="' +
      classNames.join(" ") +
      '">' +

      '<div class="car-view-info-icon" aria-hidden="true">' +
      escapeHtml(icon) +
      "</div>" +

      '<div class="car-view-info-content">' +

      '<div class="car-view-info-label">' +
      escapeHtml(label) +
      "</div>" +

      '<div class="car-view-info-value">' +
      valueHtml +
      "</div>" +

      "</div>" +

      "</div>"
    );
  }

  function getJoinUrl(carId) {
    const id = String(
      carId || ""
    ).trim();

    return (
      "../pages/join.html?id=" +
      encodeURIComponent(id)
    );
  }

  function getActionHtml(
    status,
    carId
  ) {
    if (status === "招募中") {
      return (
        '<a class="car-view-join-button" href="' +
        escapeHtml(
          getJoinUrl(carId)
        ) +
        '">' +
        "我要報名" +
        "</a>"
      );
    }

    /*
     * 已滿團狀態已經直接顯示在 Header，
     * 不另外重複顯示「此車已滿團」。
     */
    if (status === "已滿團") {
      return "";
    }

    if (status === "已結束") {
      return (
        '<div class="car-view-status-message">' +
        "此車團已結束" +
        "</div>"
      );
    }

    if (status === "已取消") {
      return (
        '<div class="car-view-status-message">' +
        "此車團已取消" +
        "</div>"
      );
    }

    return "";
  }

  function getStatusDotHtml() {
    return (
      '<span class="car-view-status-dot" ' +
      'aria-hidden="true"></span>'
    );
  }

  function renderStatusBadge(status) {
    return (
      '<div class="car-view-status" ' +
      'data-status="' +
      escapeHtml(status) +
      '">' +

      getStatusDotHtml() +

      '<span class="car-view-status-text">' +
      escapeHtml(status) +
      "</span>" +

      "</div>"
    );
  }

    // ============================================================
  // 第 3 / 6 段
  // Seat Engine 唯讀顯示
  // ============================================================

  function getSeatSlots(car) {
    const sourceCar = car || {};

    const candidates = [
      sourceCar.seatSlots,
      sourceCar.slots,
      sourceCar.seats,
      sourceCar.seatLayout &&
        sourceCar.seatLayout.slots
    ];

    for (
      let index = 0;
      index < candidates.length;
      index += 1
    ) {
      if (
        Array.isArray(
          candidates[index]
        )
      ) {
        return candidates[index];
      }
    }

    return [];
  }

  function getWaitingPlayers(car) {
    const sourceCar = car || {};

    if (
      Array.isArray(
        sourceCar.waitingPlayers
      )
    ) {
      return sourceCar.waitingPlayers;
    }

    if (
      Array.isArray(
        sourceCar.unassignedPlayers
      )
    ) {
      return sourceCar.unassignedPlayers;
    }

    return [];
  }

  // ============================================================
// 玩家頁目前車配統計
//
// 顯示：
// 男位／女位／待入座
//
// 不顯示缺額。
// 不限角色依玩家本場實際選擇，
// 計入男位或女位。
// ============================================================

function normalizeSeatPosition(
  value
) {
  const text =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (
    text === "male" ||
    text === "男" ||
    text === "男位" ||
    text === "m"
  ) {
    return "male";
  }

  if (
    text === "female" ||
    text === "女" ||
    text === "女位" ||
    text === "f"
  ) {
    return "female";
  }

  return "flexible";
}

function getSeatPlayerId(slot) {
  const sourceSlot =
    slot || {};

  const player =
    sourceSlot.player &&
    typeof sourceSlot.player ===
      "object"
      ? sourceSlot.player
      : {};

  return String(
    sourceSlot.playerId ||
    player.playerId ||
    player.id ||
    player.profileId ||
    ""
  ).trim();
}

function getSeatPlayerPosition(
  slot
) {
  const sourceSlot =
    slot || {};

  const player =
    sourceSlot.player &&
    typeof sourceSlot.player ===
      "object"
      ? sourceSlot.player
      : {};

  const playerPosition =
    normalizeSeatPosition(
      player.playPosition ||
      player.currentPosition ||
      player.position ||
      player.requestedPosition
    );

  if (
    playerPosition === "male" ||
    playerPosition === "female"
  ) {
    return playerPosition;
  }

  return normalizeSeatPosition(
    sourceSlot.type ||
    sourceSlot.currentType ||
    sourceSlot.originalType
  );
}

function getCurrentSeatSummary(
  car
) {
  const slots =
    getSeatSlots(car);

  const players =
    getPlayers(car);

  const assignedPlayerIds =
    new Set();

  let maleCount = 0;
  let femaleCount = 0;

  slots.forEach(
    function (slot) {
      const playerId =
        getSeatPlayerId(
          slot
        );

      if (!playerId) {
        return;
      }

      assignedPlayerIds.add(
        playerId
      );

      const position =
        getSeatPlayerPosition(
          slot
        );

      if (
        position === "male"
      ) {
        maleCount += 1;
      } else if (
        position === "female"
      ) {
        femaleCount += 1;
      }
    }
  );

  const waitingCount =
    players.filter(
      function (
        player,
        index
      ) {
        const playerId =
          String(
            player.playerId ||
            player.id ||
            player.profileId ||
            player.applicationId ||
            (
              "legacy-player-" +
              index
            )
          ).trim();

        return (
          !assignedPlayerIds.has(
            playerId
          )
        );
      }
    ).length;

  return {
    maleCount,
    femaleCount,
    waitingCount
  };
}

function renderCurrentSeatSummary(
  car
) {
  const summary =
    getCurrentSeatSummary(
      car
    );

  return (
    '<div class="seat-summary car-view-current-summary">' +

    '<div class="seat-summary-item">' +

    '<span class="seat-summary-label">' +
    "男位" +
    "</span>" +

    '<strong class="seat-summary-value">' +
    String(
      summary.maleCount
    ) +
    "</strong>" +

    "</div>" +

    '<div class="seat-summary-item">' +

    '<span class="seat-summary-label">' +
    "女位" +
    "</span>" +

    '<strong class="seat-summary-value">' +
    String(
      summary.femaleCount
    ) +
    "</strong>" +

    "</div>" +

    '<div class="seat-summary-item">' +

    '<span class="seat-summary-label">' +
    "待入座" +
    "</span>" +

    '<strong class="seat-summary-value">' +
    String(
      summary.waitingCount
    ) +
    "</strong>" +

    "</div>" +

    "</div>"
  );
}

  function disableSeatInteraction(
    seatMount
  ) {
    if (!seatMount) {
      return;
    }

    seatMount
      .querySelectorAll(
        '[draggable="true"]'
      )
      .forEach(function (element) {
        element.setAttribute(
          "draggable",
          "false"
        );
      });

    seatMount
      .querySelectorAll(
        [
          "[data-seat-auto-place]",
          "[data-seat-label-edit]",
          ".seat-row-handle",
          ".seat-auto-place-button"
        ].join(",")
      )
      .forEach(function (element) {
        element.setAttribute(
          "aria-disabled",
          "true"
        );

        element.setAttribute(
          "tabindex",
          "-1"
        );

        if (
          element.tagName ===
          "BUTTON"
        ) {
          element.disabled = true;
        }
      });

    seatMount.setAttribute(
      "data-readonly",
      "true"
    );
  }

  function tryRenderWithController(
    seatMount,
    car,
    players,
    options
  ) {
    if (
      !window.JLYSeatController ||
      typeof window
        .JLYSeatController
        .render !== "function"
    ) {
      return false;
    }

    window.JLYSeatController.render(
      seatMount,
      car,
      players,
      options
    );

    return true;
  }

  function tryRenderWithBoard(
    seatMount,
    car,
    players,
    options
  ) {
    if (
      !window.JLYSeatBoard ||
      typeof window
        .JLYSeatBoard
        .render !== "function"
    ) {
      return false;
    }

    window.JLYSeatBoard.render(
      seatMount,
      car,
      players,
      options
    );

    return true;
  }

  function tryRenderWithSeatRender(
    seatMount,
    car,
    options
  ) {
    if (
      !window.JLYSeatRender ||
      typeof window
        .JLYSeatRender
        .render !== "function"
    ) {
      return false;
    }

    const slots =
      getSeatSlots(car);

    const waitingPlayers =
      getWaitingPlayers(car);

    window.JLYSeatRender.render(
      seatMount,
      slots,
      waitingPlayers,
      {
        showSummary:
          options.showSummary,

        showWaitingArea:
          options.showWaitingArea,

        includeEmptySections:
          true
      }
    );

    return true;
  }

  function renderSeatUnavailable(
    seatMount
  ) {
    seatMount.innerHTML =
      '<div class="car-view-seat-loading">' +
      "目前尚無座位安排" +
      "</div>";
  }

  function renderSeatError(
    seatMount
  ) {
    seatMount.innerHTML =
      '<div class="car-view-seat-loading">' +
      "座位顯示失敗，請重新整理" +
      "</div>";
  }

  function renderSeatBoard(car) {
    const seatMount =
      document.getElementById(
        "carViewSeatMount"
      );

    if (!seatMount) {
      return;
    }

    const players =
      getPlayers(car);

    const options = {
  editable: false,
  draggable: false,
  readonly: true,
  showWaitingArea: false,
  showSummary: false
};

    try {
      let rendered = false;

      rendered =
        tryRenderWithController(
          seatMount,
          car,
          players,
          options
        );

      if (!rendered) {
        rendered =
          tryRenderWithBoard(
            seatMount,
            car,
            players,
            options
          );
      }

      if (!rendered) {
        rendered =
          tryRenderWithSeatRender(
            seatMount,
            car,
            options
          );
      }

      if (!rendered) {
        renderSeatUnavailable(
          seatMount
        );

        return;
      }

      disableSeatInteraction(
        seatMount
      );
    } catch (error) {
      console.error(
        "玩家頁座位顯示失敗：",
        error
      );

      renderSeatError(
        seatMount
      );
    }
  }

    // ============================================================
  // 第 4 / 6 段
  // 建立玩家查看頁主要內容
  // ============================================================

  function getPlayerCountText(car) {
    const players =
      getPlayers(car);

    const total =
      getTotal(car);

    if (total > 0) {
      return (
        players.length +
        " / " +
        total +
        " 人"
      );
    }

    return (
      players.length +
      " 人"
    );
  }

  function getPublicNote(car) {
    const sourceCar = car || {};

    return String(
      sourceCar.publicNote ||
        sourceCar.note ||
        ""
    ).trim();
  }

  function renderNoteSection(car) {
    const note =
      getPublicNote(car);

    if (!note) {
      return "";
    }

    return (
      '<section class="car-view-section">' +

      '<h2 class="car-view-section-title">' +
      "公開備註" +
      "</h2>" +

      '<div class="car-view-note">' +
      escapeHtml(note) +
      "</div>" +

      "</section>"
    );
  }

  function renderSeatSection(car) {
  return (
    '<section class="car-view-section">' +

    '<div class="car-view-section-header">' +

    '<h2 class="car-view-section-title">' +
    "座位安排" +
    "</h2>" +

    '<span class="car-view-readonly-label">' +
    "僅供查看" +
    "</span>" +

    "</div>" +

    renderCurrentSeatSummary(
      car
    ) +

    '<div class="car-view-seat-staff">' +

    '<div class="car-view-seat-staff-title">' +
    "🎭 工作人員" +
    "</div>" +

    '<div class="car-view-seat-staff-content">' +
    renderStaffValue(car) +
    "</div>" +

    "</div>" +

    '<div id="carViewSeatMount">' +

    '<div class="car-view-seat-loading">' +
    "座位讀取中..." +
    "</div>" +

    "</div>" +

    "</section>"
  );
}

  function buildInfoHtml(car) {
    /*
     * 已依照討論結果調整順序：
     *
     * 1. 日期
     * 2. 時間
     * 3. 金額
     * 4. 目前人數
     * 5. 工作人員
     * 6. 工作室
     * 7. 地點
     */

    return (
      renderInfoRow(
        "📅",
        "日期",
        getDateText(car)
      ) +

      renderInfoRow(
        "🕒",
        "時間",
        getTimeText(car)
      ) +

      renderInfoRow(
        "💰",
        "金額",
        formatPrice(car),
        {
          emphasized: true
        }
      ) +

      renderInfoRow(
        "👥",
        "目前人數",
        getPlayerCountText(car)
      ) +

      renderInfoRow(
        "🏠",
        "工作室",
        getStudioText(car)
      ) +

      renderInfoRow(
        "📍",
        "地點",
        getLocationText(car),
        {
          fullWidth: true
        }
      )
    );
  }

  function buildHeaderHtml(
    car,
    status
  ) {
    const title = getText(
      car.scriptName ||
        car.name,
      "未命名劇本"
    );

    /*
     * Header 不再顯示「車團資訊」。
     * 只保留劇本名稱與狀態。
     */
    return (
      '<header class="car-view-header">' +

      '<div class="car-view-header-main">' +

      '<h1 class="car-view-title">' +
      escapeHtml(title) +
      "</h1>" +

      "</div>" +

      renderStatusBadge(status) +

      "</header>"
    );
  }

  function buildActionSectionHtml(
    status,
    carId
  ) {
    const actionHtml =
      getActionHtml(
        status,
        carId
      );

    if (!actionHtml) {
      return "";
    }

    return (
      '<div class="car-view-action">' +
      actionHtml +
      "</div>"
    );
  }

    // ============================================================
  // 第 5 / 6 段
  // 畫出完整頁面
  // ============================================================

  function renderCarView(
    container,
    car,
    carId
  ) {
    if (!container) {
      console.warn(
        "玩家查看頁找不到顯示容器"
      );

      return;
    }

    const sourceCar =
      car || {};

    const status =
      getStatus(sourceCar);

    const headerHtml =
      buildHeaderHtml(
        sourceCar,
        status
      );

    const infoHtml =
      buildInfoHtml(
        sourceCar
      );

    const noteHtml =
      renderNoteSection(
        sourceCar
      );

    const seatHtml =
  renderSeatSection(
    sourceCar
  );

    const actionHtml =
      buildActionSectionHtml(
        status,
        carId
      );

    container.innerHTML =
      '<article class="car-view-card">' +

      headerHtml +

      '<section class="car-view-info-card" ' +
      'aria-label="車團基本資訊">' +

      infoHtml +

      "</section>" +

      noteHtml +

      seatHtml +

      actionHtml +

      "</article>";

    renderSeatBoard(
      sourceCar
    );
  }

  function renderLoading(
    container
  ) {
    if (!container) {
      return;
    }

    container.innerHTML =
      '<div class="car-view-loading">' +
      "正在讀取車團資訊..." +
      "</div>";
  }

  function renderError(
    container,
    message
  ) {
    if (!container) {
      return;
    }

    container.innerHTML =
      '<div class="car-view-error">' +

      "<h2>" +
      "無法顯示車團資訊" +
      "</h2>" +

      "<p>" +

      escapeHtml(
        message ||
          "請稍後再試"
      ) +

      "</p>" +

      "</div>";
  }

  function renderNotFound(
    container
  ) {
    renderError(
      container,
      "找不到這個車團，可能已被刪除或連結不正確。"
    );
  }

  function refreshSeatBoard(car) {
    window.requestAnimationFrame(
      function () {
        renderSeatBoard(
          car || {}
        );
      }
    );
  }

    // ============================================================
  // 第 6 / 6 段
  // 對外公開
  // ============================================================

  window.JLYCarViewRender = {
    escapeHtml:
      escapeHtml,

    getText:
      getText,

    getPlayers:
      getPlayers,

    getStaffList:
      getStaffList,

    renderStaffValue:
      renderStaffValue,

    getTotal:
      getTotal,

    getStatus:
      getStatus,

    getPriceValue:
      getPriceValue,

    formatPrice:
      formatPrice,

    getStudioText:
      getStudioText,

    getLocationText:
      getLocationText,

    getDateText:
      getDateText,

    getTimeText:
      getTimeText,

    getPlayerCountText:
      getPlayerCountText,

    renderInfoRow:
      renderInfoRow,

    getJoinUrl:
      getJoinUrl,

    getActionHtml:
      getActionHtml,

    renderStatusBadge:
      renderStatusBadge,

    getSeatSlots:
      getSeatSlots,

    getWaitingPlayers:
      getWaitingPlayers,

      normalizeSeatPosition:
  normalizeSeatPosition,

getSeatPlayerId:
  getSeatPlayerId,

getSeatPlayerPosition:
  getSeatPlayerPosition,

getCurrentSeatSummary:
  getCurrentSeatSummary,

renderCurrentSeatSummary:
  renderCurrentSeatSummary,

    renderSeatBoard:
      renderSeatBoard,

    refreshSeatBoard:
      refreshSeatBoard,

    renderCarView:
      renderCarView,

    renderLoading:
      renderLoading,

    renderError:
      renderError,

    renderNotFound:
      renderNotFound
  };

})();