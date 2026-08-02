(function () {
  "use strict";

  function escapeHtml(
    value
  ) {
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

  function renderEmpty(
    car
  ) {
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
          常用時段
        </h2>

        ${
          commonSlots
            .map(function (
              slot
            ) {
              return `
                <div>
                  ${escapeHtml(
                    slot.icon
                  )}
                  ${escapeHtml(
                    slot.label
                  )}
                  ${escapeHtml(
                    slot.time
                  )}
                </div>
              `;
            })
            .join("")
        }

        <p class="matching-meta">
          下一步會加入時段編輯、
          月曆多選與行程提醒。
        </p>

      </section>
    `;
  }

  function renderApp(
    car
  ) {
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
  }

  function renderError(
    error
  ) {
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
    "✅ Matching Render V1 已載入"
  );
})();