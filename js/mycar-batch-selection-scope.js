(function () {
  "use strict";

  function clearSelection() {
    if (typeof selectedCars === "undefined") {
      return;
    }
    selectedCars.clear();
    if (typeof updateSelectedCarCount === "function") {
      updateSelectedCarCount();
    }
  }

  function wrapSelectionHelpers() {
    if (typeof window.toggleSelectAllCars === "function" && !window.toggleSelectAllCars.__jlyScoped) {
      const originalToggleSelectAllCars = window.toggleSelectAllCars;
      const scopedToggleSelectAllCars = function (checked) {
        if (checked && typeof selectedCars !== "undefined") {
          selectedCars.clear();
        }
        return originalToggleSelectAllCars(checked);
      };
      scopedToggleSelectAllCars.__jlyScoped = true;
      window.toggleSelectAllCars = scopedToggleSelectAllCars;
    }

    ["goMyCarPreviousPage", "goMyCarNextPage", "setMyCarTab", "setMyCarActiveRoleTab"].forEach(function (name) {
      const original = window[name];
      if (typeof original !== "function" || original.__jlySelectionReset) {
        return;
      }
      const wrapped = function () {
        clearSelection();
        return original.apply(this, arguments);
      };
      wrapped.__jlySelectionReset = true;
      window[name] = wrapped;
    });
  }

  function installSearchReset() {
    const input = document.getElementById("searchInput");
    if (!input || input.dataset.jlySelectionReset === "1") {
      return;
    }
    input.dataset.jlySelectionReset = "1";
    input.addEventListener("input", function () {
      if (typeof batchMode !== "undefined" && batchMode) {
        clearSelection();
      }
    });
  }

  function install() {
    wrapSelectionHelpers();
    installSearchReset();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }

  setTimeout(install, 300);
  setTimeout(install, 1000);
})();
