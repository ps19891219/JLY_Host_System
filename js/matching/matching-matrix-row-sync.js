/* JLY Matching Matrix row synchronizer.
 * Left is the canonical row track. Center and right mirror each candidate slot
 * by data-slot-id so participant cells cannot drift from the date/total columns.
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

  function lockRow(row, heightValue) {
    if (!row) return;
    const height = px(heightValue || SLOT_ROW_HEIGHT);
    row.style.setProperty("height", height, "important");
    row.style.setProperty("min-height", height, "important");
    row.style.setProperty("max-height", height, "important");
    row.style.setProperty("box-sizing", "border-box", "important");
    row.style.setProperty("margin", "0", "important");
    row.style.setProperty("padding", "0", "important");

    Array.from(row.children).forEach(function (cell) {
      cell.style.setProperty("height", height, "important");
      cell.style.setProperty("min-height", height, "important");
      cell.style.setProperty("max-height", height, "important");
      cell.style.setProperty("box-sizing", "border-box", "important");
      cell.style.setProperty("overflow", "hidden", "important");
      cell.style.setProperty("margin", "0", "important");
    });
  }

  function rowsBySlot(table) {
    const map = new Map();
    if (!table) return map;
    table.querySelectorAll("tbody tr[data-slot-id]").forEach(function (row) {
      map.set(String(row.dataset.slotId || ""), row);
    });
    return map;
  }

  function syncRows() {
    const left = document.querySelector(".matching-matrix-left-table");
    const center = document.querySelector(".matching-matrix-center-table");
    const right = document.querySelector(".matching-matrix-right-table");
    if (!left || !center || !right) return;

    compactLeftSlotRows(left);

    const centerRows = rowsBySlot(center);
    const rightRows = rowsBySlot(right);

    left.querySelectorAll("tbody tr[data-slot-id]").forEach(function (leftRow) {
      const slotId = String(leftRow.dataset.slotId || "");
      if (!slotId) return;

      /* One canonical height for the same logical slot. The center player row and
         right total row are locked from the left slot row, never by row index. */
      lockRow(leftRow, SLOT_ROW_HEIGHT);
      lockRow(centerRows.get(slotId), SLOT_ROW_HEIGHT);
      lockRow(rightRows.get(slotId), SLOT_ROW_HEIGHT);
    });

    /* Keep all three tbody tracks free of browser table spacing differences. */
    [left, center, right].forEach(function (table) {
      const body = table.tBodies && table.tBodies[0];
      if (!body) return;
      body.style.setProperty("margin", "0", "important");
      body.style.setProperty("padding", "0", "important");
      body.style.setProperty("border-spacing", "0", "important");
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

    bootObserver = new MutationObserver(tryStart);
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
