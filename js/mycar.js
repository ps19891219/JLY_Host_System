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

const MYCAR_DATA_SNAPSHOT_KEY =
  "mycarDataSnapshotV2";

const MYCAR_DATA_SNAPSHOT_TTL_MS =
  60 * 1000;

const MYCAR_VIEW_FIRST_FLAG_KEY =
  "jlyMyCarViewFirstV1";

let myCarViewModulePromise =
  null;

function isMyCarViewFirstEnabled() {
  return (
    localStorage.getItem(
      MYCAR_VIEW_FIRST_FLAG_KEY
    ) === "1"
  );
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
        "/js/data-view/mycar-view.js?v=4",
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

function readMyCarDataSnapshot(
  ownerId
) {
  try {
    const raw =
      sessionStorage.getItem(
        MYCAR_DATA_SNAPSHOT_KEY
      );

    if (!raw) {
      return null;
    }

    const snapshot =
      JSON.parse(raw);

    if (
      !snapshot ||
      snapshot.ownerId !== ownerId ||
      !Array.isArray(
        snapshot.hostCars
      ) ||
      !Array.isArray(
        snapshot.playerCars
      )
    ) {
      return null;
    }

    const savedAt =
      Number(
        snapshot.savedAt || 0
      );

    if (
      !savedAt ||
      Date.now() - savedAt >
        MYCAR_DATA_SNAPSHOT_TTL_MS
    ) {
      return null;
    }

    return snapshot;
  } catch (error) {
    console.warn(
      "讀取我的車資料快照失敗：",
      error
    );

    return null;
  }
}

function saveMyCarDataSnapshot(
  ownerId,
  hostCars,
  playerCars
) {
  try {
    sessionStorage.setItem(
      MYCAR_DATA_SNAPSHOT_KEY,
      JSON.stringify({
        ownerId,
        savedAt:
          Date.now(),
        hostCars:
          Array.isArray(hostCars)
            ? hostCars
            : [],
        playerCars:
          Array.isArray(playerCars)
            ? playerCars
            : []
      })
    );
  } catch (error) {
    console.warn(
      "儲存我的車資料快照失敗：",
      error
    );
  }
}

async function loadMyCarDataSnapshot(
  ownerId,
  playerProfileId
) {
  const cached =
    readMyCarDataSnapshot(
      ownerId
    );

  if (cached) {
    return cached;
  }

  const hostPromise =
    window.JLYCarData
      .getCarsByOwner(
        ownerId
      );

  const playerPromise =
    typeof window.JLYCarData
      .getCarsByPlayerId ===
        "function"
      ? window.JLYCarData
          .getCarsByPlayerId(
            playerProfileId ||
            ownerId
          )
      : Promise.resolve([]);

  const results =
    await Promise.all([
      hostPromise,
      playerPromise
    ]);

  const snapshot = {
    ownerId,
    savedAt:
      Date.now(),
    hostCars:
      results[0] || [],
    playerCars:
      results[1] || []
  };

  saveMyCarDataSnapshot(
    ownerId,
    snapshot.hostCars,
    snapshot.playerCars
  );

  return snapshot;
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

  if (
    !window.JLYCarData ||
    typeof window
      .JLYCarData
      .getCarsByOwnerPage !==
        "function"
  ) {
    list.innerHTML =
      '<div class="card">' +
      '<h3>Car Data 分頁模組尚未載入</h3>' +
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

  const playerProfileId =
    window.JLYIdentity &&
    typeof window
      .JLYIdentity
      .getCurrentPlayerProfileId ===
        "function"
      ? window
          .JLYIdentity
          .getCurrentPlayerProfileId()
      : String(
          localStorage.getItem(
            "currentPlayerProfileId"
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
      V2.81：先建立一份短效期的「我的車排序快照」，
      再依正式排序切成每頁 20 台。

      這避免原本 documentId cursor 先切 20 台、
      每頁再各自 sort，造成第 1 / 2 / 3 頁時間線斷裂。

      快照只保留 60 秒並放在 sessionStorage：
      - 翻頁與從單台車返回時不重複讀整批資料
      - 超過 TTL 會重新抓正式 Car
      - Player 車仍走 V2.80 playerIds indexed query
    */
    if (
      isMyCarViewFirstEnabled()
    ) {
      /*
        Phase G：
        正式 View-first 開啟後，
        正常 MyCar UI 只讀一份
        myCarViews/{viewerId}。

        此分支沒有 Cars Query fallback。
        View 不存在或壞掉時直接報錯，
        避免表面正常、背後偷偷重新掃 Core。
      */
      const preparedView =
        await loadMyCarPreparedView(
          ownerId
        );

      cars =
        Array.isArray(
          preparedView.cars
        )
          ? preparedView.cars
              .slice()
          : [];
    } else {
      /*
        Migration Safety：
        Phase G 安裝後預設仍走 V2.81，
        直到 Bootstrap + Consistency
        明確通過才開啟 View-first。
      */
      const snapshot =
        await loadMyCarDataSnapshot(
          ownerId,
          playerProfileId
        );

      const hostCars =
        snapshot.hostCars || [];

      const playerCars =
        snapshot.playerCars || [];

      cars =
        Array.from(
          new Map(
            [
              ...hostCars,
              ...playerCars
            ].map(
              function (car) {
                return [
                  car.id,
                  car
                ];
              }
            )
          ).values()
        );
    }

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
      error.message ===
        "mycar_view_not_bootstrapped"
        ? "MyCar View 尚未建立，請先執行一次 Bootstrap。"
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
      localStorage.setItem(
        MYCAR_VIEW_FIRST_FLAG_KEY,
        "1"
      );

      sessionStorage.removeItem(
        MYCAR_DATA_SNAPSHOT_KEY
      );

      return true;
    },

  disable:
    function () {
      localStorage.removeItem(
        MYCAR_VIEW_FIRST_FLAG_KEY
      );

      return true;
    }
};
