/*
====================================================

JLY Host System V3

Module：
Car Detail Page Render

用途：
1. 建立車團資訊卡
2. 建立工作人員與席位外框
3. 建立待確認申請區
4. 建立歷史紀錄區
5. 組合完整車團詳情頁 HTML

規則：
- 只產生 HTML
- 不讀取 Firestore
- 不寫入 Firestore
- 不安排玩家
- 不操作 Seat Engine

依賴：
- window.escapeHtml
- window.buildCarNavigation
- window.buildApplicationsHtml
- window.JLYStaffController

====================================================
*/

console.log(
  "detail-page-render.js 已成功載入！"
);

(function () {
  "use strict";

  // ------------------------------------------------------------
  // HTML 安全處理
  // ------------------------------------------------------------

  function escapeValue(value) {
    if (
      typeof window.escapeHtml ===
        "function"
    ) {
      return window.escapeHtml(value);
    }

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
  // 單張資訊卡
  // ------------------------------------------------------------

  function buildInfoItem(options) {
    const config =
      options || {};

    const cardClass = [
      "car-info-item",

      config.editable
        ? "is-editable"
        : "is-readonly",

      config.wide
        ? "is-wide"
        : ""
    ]
      .filter(Boolean)
      .join(" ");

    const field =
      config.field || "";

    const fieldAttribute =
      field
        ? `data-car-field="${escapeValue(
            field
          )}"`
        : "";

    const clickAttribute =
      config.editable && field
        ? `onclick="openSingleFieldEditor('${escapeValue(
            field
          )}')"`
        : "";

    const keyboardAttributes =
      config.editable && field
        ? `
          role="button"
          tabindex="0"
          onkeydown="
            if (
              event.key === 'Enter' ||
              event.key === ' '
            ) {
              event.preventDefault();

              openSingleFieldEditor(
                '${escapeValue(field)}'
              );
            }
          "
        `
        : "";

    return `
      <div
        class="${cardClass}"
        ${fieldAttribute}
        ${clickAttribute}
        ${keyboardAttributes}
      >
        <div class="car-info-item-top">
          <span
            class="car-info-icon"
            aria-hidden="true"
          >
            ${config.icon || ""}
          </span>

          <span class="car-info-label">
            ${escapeValue(
              config.label || ""
            )}
          </span>

          ${
            config.editable
              ? `
                <span
                  class="car-info-edit-hint"
                  aria-hidden="true"
                >
                  ›
                </span>
              `
              : ""
          }
        </div>

        <div class="car-info-value">
          ${escapeValue(
            config.value || ""
          )}
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 車團資訊區
  // ------------------------------------------------------------

  function buildCarSummaryHtml(config) {
    const safeConfig =
      config || {};

    const car =
      safeConfig.car || {};

    const dateText =
      car.gameDate ||
      "尚未設定";

    const timeText =
      car.gameTime ||
      "尚未設定";

    const priceNumber =
      Number(car.price || 0);

    const priceText =
      priceNumber > 0
        ? `NT$ ${priceNumber.toLocaleString(
            "zh-TW"
          )}`
        : "尚未設定";

    const total =
      Number(
        safeConfig.total || 0
      );

    const activePlayerCount =
      Number(
        safeConfig.activePlayerCount ||
        0
      );

    const peopleText =
      total > 0
        ? `${activePlayerCount} / ${total}`
        : `${activePlayerCount} 人`;

    const studioText =
      safeConfig.studioName ||
      "尚未設定";

    const locationText =
      car.location ||
      car.address ||
      "尚未設定";

    const noteText =
      car.note ||
      "無";

    const status =
      safeConfig.status || "";

    const statusClass =
      status === "招募中"
        ? "is-recruiting"
        : status === "已滿"
          ? "is-full"
          : status === "已結束"
            ? "is-finished"
            : status === "已取消"
              ? "is-cancelled"
              : "";

    return `
      <section class="car-info-section">
        <div class="car-info-title-row">
          <h1 class="car-info-title">
            ${escapeValue(
              safeConfig.scriptName ||
              "未命名劇本"
            )}
          </h1>

          <div
            class="car-status-indicator ${statusClass}"
            aria-label="${escapeValue(status)}"
          >
            <span
              class="car-status-light"
              aria-hidden="true"
            ></span>

            <span class="car-status-text">
              ${escapeValue(status)}
            </span>
          </div>
        </div>

        <div class="car-info-grid">
          ${buildInfoItem({
            icon: "📅",
            label: "日期",
            value: dateText,
            field: "gameDate",
            editable: true
          })}

          ${buildInfoItem({
            icon: "🕒",
            label: "時間",
            value: timeText,
            field: "gameTime",
            editable: true
          })}

          ${buildInfoItem({
            icon: "💰",
            label: "金額",
            value: priceText,
            field: "price",
            editable: true
          })}

          ${buildInfoItem({
            icon: "👥",
            label: "目前人數",
            value: peopleText,
            editable: false
          })}

          ${buildInfoItem({
            icon: "🏠",
            label: "工作室",
            value: studioText,
            field: "studioName",
            editable: true
          })}

          ${buildInfoItem({
            icon: "📍",
            label: "地點",
            value: locationText,
            field: "location",
            editable: true
          })}

          ${buildInfoItem({
            icon: "📝",
            label: "備註",
            value: noteText,
            field: "note",
            editable: true,
            wide: true
          })}
        </div>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // 工作人員區
  // ------------------------------------------------------------

  function buildStaffSectionHtml(car) {
    const controller =
      window.JLYStaffController;

    if (
      !controller ||
      typeof controller.render !==
        "function"
    ) {
      return "";
    }

    return controller.render(
      car || {}
    );
  }

  // ------------------------------------------------------------
  // 席位區外框
  // ------------------------------------------------------------

  function buildSeatSectionHtml(car) {
    return `
      <section class="seat-section">
        <div class="seat-section-header">
          <div class="seat-section-title-group">
            <h3 class="seat-section-title">
              席位安排
            </h3>

            <p class="seat-section-description">
              點玩家可編輯本場資料，點空位可加入玩家。
            </p>
          </div>

          <button
            type="button"
            class="seat-settings-button"
            onclick="openSeatSettings()"
          >
            <span
              class="seat-settings-icon"
              aria-hidden="true"
            >
              ⚙️
            </span>

            <span>
              席位設定
            </span>
          </button>
        </div>

        ${buildStaffSectionHtml(car)}

        <div id="seatBoardMount">
          <div class="seat-empty-state">
            座位載入中……
          </div>
        </div>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // 申請區
  // ------------------------------------------------------------

  function buildApplicationsSectionHtml(
    applications
  ) {
    const builder =
      window.buildApplicationsHtml;

    const content =
      typeof builder === "function"
        ? builder(
            Array.isArray(applications)
              ? applications
              : []
          )
        : `
          <p class="empty-text">
            目前沒有待確認申請
          </p>
        `;

    return `
      <div class="card">
        <h3>
          🔔 待確認申請
        </h3>

        ${content}
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 歷史紀錄區
  // ------------------------------------------------------------

  function buildHistorySectionHtml(history) {
    const sourceHistory =
      Array.isArray(history)
        ? history
        : [];

    return `
      <div class="card">
        <h3>
          📜 車團紀錄
        </h3>

        ${
          sourceHistory.length
            ? sourceHistory
                .slice()
                .reverse()
                .map(function (item) {
                  return `
                    <div class="history-item">
                      <strong>
                        ${escapeValue(
                          item.type || ""
                        )}
                      </strong>

                      <p>
                        ${escapeValue(
                          item.text || ""
                        )}
                      </p>

                      <small>
                        ${escapeValue(
                          item.time || ""
                        )}
                      </small>
                    </div>
                  `;
                })
                .join("")
            : `
              <p class="empty-text">
                尚無紀錄
              </p>
            `
        }
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 完整頁面
  // ------------------------------------------------------------

  function buildPageHtml(config) {
    const navigationBuilder =
      window.buildCarNavigation;

    const navigationHtml =
      typeof navigationBuilder ===
        "function"
        ? navigationBuilder(
            config &&
            config.scriptName
              ? config.scriptName
              : ""
          )
        : "";

    return `
      ${navigationHtml}

      ${buildCarSummaryHtml(config)}

      ${buildSeatSectionHtml(
        config && config.car
          ? config.car
          : {}
      )}

      ${buildApplicationsSectionHtml(
        config &&
        config.applications
          ? config.applications
          : []
      )}

      ${buildHistorySectionHtml(
        config &&
        config.history
          ? config.history
          : []
      )}
    `;
  }

  window.JLYCarDetailPageRender = {
    buildInfoItem,

    buildCarSummaryHtml,

    buildStaffSectionHtml,

    buildSeatSectionHtml,

    buildApplicationsSectionHtml,

    buildHistorySectionHtml,

    buildPageHtml
  };

  console.log(
    "✅ Car Detail Page Render 已載入"
  );
})();