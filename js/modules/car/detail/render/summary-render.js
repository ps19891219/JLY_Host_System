/*
====================================================

JLY Host System V3

Module：
Car Detail Summary Render

用途：
1. 顯示劇本名稱
2. 顯示車團狀態燈號
3. 顯示日期、時間與金額
4. 顯示目前人數
5. 顯示工作室、地點與備註

規則：
- 只建立 HTML
- 不讀取 Firestore
- 不寫入 Firestore
- 不直接修改車團資料
- 欄位編輯仍交由 field editor 處理

依賴：
- window.escapeHtml
- window.openSingleFieldEditor

====================================================
*/

console.log(
  "summary-render.js 已成功載入！"
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
  // 數字安全轉換
  // ------------------------------------------------------------

  function toSafeNumber(value) {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  // ------------------------------------------------------------
  // 建立狀態樣式
  // ------------------------------------------------------------

  function getStatusClass(status) {
    switch (status) {
      case "招募中":
        return "is-recruiting";

      case "已滿":
        return "is-full";

      case "已結束":
        return "is-finished";

      case "已取消":
        return "is-cancelled";

      default:
        return "";
    }
  }

  // ------------------------------------------------------------
  // 建立單張資訊卡
  // ------------------------------------------------------------

  function buildInfoItem(options) {
    const config =
      options || {};

    const field =
      String(
        config.field || ""
      );

    const editable =
      config.editable === true &&
      Boolean(field);

    const navigationTarget = String(
      config.navigationTarget || ""
    );

    const valueAction = String(
      config.valueAction || ""
    );

    const cardClass = [
      "car-info-item",

      editable
        ? "is-editable"
        : "is-readonly",

      config.wide === true
        ? "is-wide"
        : ""
    ]
      .filter(Boolean)
      .join(" ");

    const fieldAttribute =
      field
        ? `data-car-field="${escapeValue(
            field
          )}"`
        : "";

    const resolvedValueAction =
      valueAction ||
      (editable
        ? `openSingleFieldEditor('${escapeValue(field)}')`
        : "");

    const labelContent = `
      <span class="car-info-icon" aria-hidden="true">
        ${escapeValue(config.icon || "")}
      </span>
      <span class="car-info-label">
        ${escapeValue(config.label || "")}
      </span>
      ${navigationTarget ? `<span class="car-info-jump-hint" aria-hidden="true">↓</span>` : ""}
    `;

    return `
      <div
        class="${cardClass}"
        ${fieldAttribute}
      >
        ${navigationTarget
          ? `<button type="button" class="car-info-item-top car-info-jump" onclick="document.getElementById('${escapeValue(navigationTarget)}')?.scrollIntoView({behavior:'smooth',block:'start'})">${labelContent}</button>`
          : `<div class="car-info-item-top">${labelContent}</div>`}

        ${resolvedValueAction
          ? `<button type="button" class="car-info-value car-info-value-action" onclick="${resolvedValueAction}">${escapeValue(config.value == null ? "" : config.value)}<span class="car-info-edit-hint" aria-hidden="true">›</span></button>`
          : `<div class="car-info-value">${escapeValue(config.value == null ? "" : config.value)}</div>`}
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 整理 Summary 顯示資料
  // ------------------------------------------------------------

  function createSummaryViewModel(
    config
  ) {
    const safeConfig =
      config || {};

    const car =
      safeConfig.car &&
      typeof safeConfig.car ===
        "object"
        ? safeConfig.car
        : {};

    const price =
      toSafeNumber(
        car.price
      );

    const activePlayerCount =
      toSafeNumber(
        safeConfig.activePlayerCount
      );

    const total =
      toSafeNumber(
        safeConfig.total
      );

    return {
      scriptName:
        safeConfig.scriptName ||
        car.scriptName ||
        car.name ||
        "未命名劇本",

      status:
        safeConfig.status ||
        "",

      statusClass:
        getStatusClass(
          safeConfig.status || ""
        ),

      dateText:
        car.gameDate ||
        "尚未設定",

      timeText:
        car.gameTime ||
        "尚未設定",

      priceText:
        price > 0
          ? `NT$ ${price.toLocaleString(
              "zh-TW"
            )}`
          : "尚未設定",

      peopleText:
        total > 0
          ? `${activePlayerCount} / ${total}`
          : `${activePlayerCount} 人`,

      studioText:
        safeConfig.studioName ||
        car.studioName ||
        car.organizer ||
        "尚未設定",

      locationText:
        car.location ||
        car.address ||
        "尚未設定",

      noteText:
        car.note ||
        "無"
    };
  }

  // ------------------------------------------------------------
  // 建立 Summary HTML
  // ------------------------------------------------------------

  function buildSummaryHtml(config) {
    const view =
      createSummaryViewModel(
        config
      );

    return `
      <section class="car-info-section">
        <div class="car-info-title-row">
          <h1 class="car-info-title">
            ${escapeValue(
              view.scriptName
            )}
          </h1>

          <div
            class="car-status-indicator ${view.statusClass}"
            aria-label="${escapeValue(
              view.status
            )}"
          >
            <span
              class="car-status-light"
              aria-hidden="true"
            ></span>

            <span class="car-status-text">
              ${escapeValue(
                view.status
              )}
            </span>
          </div>
        </div>

        <div class="car-info-grid">
          ${buildInfoItem({
            icon: "📅",
            label: "日期",
            value:
              view.dateText,
            field:
              "gameDate",
            editable:
              true
          })}

          ${buildInfoItem({
            icon: "🕒",
            label: "時間",
            value:
              view.timeText,
            field:
              "gameTime",
            editable:
              true
          })}

          ${buildInfoItem({
            icon: "💰",
            label: "金額",
            value:
              view.priceText,
            field:
              "price",
            editable:
              true,
            navigationTarget:
              "activityFeeSection"
          })}

          ${buildInfoItem({
            icon: "👥",
            label: "目前人數",
            value:
              view.peopleText,
            editable:
              false,
            navigationTarget:
              "seatSection",
            valueAction:
              "openSeatSettings()"
          })}

          ${buildInfoItem({
            icon: "🏠",
            label: "工作室",
            value:
              view.studioText,
            field:
              "studioName",
            editable:
              true,
            navigationTarget:
              "activityFeeSection"
          })}

          ${buildInfoItem({
            icon: "📍",
            label: "地點",
            value:
              view.locationText,
            field:
              "location",
            editable:
              true
          })}

          ${buildInfoItem({
            icon: "📝",
            label: "備註",
            value:
              view.noteText,
            field:
              "note",
            editable:
              true,
            wide:
              true
          })}
        </div>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailSummaryRender = {
    escapeValue,

    toSafeNumber,

    getStatusClass,

    buildInfoItem,

    createSummaryViewModel,

    buildSummaryHtml
  };

  console.log(
    "✅ Car Detail Summary Render 已載入"
  );
})();
