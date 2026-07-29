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

  function escapeJsString(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n");
  }

  function hasAssignedMember(
    staff
  ) {
    const safeStaff =
      staff || {};

    return Boolean(
      String(
        safeStaff.memberId || ""
      ).trim() ||
      String(
        safeStaff.displayName || ""
      ).trim()
    );
  }

  function getStaffLabel(
    staff,
    index
  ) {
    const safeStaff =
      staff || {};

    return (
      String(
        safeStaff.label || ""
      ).trim() ||
      String(index + 1)
    );
  }

  function getStaffDisplayName(
    staff
  ) {
    const safeStaff =
      staff || {};

    return (
      String(
        safeStaff.displayName || ""
      ).trim() ||
      "尚未安排"
    );
  }

  function renderClearButton(
    staff,
    staffId
  ) {
    if (
      !hasAssignedMember(staff)
    ) {
      return "";
    }

    return `
      <button
        type="button"
        class="staff-clear-person"
        aria-label="清除工作人員"
        title="清除已安排人員"
        onclick="
          event.stopPropagation();
          JLYStaffController.clearStaffPerson(
            '${escapeJsString(staffId)}'
          );
        "
      >
        ×
      </button>
    `;
  }

  function renderStaffRow(
    staff,
    index
  ) {
    const safeStaff =
      staff || {};

    const rawStaffId =
      String(
        safeStaff.id || ""
      );

    const staffId =
      escapeHtml(
        rawStaffId
      );

    const jsStaffId =
      escapeJsString(
        rawStaffId
      );

    const label =
      getStaffLabel(
        safeStaff,
        index
      );

    const displayName =
      getStaffDisplayName(
        safeStaff
      );

    const assignedClass =
      hasAssignedMember(
        safeStaff
      )
        ? "is-assigned"
        : "is-empty";

    return `
      <div
        class="
          seat-row
          staff-seat-row
          ${assignedClass}
        "
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
              title="修改工作人員稱謂"
              onclick="
                JLYStaffController.editStaffLabel(
                  '${jsStaffId}'
                )
              "
            >
              ${escapeHtml(label)}
            </button>
          </div>

          <div class="seat-row-player-cell">
            <button
              type="button"
              class="staff-seat-person"
              title="選擇或更換工作人員"
              onclick="
                JLYStaffController.editStaffPerson(
                  '${jsStaffId}'
                )
              "
            >
              <span class="staff-seat-person-name">
                ${escapeHtml(
                  displayName
                )}
              </span>
            </button>

            ${renderClearButton(
              safeStaff,
              rawStaffId
            )}
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
          <div class="staff-empty-icon">
            🎭
          </div>

          <div class="staff-empty-title">
            尚未建立工作人員
          </div>

          <div class="staff-empty-description">
            可新增 DM、主持人或其他工作人員。
          </div>
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
          <div>
            <h3>
              🎭 工作人員
            </h3>

            <div class="staff-section-description">
              點擊稱謂可修改職稱，點擊姓名可搜尋會員。
            </div>
          </div>

          <div class="staff-section-count">
            ${safeStaffSlots.length} 位
          </div>
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
          onclick="
            JLYStaffController.addStaffSlot()
          "
        >
          ＋ 新增工作人員
        </button>
      </section>
    `;
  }

  window.JLYStaffRender = {
    escapeHtml,
    renderStaffRow,
    renderStaff
  };
})();