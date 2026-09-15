/* JLY Matching Matrix structural column + long-list lock.
 * Keeps participant names from changing Matrix geometry and prevents
 * iOS horizontal overflow wrappers from collapsing long Matrix content.
 */
(function () {
  "use strict";

  const COLUMN_WIDTH = 72;

  function lockColumns() {
    const table = document.querySelector(".matching-matrix-center-table");
    if (!table) return;

    const headers = table.querySelectorAll("thead .matching-matrix-name-row > th");
    const count = headers.length;
    if (!count) return;

    let colgroup = table.querySelector("colgroup[data-matching-fixed-columns]");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      colgroup.setAttribute("data-matching-fixed-columns", "true");
      table.insertBefore(colgroup, table.firstChild);
    }

    if (colgroup.children.length !== count) {
      colgroup.replaceChildren();
      for (let i = 0; i < count; i += 1) {
        const col = document.createElement("col");
        col.style.width = COLUMN_WIDTH + "px";
        col.style.minWidth = COLUMN_WIDTH + "px";
        col.style.maxWidth = COLUMN_WIDTH + "px";
        colgroup.appendChild(col);
      }
    }

    const exactWidth = count * COLUMN_WIDTH;
    table.style.width = exactWidth + "px";
    table.style.minWidth = exactWidth + "px";
    table.style.maxWidth = exactWidth + "px";
    table.style.tableLayout = "fixed";

    headers.forEach(function (header) {
      header.style.width = COLUMN_WIDTH + "px";
      header.style.minWidth = COLUMN_WIDTH + "px";
      header.style.maxWidth = COLUMN_WIDTH + "px";
      header.style.overflow = "hidden";
    });

    table.querySelectorAll("tbody td").forEach(function (cell) {
      cell.style.width = COLUMN_WIDTH + "px";
      cell.style.minWidth = COLUMN_WIDTH + "px";
      cell.style.maxWidth = COLUMN_WIDTH + "px";
    });
  }

  function lockLongListHeight() {
    const layout = document.querySelector(".matching-matrix-layout-v2");
    const middle = document.querySelector(".matching-matrix-scroll-middle");
    const centerTable = document.querySelector(".matching-matrix-center-table");
    const leftTable = document.querySelector(".matching-matrix-left-table");
    const rightTable = document.querySelector(".matching-matrix-right-table");
    if (!layout || !middle || !centerTable || !leftTable || !rightTable) return;

    /* Do not give the horizontal scroller its own vertical clipping context. */
    middle.style.height = "auto";
    middle.style.maxHeight = "none";
    middle.style.minHeight = "0";
    middle.style.overflowX = "auto";
    middle.style.overflowY = "hidden";

    centerTable.style.height = "auto";
    centerTable.style.maxHeight = "none";

    /* All three tables render the same slots. Explicitly size the grid row to
       the tallest complete table so Safari cannot stop the middle/right track
       at an intermediate paint height. */
    const fullHeight = Math.max(
      leftTable.scrollHeight,
      centerTable.scrollHeight,
      rightTable.scrollHeight
    );

    if (fullHeight > 0) {
      layout.style.minHeight = fullHeight + "px";
      middle.style.minHeight = fullHeight + "px";
      middle.style.height = fullHeight + "px";
    }
  }

  let scheduled = false;
  function applyLocks() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      lockColumns();
      lockLongListHeight();
    });
  }

  const observer = new MutationObserver(applyLocks);

  function start() {
    const container = document.getElementById("matchingMatrixContainer");
    if (!container) return;
    observer.observe(container, { childList: true, subtree: true });
    applyLocks();
    window.addEventListener("resize", applyLocks, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
