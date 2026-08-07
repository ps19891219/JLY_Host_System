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
    const calendar =
      window.JLYMatchingCalendar;

    const date =
      calendar &&
      typeof calendar.parseDateKey ===
        "function"
        ? calendar.parseDateKey(
            dateKey
          )
        : null;

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

    function getCurrentStep(
    matching
  ) {
    const step =
      Number(
        matching &&
        matching.currentStep
      );

    if (step === 4) {
      return 4;
    }

    if (step === 3) {
      return 3;
    }

    return 2;
  }

    function getMatchingResponseCount(
    matching
  ) {
    const responses =
      matching &&
      matching.responses &&
      typeof matching.responses ===
        "object"
        ? matching.responses
        : {};

    return Object
      .values(responses)
      .filter(
        function (response) {
          return (
            response &&
            response.status !==
              "deleted"
          );
        }
      )
      .length;
  }

  function renderResponseSummary(
    matching
  ) {
    const container =
      document.getElementById(
        "matchingResponseSummary"
      );

    if (!container) {
      return;
    }

    const responseCount =
      getMatchingResponseCount(
        matching
      );

        container.textContent =
      responseCount > 0
        ? "目前已有 " +
  responseCount +
  " 位參與者回覆　›"
: "目前尚未收到回覆。";

    container.disabled =
      responseCount === 0;

    if (
      window.JLYMatchingMatrix &&
      typeof window
        .JLYMatchingMatrix
        .refresh ===
        "function"
    ) {
      window
        .JLYMatchingMatrix
        .refresh(
          matching
        );
    }
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
                aria-label="刪除自訂時段"
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

    function buildCandidateConflicts(
    slot
  ) {
    const conflicts =
      Array.isArray(
        slot.conflicts
      )
        ? slot.conflicts
        : [];

    if (
      conflicts.length === 0
    ) {
      return "";
    }

    return `
      <div class="matching-candidate-conflicts">
        ${
          conflicts
            .map(function (
              conflict
            ) {
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
                  onclick="openConflictCar('${escapeHtml(
                    conflictId
                  )}')"
                  title="查看車團"
                  role="button"
                  tabindex="0"
                  onkeydown="
                    if (
                      event.key === 'Enter' ||
                      event.key === ' '
                    ) {
                      event.preventDefault();
                      openConflictCar('${escapeHtml(
                        conflictId
                      )}');
                    }
                  "
                >
                  🚗 ${escapeHtml(
                    time
                  )}${
                    title
                      ? "　" +
                        escapeHtml(
                          title
                        )
                      : ""
                  }
                </div>
              `;
            })
            .join("")
        }
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
          尚未建立候選時段。
          請返回日期頁重新選擇。
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
          grouped[slot.date] =
            [];
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

  function renderStepTwo(
    matching
  ) {
    const commonSlots =
      Array.isArray(
        matching.commonSlots
      )
        ? matching.commonSlots
        : [];

    const selectedCount =
      Array.isArray(
        matching.selectedDates
      )
        ? matching
            .selectedDates
            .length
        : 0;

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

        <div class="matching-section-heading">

          <h2 class="matching-section-title">
            ② 選擇日期
          </h2>

          <div class="matching-date-heading-actions">
  <span class="matching-selected-count">
    已選 ${selectedCount} 天
  </span>

  ${
    selectedCount > 0
      ? `
        <button
          type="button"
          class="matching-clear-dates-button"
          onclick="clearAllMatchingDates()"
        >
          清除全部
        </button>
      `
      : ""
  }
</div>

        </div>

        <p class="matching-section-description">
          可一次選擇多個日期，
          下一步再逐筆確認與修改時間。
        </p>

        <div id="matchingCalendar"></div>

        <button
          type="button"
          class="matching-primary-button"
          id="continueToCandidateButton"
          onclick="continueToCandidateStep()"
        >
          下一步：確認候選時段
        </button>

      </section>
    `;
  }
  function renderStepThree(
    matching
  ) {
    const selectedCount =
      Array.isArray(
        matching.selectedDates
      )
        ? matching.selectedDates.length
        : 0;

    return `
      <section class="matching-section">

        <div class="matching-status-badge">
          確認中
        </div>

        <div class="matching-step-three-header">

          <div>
            <h2 class="matching-section-title">
              ③ 確認候選時段
            </h2>

            <p class="matching-section-description">
              共選擇 ${selectedCount} 天。
              每一筆都能獨立修改、停用、
              刪除或新增時段。
            </p>
          </div>

          <button
            type="button"
            class="matching-back-to-dates-button"
            onclick="backToDateStep()"
          >
            ← 修改日期
          </button>

        </div>

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

    function renderStepFour(
    matching
  ) {
    const selectedDates =
      Array.isArray(
        matching.selectedDates
      )
        ? matching.selectedDates
        : [];

    const candidateSlots =
      Array.isArray(
        matching.candidateSlots
      )
        ? matching.candidateSlots
        : [];

    const enabledCount =
      candidateSlots.filter(
        function (slot) {
          return (
            slot.enabled !== false &&
            slot.date &&
            slot.time
          );
        }
      ).length;

    return `
      <section class="matching-section">

        <div class="matching-complete-icon">
          🎉
        </div>

        <h2 class="matching-complete-title">
          媒合已建立
        </h2>

        <p class="matching-complete-text">
          接下來將連結分享給玩家，
          就能開始收集可配合時間。
        </p>

        <div class="matching-summary-grid">

          <div class="matching-summary-item">
            <span>候選日期</span>
            <strong>
              ${selectedDates.length} 天
            </strong>
          </div>

          <div class="matching-summary-item">
            <span>候選時段</span>
            <strong>
              ${enabledCount} 個
            </strong>
          </div>

        </div>

        <div class="matching-share-actions">

          <button
            type="button"
            class="matching-primary-button"
            onclick="copyMatchingShareLink()"
          >
            📋 複製分享連結
          </button>

          <button
            type="button"
            class="matching-secondary-button"
            onclick="previewMatchingVotePage()"
          >
            👀 預覽填寫畫面
          </button>

          <button
            type="button"
            class="matching-secondary-button"
            onclick="editPublishedMatching()"
          >
            ✏️ 繼續編輯媒合
          </button>

        </div>

                        <button
          type="button"
          id="matchingResponseSummary"
          class="matching-waiting-note matching-response-detail-button"
          onclick="toggleMatchingMatrix()"
        >
          ${
            getMatchingResponseCount(
              matching
            ) > 0
              ? "目前已有 " +
                getMatchingResponseCount(
                  matching
                ) +
                " 位參與者回覆　›"
              : "目前尚未收到回覆。"
          }
        </button>

        <div
          id="matchingMatrixContainer"
          class="matching-matrix-container"
          hidden
        ></div>

        <div
  id="matchingCreateCarContainer"
  class="matching-create-car-container"
  hidden
></div>

      </section>
    `;
  }

    function renderDraft(
    matching
  ) {
    const currentStep =
      getCurrentStep(
        matching
      );

    if (currentStep === 4) {
      return renderStepFour(
        matching
      );
    }

    if (currentStep === 3) {
      return renderStepThree(
        matching
      );
    }

    return renderStepTwo(
      matching
    );
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
        : renderEmpty(
            car
          );

    if (!matching) {
      return;
    }

    const currentStep =
      getCurrentStep(
        matching
      );

          if (currentStep === 4) {
      if (
        window.JLYMatchingMatrix &&
        typeof window
          .JLYMatchingMatrix
          .render ===
          "function"
      ) {
        window
          .JLYMatchingMatrix
          .render(
            matching
          );
      }

      return;
    }

    if (currentStep === 2) {
      const calendar =
        window.JLYMatchingCalendar;

      if (
        calendar &&
        typeof calendar
          .initializeFromDates ===
          "function"
      ) {
        calendar
          .initializeFromDates(
            matching.selectedDates
          );
      }

      if (
        calendar &&
        typeof calendar
          .renderCalendar ===
          "function"
      ) {
        calendar
          .renderCalendar();
      }

      return;
    }

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
    renderCandidatePreview,
    renderResponseSummary
  };

  console.log(
    "✅ Matching Render V5 已載入"
  );
})();