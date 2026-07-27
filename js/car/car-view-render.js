console.log(
  "car-view-render.js 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // 基本工具
  // ============================================================

  function escapeHtml(value) {
    return String(
      value == null ? "" : value
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getText(
    value,
    fallback = "未提供"
  ) {
    const text = String(
      value == null ? "" : value
    ).trim();

    return text || fallback;
  }

  function getPlayers(car) {
    const players =
      Array.isArray(car.players)
        ? car.players
        : [];

    return players.filter(
      function (player) {
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
      }
    );
  }

  // ============================================================
  // 工作人員
  // ============================================================

  function normalizeStaffItem(
    item,
    index
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
        title: "",
        name
      };
    }

    const title = String(
      item.title ||
      item.role ||
      item.jobTitle ||
      item.staffTitle ||
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

      title,
      name
    };
  }

  function getStaffList(car) {
    // 新版資料優先
    if (
      Array.isArray(car.staffList) &&
      car.staffList.length > 0
    ) {
      return car.staffList
        .map(normalizeStaffItem)
        .filter(Boolean);
    }

    // 舊版 dmList 相容
    if (
      Array.isArray(car.dmList) &&
      car.dmList.length > 0
    ) {
      return car.dmList
        .map(function (item, index) {
          return normalizeStaffItem(
            item,
            index
          );
        })
        .filter(Boolean);
    }

    // 更舊的單一 DM 欄位相容
    const legacyName =
      car.dm ||
      car.dmName ||
      "";

    if (String(legacyName).trim()) {
      return [
        {
          id: "legacy-single-dm",
          title: "",
          name: String(
            legacyName
          ).trim()
        }
      ];
    }

    return [];
  }

  function renderStaffValue(car) {
    const staffList =
      getStaffList(car);

    if (staffList.length === 0) {
      return `
        <span class="car-view-muted">
          未提供
        </span>
      `;
    }

    return `
      <div class="car-view-staff-list">
        ${staffList
          .map(function (staff) {
            const titleHtml =
              staff.title
                ? `
                  <span class="car-view-staff-title">
                    ${escapeHtml(
                      staff.title
                    )}
                  </span>

                  <span
                    class="car-view-staff-divider"
                    aria-hidden="true"
                  >
                    ｜
                  </span>
                `
                : "";

            const nameText =
              staff.name ||
              "未填姓名";

            return `
              <div class="car-view-staff-item">
                ${titleHtml}

                <span class="car-view-staff-name">
                  ${escapeHtml(
                    nameText
                  )}
                </span>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  // ============================================================
  // 車團人數與狀態
  // ============================================================

  function getTotal(car) {
    const total = Number(
      car.totalPeople ||
      car.capacity ||
      0
    );

    const male = Number(
      car.maleSlots ||
      car.maleCount ||
      0
    );

    const female = Number(
      car.femaleSlots ||
      car.femaleCount ||
      0
    );

    const flexible = Number(
      car.flexibleSlots ||
      car.flexSlots ||
      car.anySlots ||
      car.flexibleCount ||
      0
    );

    if (total > 0) {
      return total;
    }

    return (
      male +
      female +
      flexible
    );
  }

  function getStatus(car) {
    const originalStatus =
      String(
        car.status || ""
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

    const players =
      getPlayers(car);

    const total =
      getTotal(car);

    if (total <= 0) {
      return (
        originalStatus ||
        "招募中"
      );
    }

    return players.length >= total
      ? "已滿團"
      : "招募中";
  }

  // ============================================================
  // 金額
  // ============================================================

  function getPriceValue(car) {
    const candidates = [
      car.price,
      car.playerPrice,
      car.fee,
      car.amount
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

    const text = String(
      rawValue
    ).trim();

    // 已經含有文字或貨幣符號時，原樣顯示
    if (
      /[^\d.,-]/.test(text)
    ) {
      return text;
    }

    const numberValue =
      Number(
        text.replace(/,/g, "")
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
  // 資訊列
  // ============================================================

  function renderInfoRow(
    icon,
    label,
    value,
    options
  ) {
    const settings = {
      html: false,
      emphasized: false,
      fullWidth: false,
      ...(
        options || {}
      )
    };

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

    const valueHtml =
      settings.html
        ? value
        : escapeHtml(
            getText(value)
          );

    return `
      <div class="${classNames.join(" ")}">
        <div
          class="car-view-info-icon"
          aria-hidden="true"
        >
          ${escapeHtml(icon)}
        </div>

        <div class="car-view-info-content">
          <div class="car-view-info-label">
            ${escapeHtml(label)}
          </div>

          <div class="car-view-info-value">
            ${valueHtml}
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================
  // 底部操作
  // ============================================================

  function getActionHtml(
    status,
    carId
  ) {
    const joinUrl =
      "/pages/join.html?id=" +
      encodeURIComponent(carId);

    if (status === "招募中") {
      return `
        <a
          class="car-view-join-button"
          href="${escapeHtml(joinUrl)}"
        >
          我要報名
        </a>
      `;
    }

    if (status === "已滿團") {
      return `
        <div class="car-view-status-message">
          此車團目前已滿團
        </div>
      `;
    }

    if (status === "已結束") {
      return `
        <div class="car-view-status-message">
          此車團已結束
        </div>
      `;
    }

    if (status === "已取消") {
      return `
        <div class="car-view-status-message">
          此車團已取消
        </div>
      `;
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

    const players =
      getPlayers(car);

    const total =
      getTotal(car);

    const status =
      getStatus(car);

    const playerCountText =
      total > 0
        ? ${players.length} / ${total}
        : `${players.length} 人`;

    const note =
      car.publicNote ||
      car.note ||
      "";

    const studioText =
      car.studioName ||
      car.studio ||
      car.organizer ||
      "未提供";

    container.innerHTML = `
      <article class="car-view-card">

        <header class="car-view-header">
          <div class="car-view-header-main">
            <div class="car-view-eyebrow">
              車團資訊
            </div>

            <h1 class="car-view-title">
              ${escapeHtml(
                getText(
                  car.scriptName ||
                  car.name,
                  "未命名劇本"
                )
              )}
            </h1>
          </div>

          <div
            class="car-view-status"
            data-status="${escapeHtml(
              status
            )}"
          >
            ${escapeHtml(status)}
          </div>
        </header>

        <section