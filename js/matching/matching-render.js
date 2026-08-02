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

  function formatDate(dateKey) {
    const date =
      window
        .JLYMatchingCalendar
        .parseDateKey(
          dateKey
        );

    if (!date) {
      return dateKey;
    }

    const weekdays = [
      "日",
      "一",
      "二",
      "三",
      "四",
      "五",
      "六"
    ];

    return (
      (date.getMonth() + 1) +
      "/" +
      date.getDate() +
      "（" +
      weekdays[
        date.getDay()
      ] +
      "）"
    );
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
          建立時段並挑選候選日期後，
          就能分享連結讓參與者填寫
          可配合時間。
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
    return `
      <div
        class="matching-common-slot"
        data-slot-index="${index}"
      >
        <label class="matching-slot-toggle">
          <input
            type="checkbox"
            class="matching-slot-enabled"
            ${
              slot.enabled !== false
                ? "checked"
                : ""
            }
          >

          <span class="matching-slot-icon">
            ${escapeHtml(
              slot.icon ||
              "🕒"
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
  type="text"
  inputmode="numeric"
  class="matching-slot-time"
  value="${escapeHtml(
    slot.time || ""
  )}"
  placeholder="HH:MM"
  maxlength="5"
>

        ${
          slot.isCustom === true
            ? `
              <button
                type="button"
                class="matching-slot-delete"
                onclick="removeCommonSlot(${index})"
              >
                ×
              </button>
            `
            : `
              <span
                class="matching-slot-delete-placeholder"
              ></span>
            `
        }
      </div>
    `;
  }

  function buildCandidateConflicts(slot) {
    const conflicts = Array.isArray(slot.conflicts)
        ? slot.conflicts
        : [];

    if (conflicts.length === 0) {
        return "";
    }

    return `
        <div class="matching-candidate-conflicts">
            ${conflicts
                .map(function (conflict) {

                    const title =
                        conflict.title ||
                        "未命名行程";

                    const time =
                        conflict.time ||
                        "";

                    const conflictId =
                        conflict.carId ||
                        conflict.id ||
                        "";

                    return `
                        <div
                            class="matching-conflict-note"
                            onclick="openConflictCar('${escapeHtml(conflictId)}')"
                            title="查看車團"
                        >
                            🚗 ${escapeHtml(time)}
                            ${title ? "　" + escapeHtml(title) : ""}
                        </div>
                    `;
                })
                .join("")}
        </div>
    `;
}

  function buildCandidateRow(
  slot,
  index
) {
  return `
    <div class="matching-candidate-item">

      <div
        class="
          matching-candidate-row
          ${
            slot.enabled === false
              ? "is-disabled"
              : ""
          }
        "
        data-candidate-index="${index}"
      >
        <label class="matching-candidate-toggle">
          <input
            type="checkbox"
            class="matching-candidate-enabled"
            ${
              slot.enabled !== false
                ? "checked"
                : ""
            }
            onchange="toggleCandidateSlot(${index}, this.checked)"
          >
        </label>

        <span class="matching-candidate-icon">
          ${escapeHtml(
            slot.icon ||
            "🕒"
          )}
        </span>

        <input
          type="text"
          class="matching-candidate-label"
          value="${escapeHtml(
            slot.label || ""
          )}"
          maxlength="10"
          onchange="updateCandidateLabel(${index}, this.value)"
        >

        <input
          type="text"
          inputmode="numeric"
          class="matching-candidate-time"
          value="${escapeHtml(
            slot.time || ""
          )}"
          placeholder="HH:MM"
          maxlength="5"
          onchange="updateCandidateTime(${index}, this.value)"
        >

        <button
          type="button"
          class="matching-candidate-remove"
          onclick="removeCandidateSlot(${index})"
          aria-label="移除候選時段"
        >
          ×
        </button>
      </div>

      ${buildCandidateConflicts(
        slot
      )}

    </div>
  `;
}

  function renderCandidatePreview(
    matching
  ) {
    const container =
      document.getElementById(
        "matchingCandidatePreview"
      );

    if (!container) {
      return;
    }

    const candidates =
      Array.isArray(
        matching.candidateSlots
      )
        ? matching.candidateSlots
        : [];

    if (
      candidates.length === 0
    ) {
      container.innerHTML = `
        <div class="matching-inline-empty">
          選取日期後，候選時段會顯示在這裡。
        </div>
      `;

      return;
    }

    const grouped = {};

    candidates.forEach(
      function (
        slot,
        index
      ) {
        if (!grouped[slot.date]) {
          grouped[slot.date] = [];
        }

        grouped[slot.date].push({
          slot,
          index
        });
      }
    );

    container.innerHTML =
      Object.keys(grouped)
        .sort()
        .map(function (
          dateKey
        ) {
          return `
            <section class="matching-candidate-day">
              <div class="matching-candidate-day-header">
                <strong>
                  📅 ${formatDate(
                    dateKey
                  )}
                </strong>

                <button
                  type="button"
                  class="matching-day-add-button"
                  onclick="addCandidateSlot('${dateKey}')"
                >
                  ＋新增
                </button>
              </div>

              <div class="matching-candidate-list">
                ${
                  grouped[dateKey]
                    .map(function (
                      item
                    ) {
                      return buildCandidateRow(
                        item.slot,
                        item.index
                      );
                    })
                    .join("")
                }
              </div>
            </section>
          `;
        })
        .join("");
  }

  function renderDraft(
    matching
  ) {
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

        <h2 class="matching-section-title">
          ① 本次媒合時段
        </h2>

        <p class="matching-section-description">
          這裡是批次產生候選時間的模板，
          展開後仍可逐筆修改。
        </p>

        <div
          id="matchingCommonSlots"
          class="matching-common-slots"
        >
          ${
            commonSlots
              .map(
                buildCommonSlotRow
              )
              .join("")
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
          儲存本次媒合時段
        </button>
      </section>

      <section class="matching-section">
        <h2 class="matching-section-title">
          ② 選擇日期
        </h2>

        <p class="matching-section-description">
          可一次選擇多個日期，再到下一區
          個別調整每一筆時間。
        </p>

        <div id="matchingCalendar"></div>
      </section>

      <section class="matching-section">
        <h2 class="matching-section-title">
          ③ 候選時段
        </h2>

        <p class="matching-section-description">
          每一筆時間都能獨立修改、停用或移除。
        </p>

        <div
          id="matchingCandidatePreview"
          class="matching-candidate-preview"
        ></div>

        <button
          type="button"
          class="matching-primary-button"
          id="saveCandidateSlotsButton"
          onclick="saveCandidateSlots()"
        >
          儲存候選時段
        </button>
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
        ? renderDraft(
            matching
          )
        : renderEmpty(car);

    if (matching) {
      window
        .JLYMatchingCalendar
        .initializeFromDates(
          matching.selectedDates
        );

      window
        .JLYMatchingCalendar
        .renderCalendar();

      renderCandidatePreview(
        matching
      );

      if (
  window.JLYMatchingActions &&
  typeof window
    .JLYMatchingActions
    .refreshCandidateConflicts ===
    "function"
) {
  window
    .JLYMatchingActions
    .refreshCandidateConflicts();
}
    }
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
    renderError,
    renderCandidatePreview
  };

  console.log(
    "✅ Matching Render V3 已載入"
  );
})();