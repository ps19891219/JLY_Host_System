console.log(
  "staff-render.js V3 已成功載入！"
);

(function () {
  "use strict";

  // ============================================================
  // 基礎工具
  // ============================================================

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

  function escapeJsString(value) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n");
  }

  function getText(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  // ============================================================
  // 工作人員資料
  // ============================================================

  function hasAssignedMember(
    staff
  ) {
    const safeStaff =
      staff || {};

    if (
      window.JLYStaffData &&
      typeof window.JLYStaffData
        .hasAssignedMember ===
        "function"
    ) {
      return window.JLYStaffData
        .hasAssignedMember(
          safeStaff
        );
    }

    return Boolean(
      getText(
        safeStaff.memberId
      ) ||
      getText(
        safeStaff.displayName
      )
    );
  }

  function getStaffLabel(
    staff,
    index
  ) {
    const safeStaff =
      staff || {};

    return (
      getText(
        safeStaff.label
      ) ||
      String(index + 1)
    );
  }

  function getStaffDisplayName(
    staff
  ) {
    return getText(
      staff &&
      staff.displayName
    );
  }

  function isStaffCrossPlay(
    staff
  ) {
    const safeStaff =
      staff || {};

    return (
      safeStaff.isCrossPlay ===
        true ||
      Boolean(
        safeStaff.memberSnapshot &&
        safeStaff.memberSnapshot
          .isCrossPlay === true
      )
    );
  }

  // ============================================================
  // 反串狀態
  // ============================================================

  function renderStaffStatus(
    staff
  ) {
    if (
      !isStaffCrossPlay(
        staff
      )
    ) {
      return "";
    }

    return `
      <span
        class="seat-player-status-column"
        aria-label="反串"
      >
        <span
          class="
            seat-player-status-badge
            is-cross-play
          "
          data-player-status="cross-play"
        >
          反串
        </span>
      </span>
    `;
  }

  // ============================================================
  // 名字框
  // ============================================================

  function renderStaffNameBox(
    displayName
  ) {
    return `
      <span
        class="seat-player-name-box"
      >
        <span
          class="seat-player-name"
        >
          ${escapeHtml(
            displayName
          )}
        </span>
      </span>
    `;
  }

  // ============================================================
  // 工作人員內容
  //
  // 結構與玩家 seat-player 一致：
  // 名字框 + 反串
  // ============================================================

  function renderStaffPerson(
    staff,
    jsStaffId
  ) {
    const safeStaff =
      staff || {};

    const displayName =
      getStaffDisplayName(
        safeStaff
      );

    const rawStaffId =
      getText(
        safeStaff.id
      );

    if (!displayName) {
      return `
        <button
          type="button"
          class="
            seat-player
            seat-player-empty
            staff-seat-person
          "
          data-staff-member-drag="true"
          data-staff-id="${escapeHtml(
            rawStaffId
          )}"
          title="選擇工作人員"
          onclick="
            JLYStaffController.editStaffPerson(
              '${jsStaffId}'
            )
          "
        >
          <span
            class="seat-player-name-box"
          >
            <span
              class="seat-player-placeholder"
            >
              尚未安排
            </span>
          </span>
        </button>
      `;
    }

    return `
      <button
        type="button"
        class="
          seat-player
          seat-player-occupied
          staff-seat-person
        "
        draggable="true"
        data-staff-member-drag="true"
        data-staff-id="${escapeHtml(
          rawStaffId
        )}"
        title="點擊更換工作人員"
        onclick="
          JLYStaffController.editStaffPerson(
            '${jsStaffId}'
          )
        "
      >
        ${renderStaffNameBox(
          displayName
        )}

        ${renderStaffStatus(
          safeStaff
        )}
      </button>
    `;
  }

  // ============================================================
  // 刪除欄位
  // ============================================================

  function renderRemoveButton(
    staff,
    jsStaffId
  ) {
    const safeStaff =
      staff || {};

    const description =
      getStaffDisplayName(
        safeStaff
      ) ||
      getText(
        safeStaff.label
      ) ||
      "工作人員欄位";

    return `
      <button
        type="button"
        class="staff-remove-slot"
        aria-label="刪除${escapeHtml(
          description
        )}"
        title="刪除整個工作人員欄位"
        onclick="
          event.stopPropagation();

          JLYStaffController.removeStaffSlot(
            '${jsStaffId}'
          );
        "
      >
        ×
      </button>
    `;
  }

  // ============================================================
  // 單一工作人員列
  // ============================================================

  function renderStaffRow(
    staff,
    index
  ) {
    const safeStaff =
      staff || {};

    const rawStaffId =
      getText(
        safeStaff.id
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

    const assignedClass =
      hasAssignedMember(
        safeStaff
      )
        ? "is-occupied"
        : "is-empty";

    return `
      <div
        class="
          seat-row
          staff-seat-row
          ${assignedClass}
        "
        draggable="true"
        data-staff-row="true"
        data-staff-row-drag="true"
        data-staff-id="${staffId}"
      >
        <div
          class="seat-row-handle"
          title="拖曳整列"
          aria-label="拖曳整列"
        >
          ☰
        </div>

        <div
          class="seat-row-main"
        >
          <div
            class="seat-row-label-cell"
          >
            <button
              type="button"
              class="staff-seat-label"
              title="修改工作人員欄位名稱"
              onclick="
                JLYStaffController.editStaffLabel(
                  '${jsStaffId}'
                )
              "
            >
              ${escapeHtml(
                label
              )}
            </button>
          </div>

          <div
            class="
              seat-row-player-cell
              staff-seat-player-cell
            "
            data-staff-drop-zone="true"
            data-staff-id="${staffId}"
          >
            <div
              class="staff-player-content"
            >
              ${renderStaffPerson(
                safeStaff,
                jsStaffId
              )}
            </div>

            ${renderRemoveButton(
              safeStaff,
              jsStaffId
            )}
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================
  // 空狀態
  // ============================================================

  function renderEmptyState() {
    return `
      <div
        class="staff-empty"
      >
        <div
          class="staff-empty-icon"
        >
          🎭
        </div>

        <div
          class="staff-empty-title"
        >
          目前沒有工作人員
        </div>

        <div
          class="staff-empty-description"
        >
          需要時再新增工作人員欄位。
        </div>
      </div>
    `;
  }

  // ============================================================
  // 工作人員區
  // ============================================================

  function renderStaff(
    staffSlots
  ) {
    const safeStaffSlots =
      Array.isArray(
        staffSlots
      )
        ? staffSlots
        : [];

    const staffContent =
      safeStaffSlots.length > 0
        ? safeStaffSlots
            .map(
              function (
                staff,
                index
              ) {
                return renderStaffRow(
                  staff,
                  index
                );
              }
            )
            .join("")
        : renderEmptyState();

    return `
      <section
        id="staffSection"
        class="staff-section"
      >
        <div
          class="staff-section-header"
        >
          <div>
            <h3>
              🎭 工作人員
            </h3>

            <div
              class="staff-section-description"
            >
              點欄位名稱可修改，點名字可選擇或更換人員。
            </div>
          </div>

          <div
            class="staff-section-count"
          >
            ${safeStaffSlots.length}
            位
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

  // ============================================================
  // 對外公開
  // ============================================================

  window.JLYStaffRender = {
    escapeHtml,
    escapeJsString,
    getText,

    hasAssignedMember,
    getStaffLabel,
    getStaffDisplayName,
    isStaffCrossPlay,

    renderStaffStatus,
    renderStaffNameBox,
    renderStaffPerson,
    renderRemoveButton,
    renderStaffRow,
    renderEmptyState,
    renderStaff
  };

  console.log(
    "✅ Staff Render V3 已載入"
  );
})();