/* JLY Matching Matrix per-slot row synchronizer.
 * Left / center / right are separate tables. The left date/time row is the
 * canonical height for each candidate slot. Keep label + time on one line to
 * make the matrix compact, then mirror that real rendered height to center/right.
 */
(function () {
  "use strict";

  function px(value) {
    return Math.ceil(value) + "px";
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

  function syncRows() {
    const left = document.querySelector(".matching-matrix-left-table");
    const center = document.querySelector(".matching-matrix-center-table");
    const right = document.querySelector(".matching-matrix-right-table");
    if (!left || !center || !right) return;

    compactLeftSlotRows(left);

    const leftRows = Array.from(left.querySelectorAll("tbody tr[data-slot-id]"));
    const centerRows = new Map(
      Array.from(center.querySelectorAll("tbody tr[data-slot-id]")).map(function (row) {
        return [row.dataset.slotId, row];
      })
    );
    const rightRows = new Map(
      Array.from(right.querySelectorAll("tbody tr[data-slot-id]")).map(function (row) {
        return [row.dataset.slotId, row];
      })
    );

    /* Clear the legacy 64/66px lock first. The left date cell is the source of
       truth, so center/right never calculate their own independent row height. */
    [left, center, right].forEach(function (table) {
      table.querySelectorAll("tbody tr, tbody th, tbody td").forEach(function (node) {
        node.style.height = "auto";
        node.style.minHeight = "0";
        node.style.maxHeight = "none";
      });
    });

    leftRows.forEach(function (leftRow) {
      const slotId = leftRow.dataset.slotId;
      const leftCell = leftRow.querySelector("th, td");
      const measured = Math.max(
        leftRow.getBoundingClientRect().height,
        leftCell ? leftCell.getBoundingClientRect().height : 0,
        leftCell ? leftCell.scrollHeight : 0
      );
      if (!measured) return;

      [leftRow, centerRows.get(slotId), rightRows.get(slotId)].forEach(function (row) {
        if (!row) return;
        row.style.height = px(measured);
        row.style.minHeight = px(measured);
        row.style.maxHeight = px(measured);
        Array.from(row.children).forEach(function (cell) {
          cell.style.height = "100%";
          cell.style.minHeight = "0";
          cell.style.maxHeight = "none";
          cell.style.boxSizing = "border-box";
        });
      });
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
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
