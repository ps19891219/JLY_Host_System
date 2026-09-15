/* JLY Matching Matrix per-slot row synchronizer.
 * Left / center / right are separate tables, so synchronize each candidate slot
 * to the rendered height of the left date/time row. This keeps every slot on the
 * same horizontal line without changing matching data or response semantics.
 */
(function () {
  "use strict";

  function px(value) {
    return Math.ceil(value) + "px";
  }

  function syncRows() {
    const left = document.querySelector(".matching-matrix-left-table");
    const center = document.querySelector(".matching-matrix-center-table");
    const right = document.querySelector(".matching-matrix-right-table");
    if (!left || !center || !right) return;

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

    /* Remove the old synthetic 64/66px row lock before measuring the canonical
       left date/time row. Its real rendered content height is the source of truth. */
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
