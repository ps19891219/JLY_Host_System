"use strict";

console.log(
  "application-review.js V1 已成功載入！"
);

let currentReviewType =
  "player";

let currentReviewSummary = {
  total: 0,
  playerCount: 0,
  dmCount: 0,
  cars: []
};

function reviewText(value) {
  return String(
    value == null ? "" : value
  ).trim();
}

function reviewEscape(value) {
  return reviewText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getOwnerId() {
  if (
    window.JLYIdentity &&
    typeof window.JLYIdentity
      .getCurrentPlayerId ===
        "function"
  ) {
    return reviewText(
      window.JLYIdentity
        .getCurrentPlayerId()
    );
  }

  return reviewText(
    localStorage.getItem(
      "currentPlayerId"
    )
  );
}

function setReviewType(type) {
  currentReviewType =
    type === "dm"
      ? "dm"
      : "player";

  renderReviewList();
}

function buildPlayerItem(app) {
  const name =
    reviewEscape(
      app.name ||
      app.playerName ||
      "未命名玩家"
    );

  const position =
    reviewEscape(
      app.role ||
      app.position ||
      "不限"
    );

  const cross =
    app.isCrossPlay === true
      ? "／反串"
      : "";

  return `
    <div
      style="
        padding:10px 0;
        border-top:1px solid #eee;
      "
    >
      <strong>
        🎮 ${name}
      </strong>

      <div>
        ${position}${cross}
      </div>
    </div>
  `;
}

function buildDmItem(app) {
  const name =
    reviewEscape(
      app.displayName ||
      "未命名 DM"
    );

  const claim =
    app.claimType ===
      "existing_slot"
      ? (
          "認領 " +
          reviewEscape(
            (
              app.targetStaffLabel
                ? app.targetStaffLabel +
                  "｜"
                : ""
            ) +
            (
              app.targetStaffName ||
              "既有 DM"
            )
          )
        )
      : "新增為本場 DM";

  return `
    <div
      style="
        padding:10px 0;
        border-top:1px solid #eee;
      "
    >
      <strong>
        🎭 ${name}
      </strong>

      <div>
        ${claim}
      </div>
    </div>
  `;
}

function renderReviewList() {
  const list =
    document.getElementById(
      "registrationReviewList"
    );

  if (!list) {
    return;
  }

  const key =
    currentReviewType === "dm"
      ? "dmApplications"
      : "playerApplications";

  const rows =
    currentReviewSummary.cars
      .filter(
        function (item) {
          return (
            Array.isArray(
              item[key]
            ) &&
            item[key].length > 0
          );
        }
      );

  if (rows.length === 0) {
    list.innerHTML = `
      <div class="card">
        <h3>
          ${
            currentReviewType === "dm"
              ? "🎭 DM"
              : "🎮 玩家"
          }
        </h3>

        <p>
          目前沒有待審核申請。
        </p>
      </div>
    `;

    return;
  }

  list.innerHTML =
    rows
      .map(
        function (item) {
          const car =
            item.car || {};

          const apps =
            item[key];

          const body =
            apps
              .map(
                currentReviewType === "dm"
                  ? buildDmItem
                  : buildPlayerItem
              )
              .join("");

          const carId =
            encodeURIComponent(
              reviewText(
                car.id
              )
            );

          return `
            <div class="card">
              <h3>
                ${reviewEscape(
                  car.scriptName ||
                  car.name ||
                  "未命名劇本"
                )}
              </h3>

              <p>
                ${apps.length}
                筆待審核
              </p>

              ${body}

              <button
                type="button"
                onclick="
                  location.href=
                    'car-detail.html?id=${carId}'
                "
              >
                前往處理
              </button>
            </div>
          `;
        }
      )
      .join("");
}

async function loadRegistrationReview() {
  const list =
    document.getElementById(
      "registrationReviewList"
    );

  try {
    const ownerId =
      getOwnerId();

    if (!ownerId) {
      throw new Error(
        "尚未建立主揪身分"
      );
    }

    if (
      !window.JLYCarData ||
      typeof window.JLYCarData
        .getCarsByOwner !==
          "function"
    ) {
      throw new Error(
        "Car Data 模組尚未載入"
      );
    }

    if (
      !window.JLYPendingActions
    ) {
      throw new Error(
        "Pending Actions 模組尚未載入"
      );
    }

    const cars =
      await window.JLYCarData
        .getCarsByOwner(
          ownerId
        );

    currentReviewSummary =
      window.JLYPendingActions
        .buildRegistrationSummary(
          cars
        );

    const playerCount =
      document.getElementById(
        "playerReviewCount"
      );

    const dmCount =
      document.getElementById(
        "dmReviewCount"
      );

    if (playerCount) {
      playerCount.textContent =
        String(
          currentReviewSummary
            .playerCount
        );
    }

    if (dmCount) {
      dmCount.textContent =
        String(
          currentReviewSummary
            .dmCount
        );
    }

    renderReviewList();
  } catch (error) {
    console.error(
      "報名審核讀取失敗：",
      error
    );

    if (list) {
      list.innerHTML = `
        <div class="card">
          <h3>
            報名審核讀取失敗
          </h3>

          <p>
            ${reviewEscape(
              error.message ||
              "未知錯誤"
            )}
          </p>
        </div>
      `;
    }
  }
}

window.setReviewType =
  setReviewType;

document.addEventListener(
  "DOMContentLoaded",
  loadRegistrationReview
);
