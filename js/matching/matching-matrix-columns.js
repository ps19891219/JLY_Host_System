/* JLY Matching Matrix structural column lock.
 * Keeps participant names from changing Matrix geometry.
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

  const observer = new MutationObserver(lockColumns);

  function start() {
    const container = document.getElementById("matchingMatrixContainer");
    if (!container) return;
    observer.observe(container, { childList: true, subtree: true });
    lockColumns();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
