/*
====================================================

JLY Host System V3

Module：
Car Detail Page Render

用途：
1. 組合車團詳情頁
2. 呼叫 Summary Render
3. 呼叫 Seat Section Render
4. 組合待確認申請區
5. 呼叫 History Render

規則：
- 只產生 HTML
- 不讀取 Firestore
- 不寫入 Firestore
- 不安排玩家
- 不操作 Seat Engine

依賴：
- window.buildCarNavigation
- window.buildApplicationsHtml
- window.JLYCarDetailSummaryRender
- window.JLYCarDetailSeatSectionRender
- window.JLYCarDetailHistoryRender

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
      return window.escapeHtml(
        value
      );
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
  // Summary Render
  // ------------------------------------------------------------

  function getSummaryRenderModule() {
    const module =
      window
        .JLYCarDetailSummaryRender;

    if (!module) {
      throw new Error(
        "Summary Render 模組尚未載入"
      );
    }

    return module;
  }

  function buildCarSummaryHtml(
    config
  ) {
    return getSummaryRenderModule()
      .buildSummaryHtml(
        config
      );
  }

  // ------------------------------------------------------------
  // Seat Section Render
  // ------------------------------------------------------------

  function getSeatSectionRenderModule() {
    const module =
      window
        .JLYCarDetailSeatSectionRender;

    if (!module) {
      throw new Error(
        "Seat Section Render 模組尚未載入"
      );
    }

    return module;
  }

  function buildStaffSectionHtml(
    car
  ) {
    return getSeatSectionRenderModule()
      .buildStaffSectionHtml(
        car
      );
  }

  function buildSeatSectionHtml(
    car
  ) {
    return getSeatSectionRenderModule()
      .buildSeatSectionHtml(
        car
      );
  }

    // ------------------------------------------------------------
  // Matching Confirmation Render
  //
  // 媒合完成後，若仍有玩家需要確認最終時間，
  // 在一般車團詳情頁暫時顯示確認卡。
  //
  // 規則：
  // - 只產生 HTML
  // - 不修改 Firestore
  // - 不直接移除玩家
  // - 所有人處理完成後，自動不再顯示
  // ------------------------------------------------------------

  function buildMatchingConfirmationSectionHtml(
    car
  ) {
    const confirmation =
      car &&
      car.matchingConfirmation &&
      typeof car.matchingConfirmation ===
        "object"
        ? car.matchingConfirmation
        : null;

    if (
      !confirmation ||
      confirmation.status !==
        "pending"
    ) {
      return "";
    }

    const players =
      Array.isArray(
        confirmation.players
      )
        ? confirmation.players
        : [];

    const pendingPlayers =
      players.filter(
        function (player) {
          return (
            player &&
            player.resolved !== true
          );
        }
      );

        if (
      pendingPlayers.length === 0
    ) {
      return `
        <section
          class="card matching-confirmation-card"
        >
          <div
            class="matching-confirmation-complete"
          >
            <div>
              <h3>
                ✅ 玩家時間確認完成
              </h3>

              <p>
                所有待確認玩家都已處理，
                按下完成後將恢復一般車團畫面。
              </p>
            </div>

            <button
              type="button"
              class="matching-confirmation-finish-button"
              onclick="finalizeMatchingConfirmation()"
            >
              確認完成
            </button>
          </div>
        </section>
      `;
    }

    const playerCards =
      pendingPlayers
        .map(
          function (player) {
            const playerId =
              escapeValue(
                player.playerId ||
                ""
              );

            const playerName =
              escapeValue(
                player.playerName ||
                "未命名玩家"
              );

            const availability =
              player.availability ===
                "no_response"
                ? "尚未回覆媒合"
                : "未勾選這個時間";

            return `
              <div
                class="matching-confirmation-player"
              >
                <div
                  class="matching-confirmation-player-info"
                >
                  <strong>
                    ${playerName}
                  </strong>

                  <span>
                    ${availability}
                  </span>
                </div>

                <div
                  class="matching-confirmation-player-actions"
                >
                  <button
                    type="button"
                    class="matching-confirmation-keep-button"
                    onclick="
                      confirmMatchingPlayerKeep(
                        '${playerId}'
                      )
                    "
                  >
                    確認保留
                  </button>

                  <button
                    type="button"
                    class="matching-confirmation-remove-button"
                    onclick="
                      removeMatchingPlayer(
                        '${playerId}'
                      )
                    "
                  >
                    移出車團
                  </button>
                </div>
              </div>
            `;
          }
        )
        .join("");

    return `
      <section
        class="card matching-confirmation-card"
      >
        <div
          class="matching-confirmation-heading"
        >
          <div>
            <h3>
              ⚠️ 媒合時間待確認
            </h3>

            <p>
              最終時間已確定，
              還有 ${pendingPlayers.length}
              位玩家需要確認。
            </p>
          </div>

          <span
            class="matching-confirmation-count"
          >
            ${pendingPlayers.length} 人
          </span>
        </div>

        <div
          class="matching-confirmation-list"
        >
          ${playerCards}
        </div>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // Application Render
  //
  // 目前申請卡內容仍由 cardetail.js 的
  // window.buildApplicationsHtml() 提供。
  // 下一階段再將申請動作與畫面一起搬至 Application 模組。
  // ------------------------------------------------------------

  function buildApplicationsSectionHtml(
    applications
  ) {
    const builder =
      window.buildApplicationsHtml;

    const safeApplications =
      Array.isArray(
        applications
      )
        ? applications
        : [];

    const content =
      typeof builder ===
        "function"
        ? builder(
            safeApplications
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
  // History Render
  // ------------------------------------------------------------

  function getHistoryRenderModule() {
    const module =
      window
        .JLYCarDetailHistoryRender;

    if (!module) {
      throw new Error(
        "History Render 模組尚未載入"
      );
    }

    return module;
  }

  function buildHistorySectionHtml(
    history
  ) {
    return getHistoryRenderModule()
      .buildHistorySectionHtml(
        history
      );
  }

  // ------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------

  function buildNavigationHtml(
    scriptName
  ) {
    const builder =
      window.buildCarNavigation;

    if (
      typeof builder !==
        "function"
    ) {
      console.warn(
        "Car Navigation 尚未載入"
      );

      return "";
    }

    return builder(
      scriptName || ""
    );
  }

  function buildLineGroupBindingHtml(car) {
    const carId = escapeValue(car && (car.id || car.carId));
    if (!carId) {
      return "";
    }

    return `
      <section class="card line-group-binding-card">
        <div>
          <h3>LINE 群組記帳</h3>
          <p>產生 10 分鐘內有效的一次性配對碼，貼到 LINE 群組後再確認車團資料。</p>
        </div>
        <button
          type="button"
          class="line-group-binding-button"
          onclick="copyLineGroupBindingCommand('${carId}', this)"
        >
          產生 LINE 群組配對碼
        </button>
      </section>
    `;
  }

  function buildAccountingSectionHtml() {
    const renderer = window.JLYAccountingRender;

    if (
      renderer &&
      typeof renderer.buildShellHtml === "function"
    ) {
      return renderer.buildShellHtml();
    }

    return `
      <section class="card accounting-card" id="accountingSection">
        <h3>💰 車團帳務</h3>
        <p>帳務模組載入中...</p>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // 完整頁面
  // ------------------------------------------------------------

  function buildPageHtml(config) {
    const safeConfig =
      config &&
      typeof config ===
        "object"
        ? config
        : {};

    const car =
      safeConfig.car &&
      typeof safeConfig.car ===
        "object"
        ? safeConfig.car
        : {};

    const applications =
      Array.isArray(
        safeConfig.applications
      )
        ? safeConfig.applications
        : [];

    const history =
      Array.isArray(
        safeConfig.history
      )
        ? safeConfig.history
        : [];

    return `
      ${buildNavigationHtml(
        safeConfig.scriptName
      )}

      ${buildCarSummaryHtml(
        safeConfig
      )}

      ${buildAccountingSectionHtml()}

      ${buildLineGroupBindingHtml(
        car
      )}

      ${buildMatchingConfirmationSectionHtml(
        car
      )}

      ${buildSeatSectionHtml(
        car
      )}

      ${buildApplicationsSectionHtml(
        applications
      )}

      ${buildHistorySectionHtml(
        history
      )}
    `;
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailPageRender = {
    escapeValue,

    buildCarSummaryHtml,

    buildStaffSectionHtml,

    buildSeatSectionHtml,

    buildMatchingConfirmationSectionHtml,

    buildApplicationsSectionHtml,

    buildHistorySectionHtml,

    buildNavigationHtml,

    buildLineGroupBindingHtml,

    buildAccountingSectionHtml,

    buildPageHtml
  };

  console.log(
    "✅ Car Detail Page Render 已載入"
  );
})();
