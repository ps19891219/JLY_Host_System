/* JLY Matching Matrix row synchronizer.
 * Left / center / right are separate tables, but every candidate-slot row uses
 * exactly the same fixed height. This avoids cumulative drift on mobile Safari.
 */
(function () {
  "use strict";

  const SLOT_ROW_HEIGHT = 72;
  let containerObserver = null;
  let bootObserver = null;
  let started = false;

  function px(value) {
    return value + "px";
  }

  function compactLeftSlotRows(left) {
    left.querySelectorAll("tbody tr[data-slot-id]").forEach(function (row) {
      const label = row.querySelector(".matching-matrix-slot-label");
      const time = row.querySelector(".matching-matrix-slot-time");
      if (!label || !time) return;

      label.style.setProperty("display", "inline", "important");
      time.style.setProperty("display", "inline", "important");
      time.style.setProperty("margin-left", "6px", "important");
      time.style.setProperty("margin-top", "0", "important");
      time.style.setProperty("white-space", "nowrap", "important");
    });
  }

  function lockRow(row) {
    if (!row) return;
    const height = px(SLOT_ROW_HEIGHT);
    row.style.setProperty("height", height, "important");
    row.style.setProperty("min-height", height, "important");
    row.style.setProperty("max-height", height, "important");
    row.style.boxSizing = "border-box";

    Array.from(row.children).forEach(function (cell) {
      cell.style.setProperty("height", height, "important");
      cell.style.setProperty("min-height", height, "important");
      cell.style.setProperty("max-height", height, "important");
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

  function attachToContainer(container) {
    if (!container || started) return false;
    started = true;
    containerObserver = new MutationObserver(schedule);
    containerObserver.observe(container, { childList: true, subtree: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });
    schedule();
    return true;
  }

  function tryStart() {
    const container = document.getElementById("matchingMatrixContainer");
    if (attachToContainer(container) && bootObserver) {
      bootObserver.disconnect();
      bootObserver = null;
    }
  }

  function start() {
    tryStart();
    if (started) return;

    /* matchingMatrixContainer is created asynchronously by matching-render.js
       after Firestore data loads. Watch until that real container exists instead
       of returning permanently during DOMContentLoaded. */
    bootObserver = new MutationObserver(tryStart);
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
