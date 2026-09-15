/* JLY Matching Matrix structural renderer guard.
 * Matrix V2 keeps left / participant / total as three synchronized views.
 * tbody row heights are owned by matching-matrix-row-sync.js.
 * This file owns structure, widths and the shared visible header track.
 */
(function () {
  "use strict";

  const COLUMN_WIDTH = 72;
  const HEADER_HEIGHT = 78;

  function px(value) {
    return value + "px";
  }

  function setBox(node, width) {
    if (!node) return;
    node.style.setProperty("box-sizing", "border-box", "important");
    if (width != null) {
      node.style.setProperty("width", px(width), "important");
      node.style.setProperty("min-width", px(width), "important");
      node.style.setProperty("max-width", px(width), "important");
      node.style.setProperty("flex", "0 0 " + px(width), "important");
    }
  }

  function hideGroupRow(table) {
    const row = table && table.querySelector("thead .matching-matrix-group-row");
    if (!row) return;
    row.style.setProperty("display", "none", "important");
    row.style.setProperty("height", "0", "important");
    row.style.setProperty("min-height", "0", "important");
    row.style.setProperty("max-height", "0", "important");
    row.style.setProperty("overflow", "hidden", "important");
  }

  function lockVisibleHeader(row) {
    if (!row) return;
    row.style.setProperty("display", "flex", "important");
    row.style.setProperty("width", "100%", "important");
    row.style.setProperty("height", px(HEADER_HEIGHT), "important");
    row.style.setProperty("min-height", px(HEADER_HEIGHT), "important");
    row.style.setProperty("max-height", px(HEADER_HEIGHT), "important");
    row.style.setProperty("box-sizing", "border-box", "important");
    row.style.setProperty("margin", "0", "important");
    row.style.setProperty("padding", "0", "important");

    Array.from(row.children).forEach(function (cell) {
      cell.style.setProperty("height", px(HEADER_HEIGHT), "important");
      cell.style.setProperty("min-height", px(HEADER_HEIGHT), "important");
      cell.style.setProperty("max-height", px(HEADER_HEIGHT), "important");
      cell.style.setProperty("box-sizing", "border-box", "important");
      cell.style.setProperty("margin", "0", "important");
      cell.style.setProperty("display", "flex", "important");
      cell.style.setProperty("align-items", "center", "important");
      cell.style.setProperty("justify-content", "center", "important");
    });
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
    if (thead) {
      thead.style.setProperty("display", "block", "important");
      thead.style.setProperty("height", px(HEADER_HEIGHT), "important");
      thead.style.setProperty("min-height", px(HEADER_HEIGHT), "important");
      thead.style.setProperty("max-height", px(HEADER_HEIGHT), "important");
      thead.style.setProperty("overflow", "hidden", "important");
    }
    if (tbody) {
      tbody.style.display = "block";
      tbody.style.height = "auto";
      tbody.style.maxHeight = "none";
      tbody.style.overflow = "visible";
    }

    table.querySelectorAll("tbody tr").forEach(function (row) {
      row.style.display = "flex";
      row.style.width = "100%";
    });
  }

  function lockSideTable(table, width) {
    if (!table) return;
    makeSectionRows(table, width);
    hideGroupRow(table);

    const nameRow = table.querySelector("thead .matching-matrix-name-row");
    const nameCell = nameRow && nameRow.querySelector(":scope > th");
    lockVisibleHeader(nameRow);
    setBox(nameCell, width);
    if (nameCell) {
      nameCell.style.setProperty("white-space", "nowrap", "important");
      nameCell.style.setProperty("overflow", "hidden", "important");
    }

    table.querySelectorAll("tbody th, tbody td").forEach(function (cell) {
      setBox(cell, width);
    });
  }

  function lockCenterTable(table) {
    if (!table) return 0;
    const headers = Array.from(table.querySelectorAll("thead .matching-matrix-name-row > th"));
    const count = headers.length;
    if (!count) return 0;

    table.querySelectorAll("colgroup[data-matching-fixed-columns]").forEach(function (node) {
      node.remove();
    });

    const exactWidth = count * COLUMN_WIDTH;
    makeSectionRows(table, exactWidth);
    hideGroupRow(table);

    const nameRow = table.querySelector("thead .matching-matrix-name-row");
    lockVisibleHeader(nameRow);

    headers.forEach(function (header) {
      setBox(header, COLUMN_WIDTH);
      header.style.setProperty("overflow", "hidden", "important");
      header.style.setProperty("white-space", "nowrap", "important");
      header.style.setProperty("text-overflow", "ellipsis", "important");
      header.style.setProperty("word-break", "keep-all", "important");
      header.style.setProperty("overflow-wrap", "normal", "important");
      header.style.setProperty("line-height", "1.2", "important");
    });

    table.querySelectorAll("tbody td").forEach(function (cell) {
      setBox(cell, COLUMN_WIDTH);
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
