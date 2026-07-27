console.log("car-view-render.js 已成功載入！");

(function () {
  "use strict";

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

  function getText(value, fallback = "未提供") {
    const text = String(
      value == null ? "" : value
    ).trim();

    return text || fallback;
  }

  function getPlayers(car) {
    const players = Array.isArray(car.players)
      ? car.players
      : [];

    return players.filter(function (player) {
      return (
        player &&
        player.status !== "已取消"
      );
    });
  }

  function getDmText(car) {
    if (
      Array.isArray(car.dmList) &&
      car.dmList.length > 0
    ) {
      const names = car.dmList
        .map(function (dm) {
          if (typeof dm === "string") {
            return dm;
          }

          return (
            dm.name ||
            dm.displayName ||
            dm.dmName ||
            ""
          );
        })
        .filter(Boolean);

      if (names.length > 0) {
        return names.join("、");
      }
    }

    return (
      car.dm ||
      car.dmName ||
      "未提供"
    );
  }

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
      car.anySlots ||
      car.flexibleCount ||
      0
    );

    if (total > 0) {
      return total;
    }

    return male + female + flexible;
  }

  function getStatus(car) {
    if (
      car.status === "已取消" ||
      car.status === "取消"
    ) {
      return "已取消";
    }

    if (
      car.status === "已結束" ||
      car.status === "結束"
    ) {
      return "已結束";
    }

    const players = getPlayers(car);
    const total = getTotal(car);

    if (total <= 0) {
      return car.status || "招募中";
    }

    return players.length >= total
      ? "已滿團"
      : "招募中";
  }

  function renderInfoRow(icon, label, value) {
    return `
      <div class="car-view-info-row">
        <div class="car-view-info-icon">
          ${escapeHtml(icon)}
        </div>

        <div class="car-view-info-content">
          <div class="car-view-info-label">
            ${escapeHtml(label)}
          </div>

          <div class="car-view-info-value">
            ${escapeHtml(
              getText(value)
            )}
          </div>
        </div>
      </div>
    `;
  }

  function getActionHtml(status, carId) {
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

  function renderCarView(
    container,
    car,
    carId
  ) {
    if (!container) {
      return;
    }

    const players = getPlayers(car);
    const total = getTotal(car);
    const status = getStatus(car);

    const playerCountText =
      total > 0
        ? `${players.length} / ${total}`
        : `${players.length} 人`;

    const note =
      car.publicNote ||
      car.note ||
      "";

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
                  car.scriptName,
                  "未命名劇本"
                )
              )}
            </h1>
          </div>

          <div
            class="car-view-status"
            data-status="${escapeHtml(status)}"
          >
            ${escapeHtml(status)}
          </div>
        </header>

        <section class="car-view-info-card">
          ${renderInfoRow(
            "📅",
            "日期",
            car.gameDate ||
            car.date
          )}

          ${renderInfoRow(
            "🕒",
            "時間",
            car.gameTime ||
            car.time
          )}

          ${renderInfoRow(
            "📍",
            "地點",
            car.location
          )}

          ${renderInfoRow(
            "🏠",
            "工作室",
            car.organizer ||
            car.studioName ||
            car.studio
          )}

          ${renderInfoRow(
            "🎲",
            "DM",
            getDmText(car)
          )}

          ${renderInfoRow(
            "👥",
            "目前人數",
            playerCountText
          )}
        </section>

        ${
          note
            ? `
              <section class="car-view-section">
                <h2 class="car-view-section-title">
                  公開備註
                </h2>

                <div class="car-view-note">
                  ${escapeHtml(note)}
                </div>
              </section>
            `
            : ""
        }

        <section class="car-view-section">
          <div class="car-view-section-header">
            <h2 class="car-view-section-title">
              座位安排
            </h2>

            <span class="car-view-readonly-label">
              僅供查看
            </span>
          </div>

          <div id="seatBoardMount">
            <div class="car-view-seat-loading">
              座位讀取中...
            </div>
          </div>
        </section>

        <div class="car-view-action">
          ${getActionHtml(
            status,
            carId
          )}
        </div>

      </article>
    `;
  }

  function renderLoading(container) {
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="car-view-loading">
        正在讀取車團資訊...
      </div>
    `;
  }

  function renderError(
    container,
    message
  ) {
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="car-view-error">
        <h2>無法顯示車團資訊</h2>

        <p>
          ${escapeHtml(
            message ||
            "請稍後再試"
          )}
        </p>
      </div>
    `;
  }

  window.JLYCarViewRender = {
    escapeHtml,
    getPlayers,
    getTotal,
    getStatus,
    renderCarView,
    renderLoading,
    renderError
  };
})();