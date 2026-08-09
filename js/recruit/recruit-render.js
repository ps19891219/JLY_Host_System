console.log(
  "recruit-render.js 已成功載入！"
);

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

  function getActivePlayers(car) {
    const players =
      Array.isArray(
        car && car.players
      )
        ? car.players
        : [];

    return players.filter(
      function (player) {
        if (!player) {
          return false;
        }

        const status =
          String(
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

  function getTotal(car) {
    const sourceCar =
      car || {};

    const total =
      Number(
        sourceCar.totalPeople ||
        sourceCar.capacity ||
        0
      );

    if (total > 0) {
      return total;
    }

    return (
      Number(
        sourceCar.maleSlots ||
        0
      ) +
      Number(
        sourceCar.femaleSlots ||
        0
      ) +
      Number(
        sourceCar.flexibleSlots ||
        0
      )
    );
  }

  function getNeedCount(car) {
    return Math.max(
      getTotal(car) -
        getActivePlayers(car)
          .length,
      0
    );
  }

  function getStatus(car) {
    const sourceCar =
      car || {};

    const status =
      String(
        sourceCar.status || ""
      ).trim();

    if (
      status === "已取消" ||
      status === "取消"
    ) {
      return "已取消";
    }

    if (
      status === "已結束" ||
      status === "結束"
    ) {
      return "已結束";
    }

    if (
      status === "規劃中" ||
      sourceCar
        .planningStatus ===
        "unscheduled" ||
      !sourceCar.gameDate
    ) {
      return "規劃中";
    }

    return getNeedCount(
      sourceCar
    ) <= 0
      ? "已滿"
      : "招募中";
  }

  function getCoverHtml(car) {
    const imageUrl =
      car.coverImageUrl ||
      car.scriptCoverUrl ||
      car.scriptImageUrl ||
      "";

    const title =
      car.scriptName ||
      car.activityName ||
      "未命名劇本";

    if (!imageUrl) {
      return `
        <div
          class="
            recruit-car-cover
            is-placeholder
          "
        >
          ${escapeHtml(title)}
        </div>
      `;
    }

    return `
      <div class="recruit-car-cover">
        <img
          src="${escapeHtml(
            imageUrl
          )}"
          alt="${escapeHtml(
            title
          )}"
        >
      </div>
    `;
  }

  function getCarViewUrl(
    carId
  ) {
    return (
      "car-view.html?id=" +
      encodeURIComponent(
        carId
      )
    );
  }

  function renderCarCard(car) {
    const title =
      car.scriptName ||
      car.activityName ||
      "未命名劇本";

    const status =
      getStatus(car);

    const need =
      getNeedCount(car);

    const date =
      car.gameDate ||
      "日期未定";

    const time =
      car.gameTime ||
      "";

    const studio =
      car.studioName ||
      car.organizerName ||
      car.organizer ||
      "未填";

    const locationText =
      car.location ||
      car.locationName ||
      "未填";

    return `
      <a
        class="recruit-car-card"
        href="${escapeHtml(
          getCarViewUrl(
            car.id
          )
        )}"
      >
        ${getCoverHtml(car)}

        <div
          class="recruit-car-main"
        >
          <div
            class="
              recruit-car-title-row
            "
          >
            <h2
              class="
                recruit-car-title
              "
            >
              ${escapeHtml(
                title
              )}
            </h2>

            <span
              class="
                recruit-car-status
              "
              data-status="${escapeHtml(
                status
              )}"
            >
              ${escapeHtml(
                status
              )}
            </span>
          </div>

          <div
            class="recruit-car-meta"
          >
            📅
            ${escapeHtml(
              date
            )}
            ${
              time
                ? " " +
                  escapeHtml(
                    time
                  )
                : ""
            }
          </div>

          <div
            class="recruit-car-meta"
          >
            🏠
            ${escapeHtml(
              studio
            )}
          </div>

          <div
            class="recruit-car-meta"
          >
            📍
            ${escapeHtml(
              locationText
            )}
          </div>

          <div
            class="recruit-car-need"
          >
            ${
              need > 0
                ? "👥 尚缺 " +
                  need +
                  " 人"
                : "✅ 已滿"
            }
          </div>
        </div>
      </a>
    `;
  }

  function renderPage(
    container,
    cars
  ) {
    if (!container) {
      return;
    }

    if (
      !Array.isArray(cars) ||
      cars.length === 0
    ) {
      container.innerHTML = `
        <div
          class="
            recruit-empty
          "
        >
          <div
            class="
              recruit-empty-icon
            "
          >
            🌱
          </div>

          <h2>
            目前沒有正在招募的車
          </h2>

          <p>
            有新的車團時，
            這裡就會出現。
          </p>
        </div>
      `;

      return;
    }

    container.innerHTML =
      cars
        .map(renderCarCard)
        .join("");
  }

  function renderLoading(
    container
  ) {
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div
        class="recruit-loading"
      >
        正在整理揪團清單…
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
      <div
        class="recruit-error"
      >
        <h2>
          這個揪團連結目前無法使用
        </h2>

        <p>
          ${escapeHtml(
            message ||
            "請向分享者索取新的連結。"
          )}
        </p>
      </div>
    `;
  }

  window.JLYRecruitRender = {
    getStatus,
    getNeedCount,
    renderPage,
    renderLoading,
    renderError
  };
})();