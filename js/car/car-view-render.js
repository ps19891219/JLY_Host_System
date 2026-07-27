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
    const players =
      Array.isArray(car && car.players)
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

  // ============================================================
  // 工作人員
  // ============================================================

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
    if (
      Array.isArray(car && car.staffList) &&
      car.staffList.length > 0
    ) {
      return car.staffList
        .map(function (item, index) {
          return normalizeStaffItem(
            item,
            index,
            ""
          );
        })
        .filter(Boolean);
    }

    // 相容舊的 dmList
    if (
      Array.isArray(car && car.dmList) &&
      car.dmList.length > 0
    ) {
      return car.dmList
        .map(function (item, index) {
          return normalizeStaffItem(
            item,
            index,
            "DM"
          );
        })
        .filter(Boolean);
    }

    // 相容更舊的單一 DM 欄位
    const legacyDm =
      car &&
      (
        car.dm ||
        car.dmName
      );

    if (
      String(
        legacyDm || ""
      ).trim()
    ) {
      return [
        {
          id: "legacy-single-dm",
          title: "DM",
          name: String(
            legacyDm
          ).trim()
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
        '<span class="car-view-muted">' +
        "未提供" +
        "</span>"
      );
    }

    return (
      '<div class="car-view-staff-list">' +
      staffList
        .map(function (staff) {
          const titleHtml =
            staff.title
              ? (
                  '<span class="car-view-staff-title">' +
                  escapeHtml(
                    staff.title
                  ) +
                  "</span>" +
                  '<span class="car-view-staff-divider">' +
                  "｜" +
                  "</span>"
                )
              : "";

          return (
            '<div class="car-view-staff-item">' +
            titleHtml +
            '<span class="car-view-staff-name">' +
            escapeHtml(
              staff.name ||
              "未填姓名"
            ) +
            "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  // ============================================================
  // 人數與狀態
  // ============================================================

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
      : (
          male +
          female +
          flexible
        );
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

    const total =
      getTotal(car);

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
  // 金額
  // ============================================================

  function getPriceValue(car) {
    const candidates = [
      car && car.price,
      car && car.playerPrice,
      car && car.fee,
      car && car.amount
    ];

    for (
      let index = 0;
      index < candidates.length;
      index += 1
    ) {
      const value =
        candidates[index];

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
    const rawValue =
      getPriceValue(car);

    if (rawValue === null) {
      return "未提供";
    }

    const text =
      String(rawValue).trim();

    // 已包含文字或貨幣符號時，直接照原資料顯示
    if (
      /[^\d.,-]/.test(text)
    ) {
      return text;
    }

    const numberValue =
      Number(
        text.replace(
          /,/g,
          ""
        )
      );

    if (
      !Number.isFinite(
        numberValue
      )
    ) {
      return text;
    }

    return (
      "NT$" +
      numberValue.toLocaleString(
        "zh-TW"
      ) +
      "／人"
    );
  }

  // ============================================================
  // 資訊卡
  // ============================================================

  function renderInfoRow(
    icon,
    label,
    value,
    options
  ) {
    const settings =
      Object.assign(
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

    if (
      settings.emphasized
    ) {
      classNames.push(
        "is-emphasized"
      );
    }

    if (
      settings.fullWidth
    ) {
      classNames.push(
        "is-full-width"
      );
    }

    const valueHtml =
      settings.html
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

  // ============================================================
  // 報名與狀態按鈕
  // ============================================================

  function getActionHtml(
    status,
    carId
  ) {
    const joinUrl =
      "../pages/join.html?id=" +
      encodeURIComponent(
        carId || ""
      );

    if (
      status === "招募中"
    ) {
      return (
        '<a class="car-view-join-button" href="' +
        escapeHtml(joinUrl) +
        '">' +
        "我要報名" +
        "</a>"
      );
    }

    if (
      status === "已滿團"
    ) {
      return (
        '<div class="car-view-status-message">' +
        "此車團目前已滿團" +
        "</div>"
      );
    }

    if (
      status === "已結束"
    ) {
      return (
        '<div class="car-view-status-message">' +
        "此車團已結束" +
        "</div>"
      );
    }

    if (
      status === "已取消"
    ) {
      return (
        '<div class="car-view-status-message">' +
        "此車團已取消" +
        "</div>"
      );
    }

    return "";
  }

  // ============================================================
  // 主畫面
  // ============================================================

  function renderCarView(
    container,
    car,
    carId
  ) {
    if (!container) {
      return;
    }

    car = car || {};

    const players =
      getPlayers(car);

    const total =
      getTotal(car);

    const status =
      getStatus(car);

    const playerCountText =
      total > 0
        ? (
            players.length +
            " / " +
            total
          )
        : (
            players.length +
            " 人"
          );

    const note =
      car.publicNote ||
      car.note ||
      "";

    const studioText =
      car.studioName ||
      car.studio ||
      car.organizer ||
      "未提供";

    const infoHtml =
      renderInfoRow(
        "📅",
        "日期",
        car.gameDate ||
        car.date
      ) +

      renderInfoRow(
        "🕒",
        "時間",
        car.gameTime ||
        car.time
      ) +

      renderInfoRow(
        "📍",
        "地點",
        car.location
      ) +

      renderInfoRow(
        "🏠",
        "工作室",
        studioText
      ) +

      renderInfoRow(
        "🎭",
        "工作人員",
        renderStaffValue(car),
        {
          html: true,
          fullWidth: true
        }
      ) +

      renderInfoRow(
        "👥",
        "目前人數",
        playerCountText
      ) +

      renderInfoRow(
        "💰",
        "金額",
        formatPrice(car),
        {
          emphasized: true
        }
      );

    const noteHtml =
      note
        ? (
            '<section class="car-view-section">' +

            '<h2 class="car-view-section-title">' +
            "公開備註" +
            "</h2>" +

            '<div class="car-view-note">' +
            escapeHtml(note) +
            "</div>" +

            "</section>"
          )
        : "";

    container.innerHTML =
      '<article class="car-view-card">' +

      '<header class="car-view-header">' +

      '<div class="car-view-header-main">' +

      '<div class="car-view-eyebrow">' +
      "車團資訊" +
      "</div>" +

      '<h1 class="car-view-title">' +
      escapeHtml(
        getText(
          car.scriptName ||
          car.name,
          "未命名劇本"
        )
      ) +
      "</h1>" +

      "</div>" +

      '<div class="car-view-status" data-status="' +
      escapeHtml(status) +
      '">' +
      escapeHtml(status) +
      "</div>" +

      "</header>" +

      '<section class="car-view-info-card" aria-label="車團基本資訊">' +
      infoHtml +
      "</section>" +

      noteHtml +

      '<section class="car-view-section">' +

      '<div class="car-view-section-header">' +

      '<h2 class="car-view-section-title">' +
      "座位安排" +
      "</h2>" +

      '<span class="car-view-readonly-label">' +
      "僅供查看" +
      "</span>" +

      "</div>" +

      '<div id="carViewSeatMount">' +

      '<div class="car-view-seat-loading">' +
      "座位讀取中..." +
      "</div>" +

      "</div>" +

      "</section>" +

      '<div class="car-view-action">' +
      getActionHtml(
        status,
        carId
      ) +
      "</div>" +

            "</article>";

    const seatMount =
      document.getElementById(
        "carViewSeatMount"
      );

    if (
      seatMount &&
      window.JLYSeatController &&
      typeof window.JLYSeatController.render ===
        "function"
    ) {
      window.JLYSeatController.render(
        seatMount,
        car,
        car.players || [],
        {
          editable: false,
          draggable: false,
          showWaitingArea: false,
          showSummary: true
        }
      );

      return;
    }

    if (
      seatMount &&
      window.JLYSeatBoard &&
      typeof window.JLYSeatBoard.render ===
        "function"
    ) {
      window.JLYSeatBoard.render(
        seatMount,
        car,
        car.players || [],
        {
          editable: false,
          draggable: false,
          showWaitingArea: false,
          showSummary: true
        }
      );

      return;
    }

    if (seatMount) {
      seatMount.innerHTML =
        '<div class="car-view-seat-loading">' +
        "座位模組尚未準備完成" +
        "</div>";
    }
  }
  }

  // ============================================================
  // 載入與錯誤畫面
  // ============================================================

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

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYCarViewRender = {
    escapeHtml:
      escapeHtml,

    getPlayers:
      getPlayers,

    getStaffList:
      getStaffList,

    getTotal:
      getTotal,

    getStatus:
      getStatus,

    getPriceValue:
      getPriceValue,

    formatPrice:
      formatPrice,

    renderCarView:
      renderCarView,

    renderLoading:
      renderLoading,

    renderError:
      renderError
  };
})();