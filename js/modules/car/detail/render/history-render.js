/*
====================================================

JLY Host System V3

Module：
Car Detail History Render

用途：
1. 顯示車團歷史紀錄
2. 顯示空紀錄狀態
3. 將最新紀錄排列在上方

規則：
- 只建立 HTML
- 不讀取 Firestore
- 不寫入 Firestore
- 不修改 History
- 不操作頁面其他模組

依賴：
- window.escapeHtml

====================================================
*/

console.log(
  "history-render.js 已成功載入！"
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
  // 整理時間顯示
  // ------------------------------------------------------------

  function formatHistoryTime(value) {
    if (!value) {
      return "";
    }

    // Firestore Timestamp
    if (
      value &&
      typeof value.toDate ===
        "function"
    ) {
      try {
        return value
          .toDate()
          .toLocaleString(
            "zh-TW"
          );
      } catch (error) {
        return String(value);
      }
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return date.toLocaleString(
      "zh-TW",
      {
        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    );
  }

  // ------------------------------------------------------------
  // 建立單筆歷史紀錄
  // ------------------------------------------------------------

  function buildHistoryItemHtml(
    item
  ) {
    const source =
      item &&
      typeof item === "object"
        ? item
        : {};

    return `
      <div class="history-item">
        <strong>
          ${escapeValue(
            source.type ||
            "紀錄"
          )}
        </strong>

        <p>
          ${escapeValue(
            source.text ||
            ""
          )}
        </p>

        <small>
          ${escapeValue(
            formatHistoryTime(
              source.time
            )
          )}
        </small>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 建立歷史紀錄內容
  // ------------------------------------------------------------

  function buildHistoryListHtml(
    history
  ) {
    const sourceHistory =
      Array.isArray(history)
        ? history
        : [];

    if (
      sourceHistory.length === 0
    ) {
      return `
        <p class="empty-text">
          尚無紀錄
        </p>
      `;
    }

    return sourceHistory
      .slice()
      .reverse()
      .map(
        buildHistoryItemHtml
      )
      .join("");
  }

  // ------------------------------------------------------------
  // 建立完整歷史區
  // ------------------------------------------------------------

  function buildHistorySectionHtml(
    history
  ) {
    return `
      <div class="card">
        <h3>
          📜 車團紀錄
        </h3>

        ${buildHistoryListHtml(
          history
        )}
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailHistoryRender = {
    escapeValue,

    formatHistoryTime,

    buildHistoryItemHtml,

    buildHistoryListHtml,

    buildHistorySectionHtml
  };

  console.log(
    "✅ Car Detail History Render 已載入"
  );
})();