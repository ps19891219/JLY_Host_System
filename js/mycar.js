console.log("mycar.js 已成功載入！");

let currentTab = "all";
let currentActiveRoleTab =
  "all";
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

  activeRoleTab:
    currentActiveRoleTab,

  keyword:
    searchInput
      ? searchInput.value
      : "",
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
      car.myRole || ""
    ).trim() === "host"
  );
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

  const activeRoleTabs =
    document.getElementById("activeRoleTabs");

  if (activeRoleTabs) {
    activeRoleTabs.hidden =
      tab !== "active";
  }

  if (tab !== "active") {
    currentActiveRoleTab = "all";
  }

  restoreTabButtons();
  saveMyCarViewState();

  renderMyCars({
    restoreScroll: false
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

  saveMyCarViewState(0);

  renderMyCars({
    restoreScroll: false
  });
}

function getTimeValue(car) {
  return getCarDateTime(car).getTime();
}

function sortCars(
  cars,
  keyword
) {
  return cars.sort(
    function (a, b) {
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
      function getSortGroup(car) {
        if (isCarEnded(car)) {
          return 2;
        }

        if (isCarPlanning(car)) {
          return 1;
        }

        return 0;
      }

      const aGroup =
        getSortGroup(a);

      const bGroup =
        getSortGroup(b);

      if (aGroup !== bGroup) {
        return aGroup - bGroup;
      }

      /*
        同一群組內排序。
      */
      if (
        aGroup === 1
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

if (
  !window.JLYCarData ||
  typeof window
    .JLYCarData
    .getCarsByOwner !==
      "function"
) {
  list.innerHTML =
    '<div class="card"><h3>Car Data 模組尚未載入</h3></div>';

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
    '<h3>尚未建立使用者身分</h3>' +
    '<p>請重新整理頁面後再試。</p>' +
    '</div>';

  return;
}

const scrollBeforeRender =
  window.scrollY;

list.innerHTML =
  '<div class="card">載入中...</div>';

try {
  const hostCars =
    await window
      .JLYCarData
      .getCarsByOwner(
        ownerId
      );

  const playerCars =
    typeof window
      .JLYCarData
      .getCarsByPlayerId ===
        "function"
      ? await window
          .JLYCarData
          .getCarsByPlayerId(
            playerProfileId
          )
      : [];

  /*
    一般分頁先維持原本語意：
    我的車 = 我擁有的車。

    只有「開團中」時，
    才把玩家參與的車一起納入。
  */
  let cars =
    currentTab === "active"
      ? [
          ...hostCars,
          ...playerCars
        ]
      : [
          ...hostCars
        ];

  /*
    同一台車可能同時：
    - 我是主揪
    - 我也有上場

    全部清單只顯示一次。
  */
  cars =
    Array.from(
      new Map(
        cars.map(
          function (car) {
            return [
              car.id,
              car
            ];
          }
        )
      ).values()
    );

    const keyword = (
      searchInput && searchInput.value
        ? searchInput.value
        : ""
    )
      .trim()
      .toLowerCase();

    if (
  currentTab ===
  "planning"
) {
  cars =
    cars.filter(
      function (car) {
        return isCarPlanning(
          car
        );
      }
    );
}

if (
  currentTab ===
  "active"
) {
  cars =
    cars.filter(
      function (car) {
        return (
          !isCarEnded(car) &&
          !isCarPlanning(car)
        );
      }
    );

  if (
  currentActiveRoleTab ===
  "host"
) {
  cars =
    cars.filter(
      function (car) {
        return isMyHostCar(
          car
        );
      }
    );
}


const linkedPlayerIds =
  window.JLYIdentity &&
  typeof window
    .JLYIdentity
    .getLinkedPlayerIds ===
      "function"
    ? window.JLYIdentity
        .getLinkedPlayerIds()
    : [];

const myPlayerIds =
  Array.from(
    new Set([
      playerProfileId,
      ...linkedPlayerIds
    ])
  ).filter(Boolean);


  if (
    currentActiveRoleTab ===
    "player"
  ) {
    cars =
      cars.filter(
        function (car) {
          /*
            如果同一台車我既是 owner
            又有上場，
            主要歸在「我主揪的」，
            不重複放進玩家分類。
          */
          if (
  isMyHostCar(car)
) {
  return false;
}

          const players =
            Array.isArray(
              car.players
            )
              ? car.players
              : [];

          return players.some(
            function (player) {
              if (!player) {
                return false;
              }

              const playerId =
                String(
                  player.playerId ||
                  player.id ||
                  player.profileId ||
                  ""
                ).trim();

              const status =
                String(
                  player.status || ""
                ).trim();

              return (
  myPlayerIds.includes(
    playerId
  ) &&
  status !==
    "已取消" &&
  status !==
    "取消" &&
  status !==
    "cancelled" &&
  status !==
    "canceled"
);
            }
          );
        }
      );
  }
}

if (
  currentTab ===
  "done"
) {
  cars =
    cars.filter(
      function (car) {
        return isCarEnded(
          car
        );
      }
    );
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
      [
  "all",
  "planning",
  "active",
  "done"
].includes(
  savedState.tab
)
    ) {
      currentTab = savedState.tab;
    }

    if (
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

    if (searchInput && savedState) {
      searchInput.value =
        savedState.keyword || "";
    }

    restoreTabButtons();
restoreActiveRoleTabs();
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
  window.setMyCarActiveRoleTab =
  setMyCarActiveRoleTab;