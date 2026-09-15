/* JLY Matching Matrix row synchronizer.
 * Left / center / right are separate tables, but every candidate-slot row uses
 * exactly the same fixed height. This avoids cumulative drift on mobile Safari.
 */
(function () {
  "use strict";

  const SLOT_ROW_HEIGHT = 72;

  function px(value) {
    return value + "px";
  }

  function compactLeftSlotRows(left) {
    left.querySelectorAll("tbody tr[data-slot-id]").forEach(function (row) {
      const label = row.querySelector(".matching-matrix-slot-label");
      const time = row.querySelector(".matching-matrix-slot-time");
      if (!label || !time) return;

      label.style.display = "inline";
      time.style.display = "inline";
      time.style.marginLeft = "6px";
      time.style.whiteSpace = "nowrap";
    });
  }

  function lockRow(row) {
    if (!row) return;
    const height = px(SLOT_ROW_HEIGHT);
    row.style.height = height;
    row.style.minHeight = height;
    row.style.maxHeight = height;
    row.style.boxSizing = "border-box";

    Array.from(row.children).forEach(function (cell) {
      cell.style.height = height;
      cell.style.minHeight = height;
      cell.style.maxHeight = height;
      cell.style.boxSizing = "border-box";
      cell.style.overflow = "hidden";
    });
  }

  function syncRows() {
    const left = document.querySelector(".matching-matrix-left-table");
    const center = document.querySelector(".matching-matrix-center-table");
    const right = document.querySelector(".matching-matrix-right-table");
    if (!left || !center || !right) return;

    compactLeftSlotRows(left);

    [left, center, right].forEach(function (table) {
      table.querySelectorAll("tbody tr[data-slot-id]").forEach(lockRow);
    });
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        scheduled = false;
        syncRows();
      });
    });
  }

  function start() {
    const container = document.getElementById("matchingMatrixContainer");
    if (!container) return;
    new MutationObserver(schedule).observe(container, { childList: true, subtree: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
