console.log("mycar.js 已成功載入！");

let currentTab = "all";
let batchMode = false;
let selectedCars = new Set();
let visibleCarIds = [];

const MYCAR_VIEW_STATE_KEY = "mycarViewState";
const MYCAR_NAVIGATION_IDS_KEY = "mycarNavigationIds";

/* =========================
   清單狀態
========================= */

function getSavedMyCarState() {
  try {
    const rawState = sessionStorage.getItem(MYCAR_VIEW_STATE_KEY);

    if (!rawState) {
      return null;
    }

    return JSON.parse(rawState);
  } catch (error) {
    console.warn("讀取我的車狀態失敗：", error);
    return null;
  }
}

function saveMyCarViewState(scrollY) {
  const searchInput = document.getElementById("searchInput");

  const state = {
    tab: currentTab,
    keyword: searchInput ? searchInput.value : "",
    scrollY:
      typeof scrollY === "number"
        ? scrollY
        : window.scrollY
  };

  sessionStorage.setItem(
    MYCAR_VIEW_STATE_KEY,
    JSON.stringify(state)
  );
}

function saveMyCarNavigationIds() {
  sessionStorage.setItem(
    MYCAR_NAVIGATION_IDS_KEY,
    JSON.stringify(visibleCarIds)
  );
}

function restoreTabButtons() {
  document
    .querySelectorAll(".mycar-tabs .tab")
    .forEach(function (button) {
      button.classList.toggle(
        "active",
        button.dataset.tab === currentTab
      );
    });
}

function restoreScrollPosition() {
  const savedState = getSavedMyCarState();

  if (!savedState) {
    return;
  }

  const targetScrollY = Number(savedState.scrollY || 0);

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      window.scrollTo({
        top: targetScrollY,
        left: 0,
        behavior: "auto"
      });
    });
  });
}

/* =========================
   分頁與排序
========================= */

function setMyCarTab(tab) {
  currentTab = tab;

  restoreTabButtons();
  saveMyCarViewState(0);

  renderMyCars({
    restoreScroll: false
  });
}

function getTimeValue(car) {
  return getCarDateTime(car).getTime();
}

function sortCars(cars, keyword) {
  if (keyword) {
    return cars.sort(function (a, b) {
      return getTimeValue(a) - getTimeValue(b);
    });
  }

  return cars.sort(function (a, b) {
    const aEnded = isCarEnded(a);
    const bEnded = isCarEnded(b);

    if (aEnded !== bEnded) {
      return aEnded ? 1 : -1;
    }

    return getTimeValue(a) - getTimeValue(b);
  });
}

/* =========================
   批次管理
========================= */

function startBatchMode() {
  batchMode = true;
  selectedCars.clear();

  updateBatchToolbar();
  renderMyCars({
    restoreScroll: true
  });
}

function cancelBatchMode() {
  batchMode = false;
  selectedCars.clear();

  updateBatchToolbar();
  renderMyCars({
    restoreScroll: true
  });
}

function updateBatchToolbar() {
  const normalToolbar =
    document.getElementById("normalToolbar");

  const batchToolbar =
    document.getElementById("batchToolbar");

  if (normalToolbar) {
    normalToolbar.hidden = batchMode;
  }

  if (batchToolbar) {
    batchToolbar.hidden = !batchMode;
  }

  updateSelectedCarCount();
}

function updateSelectedCarCount() {
  const count = selectedCars.size;

  const countBox =
    document.getElementById("selectedCarCount");

  const joinButton =
    document.getElementById("joinSelectedCarsButton");

  const selectAll =
    document.getElementById("selectAllCars");

  if (countBox) {
    countBox.textContent = `已選取 ${count} 台車`;
  }

  if (joinButton) {
    joinButton.textContent =
      `👤 加入已選取車團（${count}）`;

    joinButton.disabled = count === 0;
  }

  if (selectAll) {
    const selectedVisibleCount =
      visibleCarIds.filter(function (carId) {
        return selectedCars.has(carId);
      }).length;

    selectAll.checked =
      visibleCarIds.length > 0 &&
      selectedVisibleCount === visibleCarIds.length;

    selectAll.indeterminate =
      selectedVisibleCount > 0 &&
      selectedVisibleCount < visibleCarIds.length;
  }
}

function toggleSelectAllCars(checked) {
  visibleCarIds.forEach(function (carId) {
    if (checked) {
      selectedCars.add(carId);
    } else {
      selectedCars.delete(carId);
    }
  });

  updateSelectedCarCount();

  renderMyCars({
    restoreScroll: true
  });
}

function toggleCarSelection(carId) {
  if (!batchMode) {
    return;
  }

  if (selectedCars.has(carId)) {
    selectedCars.delete(carId);
  } else {
    selectedCars.add(carId);
  }

  updateSelectedCarCount();

  renderMyCars({
    restoreScroll: true
  });
}

/* =========================
   我的車清單
========================= */

async function renderMyCars(options) {
  const settings = options || {};
  const shouldRestoreScroll =
    settings.restoreScroll !== false;

  const db = window.db;
  const list = document.getElementById("carList");
  const searchInput =
    document.getElementById("searchInput");

  if (!list) {
    return;
  }

  if (!db) {
    list.innerHTML =
      '<div class="card"><h3>Firebase 尚未載入</h3></div>';

    return;
  }

  const scrollBeforeRender = window.scrollY;

  list.innerHTML =
    '<div class="card">載入中...</div>';

  try {
    const snapshot =
      await db.collection("cars").get();

    let cars = snapshot.docs.map(function (doc) {
      return {
        id: doc.id,
        ...doc.data()
      };
    });

    const keyword = (
      searchInput && searchInput.value
        ? searchInput.value
        : ""
    )
      .trim()
      .toLowerCase();

    if (currentTab === "active") {
      cars = cars.filter(function (car) {
        return !isCarEnded(car);
      });
    }

    if (currentTab === "done") {
      cars = cars.filter(function (car) {
        return isCarEnded(car);
      });
    }

    if (keyword) {
      cars = cars.filter(function (car) {
        const tags = Array.isArray(car.tags)
          ? car.tags.join(" ")
          : "";

        const scriptTags =
          Array.isArray(car.scriptTags)
            ? car.scriptTags.join(" ")
            : "";

        const text = [
          car.scriptName || "",
          car.gameDate || "",
          car.gameTime || "",
          getLocationText(car),
          getOrganizerText(car),
          car.dmName || "",
          tags,
          scriptTags,
          getAutoStatus(car),
          getNeedText(car)
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(keyword);
      });
    }

    cars = sortCars(cars, keyword);

    visibleCarIds = cars.map(function (car) {
      return car.id;
    });

    saveMyCarNavigationIds();

    if (cars.length === 0) {
      list.innerHTML =
        '<div class="card"><h3>目前沒有符合的車</h3></div>';

      updateSelectedCarCount();
      return;
    }

    list.innerHTML = cars
      .map(function (car) {
        return buildCarCard(car, {
          batchMode,
          selected: selectedCars.has(car.id)
        });
      })
      .join("");

    updateSelectedCarCount();

    if (shouldRestoreScroll) {
      requestAnimationFrame(function () {
        window.scrollTo({
          top: scrollBeforeRender,
          left: 0,
          behavior: "auto"
        });
      });
    }
  } catch (error) {
    console.error("讀取失敗：", error);

    list.innerHTML =
      '<div class="card"><h3>讀取失敗</h3><p>' +
      error.message +
      "</p></div>";
  }
}

/* =========================
   初始化
========================= */

document.addEventListener(
  "DOMContentLoaded",
  function () {
    const searchInput =
      document.getElementById("searchInput");

    const savedState = getSavedMyCarState();

    if (
      savedState &&
      ["all", "active", "done"].includes(
        savedState.tab
      )
    ) {
      currentTab = savedState.tab;
    }

    if (searchInput && savedState) {
      searchInput.value =
        savedState.keyword || "";
    }

    restoreTabButtons();
    updateBatchToolbar();

    renderMyCars({
      restoreScroll: false
    }).then(function () {
      restoreScrollPosition();
    });

    if (searchInput) {
      searchInput.addEventListener(
        "input",
        function () {
          saveMyCarViewState(0);

          renderMyCars({
            restoreScroll: false
          });
        }
      );
    }

    const carList =
      document.getElementById("carList");

    if (carList) {
      carList.addEventListener(
        "click",
        function (event) {
          if (batchMode) {
            return;
          }

          const card = event.target.closest(
            ".mycar-card[data-car-id]"
          );

          if (!card) {
            return;
          }

          saveMyCarViewState(window.scrollY);
          saveMyCarNavigationIds();
        },
        true
      );
    }
  }
);

window.addEventListener(
  "beforeunload",
  function () {
    saveMyCarViewState(window.scrollY);
  }
);

window.renderMyCars = renderMyCars;
window.setMyCarTab = setMyCarTab;
window.startBatchMode = startBatchMode;
window.cancelBatchMode = cancelBatchMode;
window.toggleSelectAllCars =
  toggleSelectAllCars;
window.toggleCarSelection =
  toggleCarSelection;
window.saveMyCarViewState =
  saveMyCarViewState;