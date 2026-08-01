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

    buildApplicationsSectionHtml,

    buildHistorySectionHtml,

    buildNavigationHtml,

    buildPageHtml
  };

  console.log(
    "✅ Car Detail Page Render 已載入"
  );
})();