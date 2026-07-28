console.log(
  "staff-render.js 已成功載入！"
);

(function () {
  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderStaffRow(
    staff,
    index
  ) {
    const staffId =
      escapeHtml(
        staff.id
      );

    const label =
      String(
        staff.label || ""
      ).trim() ||
      String(index + 1);

    const displayName =
      String(
        staff.displayName || ""
      ).trim() ||
      "尚未安排";

    return `
      <div
        class="seat-row staff-seat-row"
        data-staff-id="${staffId}"
      >
        <div
          class="seat-row-handle"
          aria-hidden="true"
        >
          ☰
        </div>

        <div class="seat-row-main">
          <div class="seat-row-label-cell">
            <button
              type="button"
              class="staff-seat-label"
              onclick="JLYStaffController.editStaffLabel('${staffId}')"
            >
              ${escapeHtml(label)}
            </button>
          </div>

          <div class="seat-row-player-cell">
            <button
              type="button"
              class="staff-seat-person"
              onclick="JLYStaffController.editStaffPerson('${staffId}')"
            >
              ${escapeHtml(
                displayName
              )}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStaff(
    staffSlots
  ) {
    const safeStaffSlots =
      Array.isArray(staffSlots)
        ? staffSlots
        : [];

    let staffContent = "";

    if (
      safeStaffSlots.length === 0
    ) {
      staffContent = `
        <div class="staff-empty">
          尚未建立任何工作人員
        </div>
      `;
    } else {
      staffContent =
        safeStaffSlots
          .map(function (
            staff,
            index
          ) {
            return renderStaffRow(
              staff,
              index
            );
          })
          .join("");
    }

    return `
      <section
        id="staffSection"
        class="staff-section"
      >
        <div class="staff-section-header">
          <h3>
            🎭 工作人員
          </h3>
        </div>

        <div
          id="staffSeatBoardMount"
          class="staff-seat-list"
        >
          ${staffContent}
        </div>

        <button
          type="button"
          class="staff-add-button"
          onclick="JLYStaffController.addStaffSlot()"
        >
          ＋ 新增工作人員
        </button>
      </section>
    `;
  }

  window.JLYStaffRender = {
    renderStaff
  };
})();