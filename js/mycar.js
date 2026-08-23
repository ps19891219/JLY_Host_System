console.log("mycar.js 已成功載入！");

let currentTab = "all";
let currentActiveRoleTab =
  "all";
let batchMode = false;
let selectedCars = new Set();
let visibleCarIds = [];

const MYCAR_PAGE_SIZE = 20;
let currentPageIndex = 0;
let pageCursorStack = [""];
let nextPageCursorId = "";
let currentPageHasMore = false;
let searchDebounceTimer = null;

const MYCAR_VIEW_STATE_KEY =
  "mycarViewState";

const MYCAR_NAVIGATION_IDS_KEY =
  "mycarNavigationIds";

let myCarViewModulePromise =
  null;

function isMyCarViewFirstEnabled() {
  return true;
}

function loadMyCarViewScript(
  src,
  marker
) {
  return new Promise(
    function (
      resolve,
      reject
    ) {
      const existing =
        document.querySelector(
          `script[data-jly-mycar-view="${marker}"]`
        );

      if (existing) {
        if (
          existing.dataset
            .jlyMyCarViewReady ===
            "1"
        ) {
          resolve();
          return;
        }

        existing.addEventListener(
          "load",
          resolve,
          { once: true }
        );

        existing.addEventListener(
          "error",
          reject,
          { once: true }
        );

        return;
      }

      const script =
        document.createElement(
          "script"
        );

      script.src = src;
      script.async = false;
      script.dataset
        .jlyMyCarView =
        marker;

      script.onload =
        function () {
          script.dataset
            .jlyMyCarViewReady =
            "1";
          resolve();
        };

      script.onerror =
        reject;

      document.head
        .appendChild(
          script
        );
    }
  );
}

async function ensureMyCarViewModule() {
  if (window.JLYMyCarView) {
    return window.JLYMyCarView;
  }

  if (myCarViewModulePromise) {
    return myCarViewModulePromise;
  }

  myCarViewModulePromise =
    (async function () {
      await loadMyCarViewScript(
        "/js/data-view/mycar-view.js?v=5",
        "mycar-view"
      );

      if (!window.JLYMyCarView) {
        throw new Error(
          "MyCar View 模組未初始化"
        );
      }

      return window.JLYMyCarView;
    })();

  try {
    return await myCarViewModulePromise;
  } catch (error) {
    myCarViewModulePromise = null;
    throw error;
  }
}

async function loadMyCarPreparedView(
  ownerId
) {
  const module =
    await ensureMyCarViewModule();

  const view =
    await module.read(
      ownerId
    );

  if (!view) {
    throw new Error(
      "mycar_view_not_bootstrapped"
    );
  }

  if (
    Number(view.schemaVersion) < 4 ||
    view.viewType !== "mycar_index" ||
    String(view.viewerId || "").trim() !==
      String(ownerId || "").trim() ||
    !Array.isArray(view.cars)
  ) {
    throw new Error(
      "mycar_view_invalid"
    );
  }

  return view;
}


const MYCAR_RETURN_MARKER_KEY =
  "mycarReturnFromCarDetail";

function clearSavedMyCarViewState() {
  try {
    sessionStorage.removeItem(
      MYCAR_VIEW_STATE_KEY
    );
  } catch (error) {
    console.warn(
      "清除我的車狀態失敗：",
      error
    );
  }
}

function shouldRestoreMyCarViewState() {
  const referrer =
    String(
      document.referrer || ""
    );

  const fromCarPage =
    /\/pages\/(car-detail|car-view|editcar)\.html/i
      .test(referrer);

  const marker =
    sessionStorage.getItem(
      MYCAR_RETURN_MARKER_KEY
    ) === "1";

  return (
    fromCarPage &&
    marker
  );
}

function markMyCarDetailNavigation() {
  sessionStorage.setItem(
    MYCAR_RETURN_MARKER_KEY,
    "1"
  );
}

function consumeMyCarReturnMarker() {
  sessionStorage.removeItem(
    MYCAR_RETURN_MARKER_KEY
  );
}

function updateSearchClearButton() {
  const input =
    document.getElementById(
      "searchInput"
    );

  const button =
    document.getElementById(
      "clearSearchButton"
    );

  if (!button) {
    return;
  }

  button.hidden =
    !input ||
    !input.value;
}

function clearMyCarSearch() {
  const input =
    document.getElementById(
      "searchInput"
    );

  if (!input) {
    return;
  }

  input.value = "";

  clearTimeout(
    searchDebounceTimer
  );

  resetMyCarPagination();
  updateSearchClearButton();
  saveMyCarViewState(0);

  renderMyCars({
    restoreScroll:
      false
  });

  input.focus();
}

/* =========================
   清單狀態
========================= */

function getSavedMyCarState() {
  try {
    const rawState =
      sessionStorage.getItem(
        MYCAR_VIEW_STATE_KEY
      );

    if (!rawState) {
      return null;
    }

    return JSON.parse(
      rawState
    );
  } catch (error) {
    console.warn(
      "讀取我的車狀態失敗：",
      error
    );

    return null;
  }
}

function saveMyCarViewState(
  scrollY
) {
  const searchInput =
    document.getElementById(
      "searchInput"
    );

  const state = {
    tab:
      currentTab,

    activeRoleTab:
      currentActiveRoleTab,

    keyword:
      searchInput
        ? searchInput.value
        : "",

    scrollY:
      typeof scrollY ===
      "number"
        ? scrollY
        : window.scrollY,

    pageIndex:
      currentPageIndex,

    pageCursorStack:
      pageCursorStack
  };

  sessionStorage.setItem(
    MYCAR_VIEW_STATE_KEY,
    JSON.stringify(
      state
    )
  );
}

function saveMyCarNavigationIds() {
  sessionStorage.setItem(
    MYCAR_NAVIGATION_IDS_KEY,
    JSON.stringify(
      visibleCarIds
    )
  );
}

function restoreTabButtons() {
  document
    .querySelectorAll(
      ".mycar-tabs .tab"
    )
    .forEach(
      function (button) {
        button.classList.toggle(
          "active",
          button.dataset.tab ===
            currentTab
        );
      }
    );
}

function restoreActiveRoleTabs() {
  const box =
    document.getElementById(
      "activeRoleTabs"
    );

  if (!box) {
    return;
  }

  box.hidden =
    currentTab !==
    "active";

  box
    .querySelectorAll(
      "[data-role-tab]"
    )
    .forEach(
      function (button) {
        button.classList.toggle(
          "active",
          button.dataset
            .roleTab ===
            currentActiveRoleTab
        );
      }
    );
}

function isMyHostCar(
  car
) {
  if (!car) {
    return false;
  }

  return (
    car.isHost === true ||
    String(
      car.role || ""
    ).trim() ===
      "host" ||
    String(
      car.ownerType || ""
    ).trim() ===
      "self"
  );
}

function isMyPlayerCar(
  car
) {
  if (!car) {
    return false;
  }

  return (
    !isMyHostCar(car) &&
    car.isPlayer === true
  );
}

function restoreScrollPosition() {
  const savedState =
    getSavedMyCarState();

  if (!savedState) {
    return;
  }

  const targetScrollY =
    Number(
      savedState.scrollY ||
      0
    );

  requestAnimationFrame(
    function () {
      requestAnimationFrame(
        function () {
          window.scrollTo({
            top:
              targetScrollY,

            left:
              0,

            behavior:
              "auto"
          });
        }
      );
    }
  );
}

/* =========================
   分頁與排序
========================= */

function setMyCarTab(
  tab
) {
  currentTab =
    tab;

  const activeRoleTabs =
    document.getElementById(
      "activeRoleTabs"
    );

  if (activeRoleTabs) {
    activeRoleTabs.hidden =
      tab !==
      "active";
  }

  if (
    tab !==
    "active"
  ) {
    currentActiveRoleTab =
      "all";
  }

  restoreTabButtons();

  resetMyCarPagination();

  saveMyCarViewState(0);

  renderMyCars({
    restoreScroll:
      false
  });
}

function setMyCarActiveRoleTab(
  tab
) {
  currentActiveRoleTab =
    [
      "all",
      "host",
      "player"
    ].includes(tab)
      ? tab
      : "all";

  restoreActiveRoleTabs();

  resetMyCarPagination();

  saveMyCarViewState(
    0
  );

  renderMyCars({
    restoreScroll:
      false
  });
}


function resetMyCarPagination() {
  currentPageIndex = 0;
  pageCursorStack = [""];
  nextPageCursorId = "";
  currentPageHasMore = false;
}

function renderMyCarPagination() {
  const box =
    document.getElementById(
      "mycarPagination"
    );

  if (!box) {
    return;
  }

  const prev =
    document.getElementById(
      "mycarPrevPage"
    );

  const next =
    document.getElementById(
      "mycarNextPage"
    );

  const label =
    document.getElementById(
      "mycarPageLabel"
    );

  if (prev) {
    prev.disabled =
      currentPageIndex <= 0;
  }

  if (next) {
    next.disabled =
      !currentPageHasMore;
  }

  if (label) {
    label.textContent =
      `第 ${currentPageIndex + 1} 頁`;
  }
}

function goMyCarPreviousPage() {
  if (
    currentPageIndex <= 0
  ) {
    return;
  }

  currentPageIndex -= 1;
  nextPageCursorId = "";
  currentPageHasMore = false;

  saveMyCarViewState(0);

  renderMyCars({
    restoreScroll: false
  });
}

function goMyCarNextPage() {
  if (
    !currentPageHasMore ||
    !nextPageCursorId
  ) {
    return;
  }

  pageCursorStack[
    currentPageIndex + 1
  ] = nextPageCursorId;

  currentPageIndex += 1;

  saveMyCarViewState(0);

  renderMyCars({
    restoreScroll: false
  });
}

function getCurrentPageCursorId() {
  return String(
    pageCursorStack[
      currentPageIndex
    ] || ""
  );
}

function buildCurrentCarFilter() {
  return function (car) {
    if (
      currentTab ===
        "planning"
    ) {
      return isCarPlanning(
        car
      );
    }

    if (
      currentTab ===
        "active"
    ) {
      if (
        isCarEnded(car) ||
        isCarPlanning(car)
      ) {
        return false;
      }

      if (
        currentActiveRoleTab ===
          "host"
      ) {
        return isMyHostCar(
          car
        );
      }
    }

    if (
      currentTab ===
        "done"
    ) {
      return isCarEnded(
        car
      );
    }

    return true;
  };
}

function carMatchesKeyword(
  car,
  keyword
) {
  if (!keyword) {
    return true;
  }

  const tags =
    Array.isArray(
      car.tags
    )
      ? car.tags.join(" ")
      : "";

  const scriptTags =
    Array.isArray(
      car.scriptTags
    )
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

  return text.includes(
    keyword
  );
}

function getTimeValue(
  car
) {
  return getCarDateTime(
    car
  ).getTime();
}

function sortCars(
  cars,
  keyword
) {
  return cars.sort(
    function (
      a,
      b
    ) {
      const aPlanning =
        isCarPlanning(a);

      const bPlanning =
        isCarPlanning(b);

      const aEnded =
        isCarEnded(a);

      const bEnded =
        isCarEnded(b);

      /*
        排序群組：
        0 = 開團中
        1 = 規劃中
        2 = 已結束
      */

      function getSortGroup(
        car
      ) {
        if (
          isCarEnded(car)
        ) {
          return 2;
        }

        if (
          isCarPlanning(
            car
          )
        ) {
          return 1;
        }

        return 0;
      }

      const aGroup =
        getSortGroup(
          a
        );

      const bGroup =
        getSortGroup(
          b
        );

      if (
        aGroup !==
        bGroup
      ) {
        return (
          aGroup -
          bGroup
        );
      }

      /*
        同一群組內排序。
      */

      if (
        aGroup ===
        1
      ) {
        /*
          規劃中沒有日期，
          依建立或更新時間較新的排前面。
        */

        const aPlanningTime =
          new Date(
            a.updatedAt ||
            a.createdAt ||
            0
          ).getTime();

        const bPlanningTime =
          new Date(
            b.updatedAt ||
            b.createdAt ||
            0
          ).getTime();

        return (
          bPlanningTime -
          aPlanningTime
        );
      }

      /*
        開團中與已結束，
        依日期時間排序。
      */

      return (
        getTimeValue(a) -
        getTimeValue(b)
      );
    }
  );
}

/* =========================
   批次管理
========================= */

function startBatchMode() {
  batchMode = true;

  selectedCars.clear();

  updateBatchToolbar();

  renderMyCars({
    restoreScroll:
      true
  });
}

function cancelBatchMode() {
  batchMode = false;

  selectedCars.clear();

  updateBatchToolbar();

  renderMyCars({
    restoreScroll:
      true
  });
}

function updateBatchToolbar() {
  const normalToolbar =
    document.getElementById(
      "normalToolbar"
    );

  const batchToolbar =
    document.getElementById(
      "batchToolbar"
    );

  if (normalToolbar) {
    normalToolbar.hidden =
      batchMode;
  }

  if (batchToolbar) {
    batchToolbar.hidden =
      !batchMode;
  }

  updateSelectedCarCount();
}

function updateSelectedCarCount() {
  const count =
    selectedCars.size;

  const countBox =
    document.getElementById(
      "selectedCarCount"
    );

  const joinButton =
    document.getElementById(
      "joinSelectedCarsButton"
    );

  const selectAll =
    document.getElementById(
      "selectAllCars"
    );

  if (countBox) {
    countBox.textContent =
      `已選取 ${count} 台車`;
  }

  if (joinButton) {
    joinButton.textContent =
      `👤 加入已選取車團（${count}）`;

    joinButton.disabled =
      count === 0;
  }

  if (selectAll) {
    const selectedVisibleCount =
      visibleCarIds.filter(
        function (
          carId
        ) {
          return selectedCars.has(
            carId
          );
        }
      ).length;

    selectAll.checked =
      visibleCarIds.length >
        0 &&
      selectedVisibleCount ===
        visibleCarIds.length;

    selectAll.indeterminate =
      selectedVisibleCount >
        0 &&
      selectedVisibleCount <
        visibleCarIds.length;
  }
}

function toggleSelectAllCars(
  checked
) {
  visibleCarIds.forEach(
    function (
      carId
    ) {
      if (checked) {
        selectedCars.add(
          carId
        );
      } else {
        selectedCars.delete(
          carId
        );
      }
    }
  );

  updateSelectedCarCount();

  renderMyCars({
    restoreScroll:
      true
  });
}

function toggleCarSelection(
  carId
) {
  if (!batchMode) {
    return;
  }

  if (
    selectedCars.has(
      carId
    )
  ) {
    selectedCars.delete(
      carId
    );
  } else {
    selectedCars.add(
      carId
    );
  }

  updateSelectedCarCount();

  renderMyCars({
    restoreScroll:
      true
  });
}

/* =========================
   我的車清單
========================= */

async function renderMyCars(
  options
) {
  const settings =
    options || {};

  const shouldRestoreScroll =
    settings.restoreScroll !==
      false;

  const db =
    window.db;

  const list =
    document.getElementById(
      "carList"
    );

  const searchInput =
    document.getElementById(
      "searchInput"
    );

  if (!list) {
    return;
  }

  if (!db) {
    list.innerHTML =
      '<div class="card">' +
      '<h3>Firebase 尚未載入</h3>' +
      '</div>';

    return;
  }

  const ownerId =
    window.JLYIdentity &&
    typeof window
      .JLYIdentity
      .getCurrentPlayerId ===
        "function"
      ? window
          .JLYIdentity
          .getCurrentPlayerId()
      : String(
          localStorage.getItem(
            "currentPlayerId"
          ) || ""
        ).trim();

  if (!ownerId) {
    list.innerHTML =
      '<div class="card">' +
      '<h3>尚未登入 JLY 身分</h3>' +
      '<p>請先登入或使用 LINE 找回你的 JLY Member，才能顯示「我的車」。</p>' +
      '<button type="button" onclick="location.href=\'myprofile.html?return=%2Fpages%2Fmycar.html\'">登入／找回我的身分</button>' +
      '</div>';

    return;
  }

  const scrollBeforeRender =
    window.scrollY;

  list.innerHTML =
    '<div class="card">' +
    '載入中...' +
    '</div>';

  try {
    const keyword = (
      searchInput &&
      searchInput.value
        ? searchInput.value
        : ""
    )
      .trim()
      .toLowerCase();

    let cars = [];
    let hasMore = false;
    let cursorForNext = "";

    /*
      Cloud View Core V1 正式 Runtime：
      正常 MyCar UI 永遠只讀
      myCarViews/{viewerId}。

      View 不存在、版本不符或格式錯誤時直接報錯，
      不得退回 Cars / Player Cars Query。
    */
    const preparedView =
      await loadMyCarPreparedView(
        ownerId
      );

    cars =
      preparedView.cars.map(
        function (car) {
          return module.compactCar(
            car,
            preparedView.identityIds
          );
        }
      );

    const currentFilter =
      buildCurrentCarFilter();

    cars =
      cars.filter(
        function (car) {
          if (
            !currentFilter(
              car
            )
          ) {
            return false;
          }

          if (
            currentTab ===
              "active" &&
            currentActiveRoleTab ===
              "player" &&
            !isMyPlayerCar(
              car
            )
          ) {
            return false;
          }

          return carMatchesKeyword(
            car,
            keyword
          );
        }
      );

    cars =
      sortCars(
        cars,
        keyword
      );

    const start =
      currentPageIndex *
      MYCAR_PAGE_SIZE;

    const pageCars =
      cars.slice(
        start,
        start +
          MYCAR_PAGE_SIZE
      );

    hasMore =
      start +
        MYCAR_PAGE_SIZE <
      cars.length;

    cars =
      pageCars;

    cursorForNext =
      hasMore
        ? String(
            currentPageIndex +
            1
          )
        : "";

    visibleCarIds =
      cars.map(
        function (car) {
          return car.id;
        }
      );

    nextPageCursorId =
      cursorForNext;

    currentPageHasMore =
      hasMore;

    saveMyCarNavigationIds();

    renderMyCarPagination();

    if (
      cars.length ===
      0
    ) {
      list.innerHTML =
        '<div class="card">' +
        '<h3>目前沒有符合的車</h3>' +
        '</div>';

      updateSelectedCarCount();

      return;
    }

    list.innerHTML =
      cars
        .map(
          function (car) {
            return buildCarCard(
              car,
              {
                batchMode,

                selected:
                  selectedCars.has(
                    car.id
                  )
              }
            );
          }
        )
        .join("");

    updateSelectedCarCount();

    if (
      shouldRestoreScroll
    ) {
      requestAnimationFrame(
        function () {
          window.scrollTo({
            top:
              scrollBeforeRender,

            left:
              0,

            behavior:
              "auto"
          });
        }
      );
    }
  } catch (error) {
    console.error(
      "讀取失敗：",
      error
    );

    const message =
      error &&
      [
        "mycar_view_not_bootstrapped",
        "mycar_view_invalid"
      ].includes(error.message)
        ? "MyCar View 無法使用，請由管理者執行人工 Repair。"
        : (
            error &&
            error.message
              ? error.message
              : "未知錯誤"
          );

    list.innerHTML =
      '<div class="card">' +
      '<h3>讀取失敗</h3>' +
      '<p>' +
      message +
      '</p>' +
      '</div>';

    currentPageHasMore =
      false;

    renderMyCarPagination();
  }
}

/* =========================
   初始化
========================= */

document.addEventListener(
  "DOMContentLoaded",
  function () {
    const searchInput =
      document.getElementById(
        "searchInput"
      );

    const clearButton =
      document.getElementById(
        "clearSearchButton"
      );

    const restorePreviousState =
      shouldRestoreMyCarViewState();

    const savedState =
      restorePreviousState
        ? getSavedMyCarState()
        : null;

    if (!restorePreviousState) {
      clearSavedMyCarViewState();

      currentTab = "all";
      currentActiveRoleTab =
        "all";
      resetMyCarPagination();

      if (searchInput) {
        searchInput.value = "";
      }

      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto"
      });
    }

    if (
      savedState &&
      [
        "all",
        "planning",
        "active",
        "done"
      ].includes(
        savedState.tab
      )
    ) {
      currentTab =
        savedState.tab;
    }

    if (
      savedState &&
      [
        "all",
        "host",
        "player"
      ].includes(
        savedState
          .activeRoleTab
      )
    ) {
      currentActiveRoleTab =
        savedState
          .activeRoleTab;
    }

    if (
      searchInput &&
      savedState
    ) {
      searchInput.value =
        savedState.keyword ||
        "";
    }

    if (
      savedState &&
      Number.isInteger(
        savedState.pageIndex
      ) &&
      savedState.pageIndex >= 0
    ) {
      currentPageIndex =
        savedState.pageIndex;
    }

    if (
      savedState &&
      Array.isArray(
        savedState.pageCursorStack
      ) &&
      savedState
        .pageCursorStack
        .length > 0
    ) {
      pageCursorStack =
        savedState
          .pageCursorStack
          .map(
            function (value) {
              return String(
                value || ""
              );
            }
          );
    }

    restoreTabButtons();
    restoreActiveRoleTabs();
    updateBatchToolbar();
    updateSearchClearButton();

    renderMyCars({
      restoreScroll:
        false
    }).then(
      function () {
        if (
          restorePreviousState
        ) {
          restoreScrollPosition();
        }
      }
    );

    consumeMyCarReturnMarker();

    if (searchInput) {
      searchInput
        .addEventListener(
          "input",
          function () {
            updateSearchClearButton();

            clearTimeout(
              searchDebounceTimer
            );

            searchDebounceTimer =
              setTimeout(
                function () {
                  resetMyCarPagination();

                  saveMyCarViewState(
                    0
                  );

                  renderMyCars({
                    restoreScroll:
                      false
                  });
                },
                280
              );
          }
        );
    }

    if (clearButton) {
      clearButton.addEventListener(
        "click",
        clearMyCarSearch
      );
    }

    const carList =
      document.getElementById(
        "carList"
      );

    if (carList) {
      carList.addEventListener(
        "click",
        function (
          event
        ) {
          if (
            batchMode
          ) {
            return;
          }

          const card =
            event.target.closest(
              ".mycar-card[data-car-id]"
            );

          if (!card) {
            return;
          }

          markMyCarDetailNavigation();

          saveMyCarViewState(
            window.scrollY
          );

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
    saveMyCarViewState(
      window.scrollY
    );
  }
);

// =========================
// 對外公開
// =========================

window.renderMyCars =
  renderMyCars;

window.setMyCarTab =
  setMyCarTab;

window.startBatchMode =
  startBatchMode;

window.cancelBatchMode =
  cancelBatchMode;

window.toggleSelectAllCars =
  toggleSelectAllCars;

window.toggleCarSelection =
  toggleCarSelection;

window.saveMyCarViewState =
  saveMyCarViewState;

window.setMyCarActiveRoleTab =
  setMyCarActiveRoleTab;

window.goMyCarPreviousPage =
  goMyCarPreviousPage;

window.goMyCarNextPage =
  goMyCarNextPage;

window.clearMyCarSearch =
  clearMyCarSearch;


window.JLYMyCarViewFirst = {
  isEnabled:
    isMyCarViewFirstEnabled,

  enable:
    function () {
      return true;
    },

  disable:
    function () {
      throw new Error(
        "mycar_view_first_is_required"
      );
    }
};
