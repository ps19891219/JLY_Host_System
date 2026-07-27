console.log("car-view-render.js 已成功載入！");

(function () {
  "use strict";

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

  function getText(value, fallback = "未提供") {
    const text = String(
      value == null
        ? ""
        : value
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

  function getPlayerName(player) {
    if (!player) {
      return "未命名玩家";
    }

    return (
      player.hostAlias ||
      player.name ||
      player.displayName ||
      player.playerName ||
      "未命名玩家"
    );
  }

  function getDmText(car) {
    if (
      Array.isArray(car.dmList) &&
      car.dmList.length > 0
    ) {
      return car.dmList
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
        .filter(Boolean)
        .join("、");
    }

    return (
      car.dm ||
      car.dmName ||
      "未提供"
    );
  }

  function getTotal(car) {
    const total = Number(
      car.totalPeople || 0
    );

    const male = Number(
      car.maleSlots || 0
    );

    const female = Number(
      car.femaleSlots || 0
    );

    const flexible = Number(
      car.flexibleSlots ||
      car.anySlots ||
      0
    );

    if (total > 0) {
      return total;
    }

    return male + female + flexible;
  }

  function getStatus(car) {
    if (car.status === "已取消") {
      return "已取消";
    }

    if (car.status === "已結束") {
      return "已結束";
    }

    const need = Math.max(
      getTotal(car) -
        getPlayers(car).length,
      0
    );

    return need > 0
      ? "招募中"
      : "已滿團";
  }

  function renderPlayerList(players) {
    if (!players.length) {
      return `
        <div class="car-view-empty">
          尚無已確認玩家
        </div>
      `;
    }

    return players
      .map(function (player, index) {
        const position =
          player.position &&
          player.position !== "不限"
            ? player.position
            : "";

        const crossPlay =
          player.isCrossPlay === true
            ? "反串"
            : "";

        const meta = [
          position,
          crossPlay
        ]
          .filter(Boolean)
          .join("｜");

        return `
          <div class="car-view-player-row">
            <span class="car-view-player-number">
              ${index + 1}
            </span>

            <div class="car-view-player-main">
              <div class="car-view-player-name">
                ${escapeHtml(
                  getPlayerName(player)
                )}
              </div>

              ${
                meta
                  ? `
                    <div class="car-view-player-meta">
                      ${escapeHtml(meta)}
                    </div>
                  `
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderInfoRow(label, value) {
    return `
      <div class="car-view-info-row">
        <div class="car-view-info-label">
          ${escapeHtml(label)}
        </div>

        <div class="car-view-info-value">
          ${escapeHtml(
            getText(value)
          )}
        </div>
      </div>
    `;
  }

  function renderCarView(container, car, carId) {
    if (!container) {
      return;
    }

    const players = getPlayers(car);
    const total = getTotal(car);
    const need = Math.max(
      total - players.length,
      0
    );

    const status = getStatus(car);

    const joinUrl =
      "../pages/join.html?id=" +
      encodeURIComponent(carId);

    let actionHtml = "";

    if (status === "招募中") {
      actionHtml = `
        <a
          class="car-view-join-button"
          href="${escapeHtml(joinUrl)}"
        >
          我要報名
        </a>
      `;
    } else if (status === "已滿團") {
      actionHtml = `
        <div class="car-view-status-message">
          已滿團
        </div>
      `;
    } else if (status === "已結束") {
      actionHtml = `
        <div class="car-view-status-message">
          本車團已結束
        </div>
      `;
    } else if (status === "已取消") {
      actionHtml = `
        <div class="car-view-status-message">
          本車團已取消
        </div>
      `;
    }

    container.innerHTML = `
      <div class="car-view-card">

        <div class="car-view-header">
          <div>
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
        </div>

        <div class="car-view-info-list">
          ${renderInfoRow(
            "日期",
            car.gameDate ||
              car.date
          )}

          ${renderInfoRow(
            "時間",
            car.gameTime ||
              car.time
          )}

          ${renderInfoRow(
            "地點",
            car.location
          )}

          ${renderInfoRow(
            "工作室",
            car.organizer ||
              car.studioName ||
              car.studio
          )}

          ${renderInfoRow(
            "DM",
            getDmText(car)
          )}

          ${renderInfoRow(
            "人數",
            total > 0
              ? `${players.length} / ${total}`
              : `${players.length} 人`
          )}

          ${
            status === "招募中"
              ? renderInfoRow(
                  "尚缺",
                  `${need} 人`
                )
              : ""
          }
        </div>

        ${
          car.publicNote ||
          car.note
            ? `
              <section class="car-view-section">
                <h2>公開備註</h2>

                <div class="car-view-note">
                  ${escapeHtml(
                    car.publicNote ||
                    car.note
                  )}
                </div>
              </section>
            `
            : ""
        }

        <section class="car-view-section">
          <h2>已確認玩家</h2>

          <div class="car-view-player-list">
            ${renderPlayerList(players)}
          </div>
        </section>

        <section class="car-view-section">
          <h2>座位安排</h2>

          <div id="carViewSeatMount">
            座位讀取中...
          </div>
        </section>

        <div class="car-view-action">
          ${actionHtml}
        </div>

      </div>
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

  function renderError(container, message) {
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
    getPlayerName,
    getTotal,
    getStatus,
    renderCarView,
    renderLoading,
    renderError
  };
})();