/* JLY Matching Matrix structural renderer guard.
 * Matrix V2 intentionally keeps left / participant / total as three synchronized
 * views over the same candidateSlots. On iOS Safari, very long native table
 * fragments inside the horizontal scroller can stop painting while the DOM rows
 * still exist. Keep the existing Matrix data/render contract, but render the
 * generated table sections as block/flex rows so every candidate row paints.
 */
(function () {
  "use strict";

  const COLUMN_WIDTH = 72;
  const HEADER_GROUP_HEIGHT = 30;
  const HEADER_NAME_HEIGHT = 48;
  const ROW_HEIGHT = window.matchMedia("(max-width: 420px)").matches ? 64 : 66;

  function px(value) {
    return value + "px";
  }

  function setBox(node, width) {
    if (!node) return;
    node.style.boxSizing = "border-box";
    if (width != null) {
      node.style.width = px(width);
      node.style.minWidth = px(width);
      node.style.maxWidth = px(width);
      node.style.flex = "0 0 " + px(width);
    }
  }

  function makeSectionRows(table, rowWidth) {
    if (!table) return;

    table.style.display = "block";
    table.style.tableLayout = "auto";
    table.style.borderCollapse = "separate";
    table.style.borderSpacing = "0";
    table.style.height = "auto";
    table.style.maxHeight = "none";
    if (rowWidth) setBox(table, rowWidth);

    const thead = table.tHead;
    const tbody = table.tBodies && table.tBodies[0];
    if (thead) thead.style.display = "block";
    if (tbody) {
      tbody.style.display = "block";
      tbody.style.height = "auto";
      tbody.style.maxHeight = "none";
      tbody.style.overflow = "visible";
    }

    table.querySelectorAll("thead tr").forEach(function (row) {
      row.style.display = "flex";
      row.style.width = "100%";
    });

    table.querySelectorAll("tbody tr").forEach(function (row) {
      row.style.display = "flex";
      row.style.width = "100%";
      row.style.height = px(ROW_HEIGHT);
      row.style.minHeight = px(ROW_HEIGHT);
      row.style.maxHeight = px(ROW_HEIGHT);
    });
  }

  function lockSideTable(table, width) {
    if (!table) return;
    makeSectionRows(table, width);

    const groupCell = table.querySelector("thead .matching-matrix-group-row > th");
    const nameCell = table.querySelector("thead .matching-matrix-name-row > th");
    setBox(groupCell, width);
    setBox(nameCell, width);
    if (groupCell) groupCell.style.height = px(HEADER_GROUP_HEIGHT);
    if (nameCell) nameCell.style.height = px(HEADER_NAME_HEIGHT);

    table.querySelectorAll("tbody th, tbody td").forEach(function (cell) {
      setBox(cell, width);
      cell.style.height = px(ROW_HEIGHT);
      cell.style.minHeight = px(ROW_HEIGHT);
      cell.style.maxHeight = px(ROW_HEIGHT);
    });
  }

  function lockCenterTable(table) {
    if (!table) return 0;
    const headers = Array.from(
      table.querySelectorAll("thead .matching-matrix-name-row > th")
    );
    const count = headers.length;
    if (!count) return 0;

    /* Remove the previous colgroup workaround. Native table column layout is no
       longer used by the long-list renderer. */
    table.querySelectorAll("colgroup[data-matching-fixed-columns]").forEach(function (node) {
      node.remove();
    });

    const exactWidth = count * COLUMN_WIDTH;
    makeSectionRows(table, exactWidth);

    const groupRow = table.querySelector("thead .matching-matrix-group-row");
    const nameRow = table.querySelector("thead .matching-matrix-name-row");
    if (groupRow) groupRow.style.height = px(HEADER_GROUP_HEIGHT);
    if (nameRow) nameRow.style.height = px(HEADER_NAME_HEIGHT);

    headers.forEach(function (header) {
      setBox(header, COLUMN_WIDTH);
      header.style.height = px(HEADER_NAME_HEIGHT);
      header.style.overflow = "hidden";
    });

    /* Group headers retain their colspan meaning visually by using the number of
       participant columns represented by the DOM colSpan. */
    table.querySelectorAll("thead .matching-matrix-group-row > th").forEach(function (header) {
      const span = Math.max(1, Number(header.colSpan) || 1);
      setBox(header, span * COLUMN_WIDTH);
      header.style.height = px(HEADER_GROUP_HEIGHT);
    });

    table.querySelectorAll("tbody td").forEach(function (cell) {
      setBox(cell, COLUMN_WIDTH);
      cell.style.height = px(ROW_HEIGHT);
      cell.style.minHeight = px(ROW_HEIGHT);
      cell.style.maxHeight = px(ROW_HEIGHT);
    });

    return exactWidth;
  }

  function renderStructure() {
    const layout = document.querySelector(".matching-matrix-layout-v2");
    const leftWrap = document.querySelector(".matching-matrix-fixed-left");
    const middle = document.querySelector(".matching-matrix-scroll-middle");
    const rightWrap = document.querySelector(".matching-matrix-fixed-right");
    const leftTable = document.querySelector(".matching-matrix-left-table");
    const centerTable = document.querySelector(".matching-matrix-center-table");
    const rightTable = document.querySelector(".matching-matrix-right-table");
    if (!layout || !leftWrap || !middle || !rightWrap || !leftTable || !centerTable || !rightTable) return;

    const leftWidth = leftWrap.getBoundingClientRect().width || 112;
    const rightWidth = rightWrap.getBoundingClientRect().width || 58;

    lockSideTable(leftTable, leftWidth);
    const centerWidth = lockCenterTable(centerTable);
    lockSideTable(rightTable, rightWidth);

    middle.style.overflowX = "auto";
    middle.style.overflowY = "visible";
    middle.style.webkitOverflowScrolling = "touch";
    middle.style.height = "auto";
    middle.style.minHeight = "0";
    middle.style.maxHeight = "none";
    if (centerWidth) centerTable.style.width = px(centerWidth);

    /* No synthetic wrapper height. Grid stretches naturally from the complete
       block rows, so left, middle and right share the same full document height. */
    [layout, leftWrap, middle, rightWrap].forEach(function (node) {
      node.style.height = "auto";
      node.style.minHeight = "0";
      node.style.maxHeight = "none";
    });
  }

  let scheduled = false;
  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      renderStructure();
    });
  }

  const observer = new MutationObserver(scheduleRender);

  function start() {
    const container = document.getElementById("matchingMatrixContainer");
    if (!container) return;
    observer.observe(container, { childList: true, subtree: true });
    scheduleRender();
    window.addEventListener("resize", scheduleRender, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
