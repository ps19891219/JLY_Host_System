/*
====================================================

JLY Host System V3

Module：
Car Detail Seat Section Render

用途：
1. 建立席位安排區外框
2. 顯示席位設定入口
3. 組合工作人員區
4. 建立 Seat Engine 掛載容器

規則：
- 只產生 HTML
- 不讀寫 Firestore
- 不計算席位統計
- 不操作玩家
- 不操作 Seat Engine
- Seat Summary 由 Seat Engine 負責

依賴：
- window.JLYStaffController

====================================================
*/

console.log(
  "seat-section-render.js 已成功載入！"
);

(function () {
  "use strict";

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
      console.warn(
        "Seat Section Render：Staff Controller 尚未載入"
      );

      return "";
    }

    return controller.render(
      car || {}
    );
  }

  // ------------------------------------------------------------
  // Seat Engine 掛載內容
  // ------------------------------------------------------------

  function buildSeatMountHtml() {
    return `
      <div id="seatBoardMount">
        <div class="seat-empty-state">
          座位載入中……
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 完整席位區
  // ------------------------------------------------------------

  function buildSeatSectionHtml(car) {
    return `
      <section class="seat-section" id="seatSection">
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

        ${buildSeatMountHtml()}
      </section>
    `;
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailSeatSectionRender = {
    buildStaffSectionHtml,

    buildSeatMountHtml,

    buildSeatSectionHtml
  };

  console.log(
    "✅ Car Detail Seat Section Render 已載入"
  );
})();
