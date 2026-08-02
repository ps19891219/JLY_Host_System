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

  function renderEmpty(car) {
    return `
      <section class="matching-empty-card">

        <div class="matching-empty-icon">
          🗓️
        </div>

        <h2 class="matching-empty-title">
          尚未建立時間媒合
        </h2>

        <p class="matching-empty-text">
          建立常用時段並挑選候選日期後，
          就能分享連結讓玩家、DM
          與工作人員填寫可配合時間。
        </p>

        <button
          type="button"
          class="matching-primary-button"
          onclick="startMatchingSetup()"
        >
          開始建立媒合
        </button>

        <div class="matching-meta">
          目前車團狀態：
          ${escapeHtml(
            car.status ||
            "規劃中"
          )}
        </div>

      </section>
    `;
  }

  function buildCommonSlotRow(
    slot,
    index
  ) {
    const isCustom =
      slot.isCustom === true;

    return `
      <div
        class="matching-common-slot"
        data-slot-index="${index}"
      >
        <label
          class="matching-slot-toggle"
          title="是否使用此時段"
        >
          <input
            type="checkbox"
            class="matching-slot-enabled"
            ${slot.enabled !== false
              ? "checked"
              : ""}
          >

          <span
            class="matching-slot-icon"
            aria-hidden="true"
          >
            ${escapeHtml(
              slot.icon || "🕒"
            )}
          </span>
        </label>

        <input
          type="text"
          class="matching-slot-label"
          value="${escapeHtml(
            slot.label || ""
          )}"
          placeholder="時段名稱"
          maxlength="10"
        >

        <input
          type="time"
          class="matching-slot-time"
          value="${escapeHtml(
            slot.time || ""
          )}"
        >

        ${
          isCustom
            ? `
              <button
                type="button"
                class="matching-slot-delete"
                onclick="removeCommonSlot(${index})"
                aria-label="刪除這個時段"
                title="刪除時段"
              >
                ×
              </button>
            `
            : `
              <span
                class="matching-slot-delete-placeholder"
                aria-hidden="true"
              ></span>
            `
        }
      </div>
    `;
  }

  function renderDraft(matching) {
    const commonSlots =
      Array.isArray(
        matching.commonSlots
      )
        ? matching.commonSlots
        : [];

    return `
      <section class="matching-section">

        <div class="matching-status-badge">
          建立中
        </div>

        <div class="matching-section-heading">
          <div>
            <h2 class="matching-section-title">
              常用時段
            </h2>

            <p class="matching-section-description">
              先調整這次媒合會使用的時間。
              之後選取日期時，系統會一次展開。
            </p>
          </div>
        </div>

        <div
          id="matchingCommonSlots"
          class="matching-common-slots"
        >
          ${
            commonSlots.length > 0
              ? commonSlots
                  .map(
                    buildCommonSlotRow
                  )
                  .join("")
              : `
                <div class="matching-inline-empty">
                  尚未設定常用時段
                </div>
              `
          }
        </div>

        <button
          type="button"
          class="matching-secondary-button"
          onclick="addCustomCommonSlot()"
        >
          ＋ 新增自訂時段
        </button>

        <button
          type="button"
          class="matching-primary-button"
          id="saveCommonSlotsButton"
          onclick="saveCommonSlots()"
        >
          儲存常用時段
        </button>

        <p class="matching-meta">
          下一步：月曆多選日期與行程提醒
        </p>

      </section>
    `;
  }

  function renderApp(car) {
    const app =
      document.getElementById(
        "matchingApp"
      );

    const title =
      document.getElementById(
        "matchingScriptName"
      );

    if (title) {
      title.textContent =
        car.scriptName ||
        "未命名劇本";
    }

    if (!app) {
      return;
    }

    const matching =
      car.matching &&
      typeof car.matching ===
        "object"
        ? car.matching
        : null;

    app.innerHTML =
      matching
        ? renderDraft(matching)
        : renderEmpty(car);
  }

  function renderError(error) {
    const app =
      document.getElementById(
        "matchingApp"
      );

    if (!app) {
      return;
    }

    app.innerHTML = `
      <section class="matching-empty-card">

        <h2 class="matching-empty-title">
          無法載入時間媒合
        </h2>

        <p class="matching-empty-text">
          ${escapeHtml(
            error &&
            error.message
              ? error.message
              : "未知錯誤"
          )}
        </p>

      </section>
    `;
  }

  window.JLYMatchingRender = {
    renderApp,
    renderError
  };

  console.log(
    "✅ Matching Render V2 已載入"
  );
})();