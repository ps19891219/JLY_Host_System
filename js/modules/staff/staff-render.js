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
    return Boolean(
      String(
        staff.memberId || ""
      ).trim() ||
      String(
        staff.displayName || ""
      ).trim()
    );
  }

  function getStaffLabel(
    staff,
    index
  ) {
    return (
      String(
        staff.label || ""
      ).trim() ||
      String(index + 1)
    );
  }

  function getStaffDisplayName(
    staff
  ) {
    return (
      String(
        staff.displayName || ""
      ).trim() ||
      "尚未安排"
    );
  }

  function renderMemberStatus(
    staff
  ) {
    if (
      String(
        staff.memberId || ""
      ).trim()
    ) {
      return `
        <span
          class="staff-member-status"
          title="已連結會員資料"
        >
          已連結
        </span>
      `;
    }

    if (
      String(
        staff.displayName || ""
      ).trim()
    ) {
      return `
        <span
          class="staff-member-status staff-member-status-manual"
          title="舊資料或手動名稱"
        >
          手動名稱
        </span>
      `;
    }

    return "";
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
    const rawStaffId =
      String(
        staff.id || ""
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
        staff,
        index
      );

    const displayName =
      getStaffDisplayName(
        staff
      );

    const assignedClass =
      hasAssignedMember(staff)
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

              ${renderMemberStatus(
                staff
              )}
            </button>

            ${renderClearButton(
              staff,
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