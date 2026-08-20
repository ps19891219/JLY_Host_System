console.log("cardetail.js 已成功載入！");

const MYCAR_NAVIGATION_IDS_KEY = "mycarNavigationIds";

// ============================================================
// Cloud View Store V1A
// Shadow Write only.
//
// 目前只在「正式修改」之後更新 View。
// 一般頁面讀取尚未切換到 View，避免 View 尚未覆蓋所有
// mutation path 時出現 stale data。
// ============================================================

let jlyCloudCarViewLoadPromise =
  null;

function ensureJLYCloudCarView() {
  if (
    window.JLYCloudCarView
  ) {
    return Promise.resolve(
      window.JLYCloudCarView
    );
  }

  if (
    jlyCloudCarViewLoadPromise
  ) {
    return jlyCloudCarViewLoadPromise;
  }

  jlyCloudCarViewLoadPromise =
    new Promise(
      function (
        resolve,
        reject
      ) {
        const existing =
          document.querySelector(
            'script[data-jly-cloud-car-view="1"]'
          );

        if (existing) {
          existing.addEventListener(
            "load",
            function () {
              resolve(
                window.JLYCloudCarView
              );
            },
            {
              once: true
            }
          );

          existing.addEventListener(
            "error",
            reject,
            {
              once: true
            }
          );

          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.src =
          "/js/data-view/cloud-car-view.js?v=1";

        script.async =
          true;

        script.dataset
          .jlyCloudCarView =
          "1";

        script.onload =
          function () {
            if (
              window.JLYCloudCarView
            ) {
              resolve(
                window.JLYCloudCarView
              );

              return;
            }

            reject(
              new Error(
                "Cloud Car View 模組載入後未初始化"
              )
            );
          };

        script.onerror =
          function () {
            reject(
              new Error(
                "Cloud Car View 模組載入失敗"
              )
            );
          };

        document.head
          .appendChild(
            script
          );
      }
    );

  return jlyCloudCarViewLoadPromise;
}

async function syncJLYCloudCarViewFromCore(
  carId
) {
  try {
    const module =
      await ensureJLYCloudCarView();

    if (
      !module ||
      typeof module
        .syncFromCore !==
          "function"
    ) {
      return false;
    }

    await module
      .syncFromCore(
        carId
      );

    return true;
  } catch (error) {
    /*
      V1A 是 Shadow Write：
      View 失敗不能阻止正式 Car 修改。
    */
    console.warn(
      "Cloud Car View Shadow Sync 失敗：",
      error
    );

    return false;
  }
}


// 左右滑是否已初始化
let swipeNavigationInitialized = false;

/* =========================
   基礎工具
========================= */

function getCarId() {
  return new URLSearchParams(
    location.search
  ).get("id");
}

function nowTime() {
  return new Date().toISOString();
}

function addHistory(car, type, text) {
  const history = Array.isArray(car.history)
    ? [...car.history]
    : [];

  history.push({
    type,
    text,
    time: nowTime()
  });

  return history;
}

function getPlayers(car) {
  return Array.isArray(car.players)
    ? car.players
    : [];
}

function getActivePlayers(car) {
  return getPlayers(car).filter(
    function (player) {
      return player.status !== "已取消";
    }
  );
}

function getCurrentSeatSlots(car) {
  const currentCar =
    window.currentCarData &&
    typeof window.currentCarData ===
      "object"
      ? window.currentCarData
      : null;

  const sourceSlots =
    currentCar &&
    Array.isArray(currentCar.slots)
      ? currentCar.slots
      : (
          car &&
          Array.isArray(car.slots)
            ? car.slots
            : []
        );

  return sourceSlots.map(
    function (slot) {
      return {
        ...slot,

        player:
          slot && slot.player
            ? {
                ...slot.player
              }
            : null
      };
    }
  );
}

function getTotal(car) {
  const total = Number(
    car.totalPeople || 0
  );

  const male = Number(
    car.maleSlots || 0
  );

  const female = Number(
    car.femaleSlots || 0
  );

  if (total > 0) {
    return total;
  }

  if (male + female > 0) {
    return male + female;
  }

  return 0;
}

function getNeed(car) {
  return Math.max(
    getTotal(car) -
      getActivePlayers(car).length,
    0
  );
}

function getAutoStatus(car) {
  if (
    car.status ===
    "已取消"
  ) {
    return "已取消";
  }

  if (
    car.status ===
    "已結束"
  ) {
    return "已結束";
  }

  if (
    car.status ===
      "規劃中" ||
    car.planningStatus ===
      "unscheduled" ||
    !car.gameDate
  ) {
    return "規劃中";
  }

  return getNeed(car) <= 0
    ? "已滿"
    : "招募中";
}

function getPlayerViewUrl(carId) {
  return (
    location.origin +
    "/pages/car-view.html?id=" +
    encodeURIComponent(carId)
  );
}

async function copyPlayerViewUrl() {
  const carId = getCarId();

  if (!carId) {
    alert("找不到車團 ID");
    return;
  }

  try {
    await navigator.clipboard.writeText(
      getPlayerViewUrl(carId)
    );

    closeCarMenu();

    alert("✅ 已複製玩家查看連結");
  } catch (error) {
    console.error(
      "複製玩家查看連結失敗：",
      error
    );

    alert(
      "複製失敗，請稍後再試"
    );
  }
}

function getJoinUrl(carId) {
  return (
    location.origin +
    "/pages/join.html?id=" +
    encodeURIComponent(carId)
  );
}

async function copyJoinUrl(carId) {
  try {
    await navigator.clipboard.writeText(
      getJoinUrl(carId)
    );

    alert("✅ 已複製玩家報名網址");
  } catch (error) {
    console.error(
      "複製報名網址失敗：",
      error
    );

    alert(
      "複製失敗，請手動複製網址"
    );
  }
}

/* =========================
   上一台／下一台車
========================= */

function getNavigationIds() {
  try {
    const savedIds =
      sessionStorage.getItem(
        MYCAR_NAVIGATION_IDS_KEY
      );

    if (!savedIds) {
      return [];
    }

    const parsedIds =
      JSON.parse(savedIds);

    return Array.isArray(parsedIds)
      ? parsedIds
      : [];
  } catch (error) {
    console.warn(
      "讀取車團導覽順序失敗：",
      error
    );

    return [];
  }
}

function getNavigationState() {
  const carId = getCarId();
  const ids = getNavigationIds();
  const currentIndex =
    ids.indexOf(carId);

  return {
    hasPrevious:
      currentIndex > 0,

    hasNext:
      currentIndex >= 0 &&
      currentIndex <
        ids.length - 1
  };
}

function navigateCar(offset) {
  const carId = getCarId();
  const ids = getNavigationIds();

  const currentIndex =
    ids.indexOf(carId);

  const targetIndex =
    currentIndex + offset;

  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= ids.length
  ) {
    return;
  }

  location.href =
    "car-detail.html?id=" +
    encodeURIComponent(
      ids[targetIndex]
    );
}

function backToMyCars() {
  location.href = "mycar.html";
}

function enableSwipeNavigation() {

  // 已經初始化過
  if (swipeNavigationInitialized) {
    return;
  }

  // 桌機不用
  if (window.innerWidth >= 768) {
    return;
  }

  swipeNavigationInitialized = true;

  let startX = 0;
  let startY = 0;

  document.addEventListener(
    "touchstart",
    function (event) {

      // 點到按鈕不要滑
      if (
        event.target.closest(
          "button,a,input,textarea,select"
        )
      ) {
        startX = 0;
        return;
      }

      const touch =
        event.touches[0];

      startX = touch.clientX;
      startY = touch.clientY;

    },
    {
      passive: true
    }
  );

  document.addEventListener(
    "touchend",
    function (event) {

      if (!startX) return;

      const touch =
        event.changedTouches[0];

      const deltaX =
        touch.clientX - startX;

      const deltaY =
        touch.clientY - startY;

      startX = 0;
      startY = 0;

      // 上下滑
      if (
        Math.abs(deltaY) >
        Math.abs(deltaX)
      ) {
        return;
      }

      // 太短
      if (
        Math.abs(deltaX) < 70
      ) {
        return;
      }

      if (deltaX > 0) {

        navigateCar(-1);

      } else {

        navigateCar(1);

      }

    },
    {
      passive: true
    }
  );

}

function buildCarNavigation(scriptName) {
  const navigation =
    getNavigationState();

  return `
    <div class="car-detail-header">

      <button
        class="header-back-btn"
        type="button"
        onclick="backToMyCars()"
        title="返回上一頁"
        aria-label="返回上一頁"
      >
        ←
      </button>

      <div
        class="header-title"
        id="carHeaderTitle"
        title="${escapeHtml(scriptName)}"
      >
        ${escapeHtml(scriptName)}
      </div>

      <div class="header-menu-wrapper">

        <button
          class="header-menu-btn"
          type="button"
          onclick="toggleCarMenu(event)"
          title="更多功能"
          aria-label="更多功能"
          aria-expanded="false"
        >
          ⋯
        </button>

        <div
          id="carMoreMenu"
          class="car-more-menu"
          hidden
        >

          <button
            type="button"
            class="desktop-car-navigation"
            onclick="navigateCar(-1)"
            ${
              navigation.hasPrevious
                ? ""
                : "disabled"
            }
          >
            ← 上一台車
          </button>

          <button
            type="button"
            class="desktop-car-navigation"
            onclick="navigateCar(1)"
            ${
              navigation.hasNext
                ? ""
                : "disabled"
            }
          >
            下一台車 →
          </button>

          <div
            class="car-menu-divider desktop-car-navigation"
          ></div>

          <button
            type="button"
            onclick="openEditCarPage()"
          >
            ✏️ 編輯車團
          </button>

          <button
            type="button"
            onclick="copyRecruitmentText()"
          >
            📋 複製揪團資訊
          </button>

          <button
  type="button"
  onclick="copyPlayerViewUrl()"
>
  👀 複製玩家查看連結
</button>

<button
  type="button"
  onclick="copyJoinUrl(getCarId())"
>
  📝 複製玩家報名連結
</button>

          <button
            type="button"
            onclick="openPlayerApplicationPage()"
          >
            🙋 開啟玩家報名頁
          </button>

          <button
            type="button"
            onclick="return false"
          >
            💬 複製群組公告
          </button>

          <div class="car-menu-divider"></div>

          <button
            type="button"
            onclick="backToMyCars()"
          >
            🚗 回到我的車
          </button>

          <button
            type="button"
            onclick="openRescheduleCar()"
          >
            📅 改期
          </button>

          <button
    type="button"
    onclick="returnToPlanning()"
>
    📝 退回規劃
</button>

<button
  type="button"
  onclick="openMatchingPage()"
>
  🗓️ 時間媒合
</button>

          <button
            type="button"
            onclick="finishCurrentCar()"
          >
            🏁 結束車團
          </button>

          <button
            type="button"
            class="car-menu-danger"
            onclick="cancelCurrentCar()"
          >
            🚫 取消車團
          </button>

          <button
  type="button"
  class="car-menu-danger"
  onclick="deleteCurrentCar()"
>
  🗑️ 刪除車團（測試）
</button>

        </div>
      </div>
    </div>
  `;
}

function toggleCarMenu(event) {
  if (event) {
    event.stopPropagation();
  }

  const menu =
    document.getElementById("carMoreMenu");

  const menuButton =
    document.querySelector(".header-menu-btn");

  if (!menu) {
    return;
  }

  const willOpen = menu.hidden;

  menu.hidden = !willOpen;

  if (menuButton) {
    menuButton.setAttribute(
      "aria-expanded",
      String(willOpen)
    );
  }
}

function closeCarMenu() {
  const menu =
    document.getElementById("carMoreMenu");

  const menuButton =
    document.querySelector(".header-menu-btn");

  if (menu) {
    menu.hidden = true;
  }

  if (menuButton) {
    menuButton.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}

function openMatchingPage() {
  const carId =
    getCarId();

  if (!carId) {
    alert("找不到車團 ID");
    return;
  }

  closeCarMenu();

  location.href =
    "matching.html?id=" +
    encodeURIComponent(carId);
}

function openEditCarPage() {
  const carId = getCarId();

  if (!carId) {
    return;
  }

  location.href =
    "editcar.html?id=" +
    encodeURIComponent(carId);
}

document.addEventListener(
  "click",
  function (event) {
    const menuWrapper =
      event.target.closest(
        ".header-menu-wrapper"
      );

    if (!menuWrapper) {
      closeCarMenu();
    }
  }
);

document.addEventListener(
  "keydown",
  function (event) {
    if (event.key === "Escape") {
      closeCarMenu();
    }
  }
);

/* =========================
   車團狀態操作
========================= */

async function returnToPlanning() {
  const db =
    window.db;

  const carId =
    getCarId();

  if (!db) {
    alert(
      "Firebase 尚未載入"
    );

    return;
  }

  if (!carId) {
    alert(
      "找不到車團 ID"
    );

    return;
  }

  const currentCar =
    window.currentCarData;

  if (!currentCar) {
    alert(
      "車團資料尚未載入完成，請重新整理後再試。"
    );

    return;
  }

  if (
    currentCar.status ===
      "規劃中" ||
    currentCar.planningStatus ===
      "unscheduled"
  ) {
    alert(
      "這台車已經在規劃中了。"
    );

    closeCarMenu();

    return;
  }

  const originalDate =
    currentCar.gameDate ||
    "未設定";

  const originalTime =
    currentCar.gameTime ||
    "未設定";

  const confirmed =
    confirm(
      [
        "確定將這台車退回規劃中嗎？",
        "",
        "原定：" +
          originalDate +
          " " +
          originalTime,
        "",
        "退回後：",
        "・Google Calendar 行程會刪除",
        "・日期與時間會清空",
        "・玩家、DM、工作人員與席位會保留",
        "・之後可重新安排日期或進行時間媒合",
        "",
        "此操作不會刪除車團。"
      ].join("\n")
    );

  if (!confirmed) {
    return;
  }

  closeCarMenu();

  const calendar =
    currentCar.calendar || {};

  const hasGoogleEvent =
    Boolean(
      calendar.eventId
    );

  let googleAuthorized =
    false;

  let googleAuthError =
    null;

  /*
    Google 授權必須緊接使用者點擊，
    不能先等待 Firestore。
  */
  if (hasGoogleEvent) {
    try {
      if (
        !window
          .JLYCalendarDetailActions ||
        typeof window
          .JLYCalendarDetailActions
          .authorizeForCar !==
          "function"
      ) {
        throw new Error(
          "Google Calendar 授權模組尚未載入"
        );
      }

      await window
        .JLYCalendarDetailActions
        .authorizeForCar(
          currentCar
        );

      googleAuthorized =
        true;
    } catch (error) {
      googleAuthError =
        error;

      console.warn(
        "Google Calendar 授權未完成：",
        error
      );
    }
  }

  const carRef =
    db
      .collection("cars")
      .doc(carId);

  try {
    const snapshot =
      await carRef.get();

    if (!snapshot.exists) {
      alert(
        "找不到這台車"
      );

      return;
    }

    const car = {
      id:
        snapshot.id,

      ...snapshot.data()
    };

    const latestCalendar =
      car.calendar || {};

    let googleDeleted =
      !latestCalendar.eventId;

    /*
      有 Google Event 時先刪除。
    */
    if (latestCalendar.eventId) {
      if (!googleAuthorized) {
        const continueWithoutGoogle =
          confirm(
            [
              "⚠️ Google Calendar 授權未完成。",
              "",
              googleAuthError &&
              googleAuthError.message
                ? googleAuthError.message
                : "無法取得 Google 授權",
              "",
              "是否仍將 JLY 車團退回規劃中？",
              "",
              "注意：Google Calendar 原行程可能會保留。"
            ].join("\n")
          );

        if (!continueWithoutGoogle) {
          return;
        }
      } else {
        if (
          !window.JLYCalendarSync ||
          typeof window
            .JLYCalendarSync
            .removeSyncedEvent !==
            "function"
        ) {
          throw new Error(
            "Calendar Sync 模組尚未載入"
          );
        }

        const calendarResult =
          await window
            .JLYCalendarSync
            .removeSyncedEvent({
              carId,
              car
            });

        if (
          calendarResult.ok ===
          true
        ) {
          googleDeleted =
            true;
        } else {
          const continueWithoutGoogle =
            confirm(
              [
                "⚠️ Google Calendar 行程刪除失敗。",
                "",
                calendarResult.error &&
                calendarResult.error.message
                  ? calendarResult
                      .error.message
                  : "未知錯誤",
                "",
                "是否仍將 JLY 車團退回規劃中？",
                "",
                "注意：Google Calendar 原行程可能會保留。"
              ].join("\n")
            );

          if (!continueWithoutGoogle) {
            return;
          }
        }
      }
    }

    const history =
      addHistory(
        car,
        "退回規劃",
        (
          "原定 " +
          originalDate +
          " " +
          originalTime +
          "，已退回規劃中"
        )
      );

    const nextCalendar = {
      ...latestCalendar,

      syncEnabled:
        false,

      syncStatus:
        "not_synced",

      eventId:
        "",

      eventUrl:
        "",

      lastSyncAt:
        "",

      lastError:
        googleDeleted
          ? ""
          : "退回規劃時未能刪除原 Google Calendar 行程"
    };

        const previousMatching =
      car.matching &&
      typeof car.matching ===
        "object"
        ? car.matching
        : null;

    const nextMatching =
      previousMatching
        ? {
            ...previousMatching,

            /*
              退回規劃後，
              上一次媒合結果不得繼續算入新一輪。
            */

            status:
              "draft",

            visibility:
              "private",

            currentStep:
              2,

            currentRound:
              Number(
                previousMatching
                  .currentRound ||
                1
              ) + 1,

            responses:
              {},

            selectedSlotId:
              "",

            selectedDate:
              "",

            selectedTime:
              "",

            completedAt:
              "",

            publishedAt:
              "",

            updatedAt:
              nowTime()
          }
        : null;

    await carRef.update({
      gameDate:
        "",

      gameTime:
        "",

      status:
        "規劃中",

      planningStatus:
        "unscheduled",

      calendar:
        nextCalendar,

      /*
        開始新的媒合輪次。

        selectedDates / candidateSlots
        暫時保留，
        讓主揪可以沿用上一次設定後再修改。

        但所有人的舊回覆清空，
        不會帶到新一輪。
      */
      matching:
        nextMatching,

      /*
        上一輪玩家確認已失效。
      */
      matchingConfirmation:
        firebase.firestore
          .FieldValue
          .delete(),

      returnedToPlanningAt:
        nowTime(),

      previousSchedule: {
        gameDate:
          originalDate ===
          "未設定"
            ? ""
            : originalDate,

        gameTime:
          originalTime ===
          "未設定"
            ? ""
            : originalTime,

        returnedAt:
          nowTime()
      },

      history,

      updatedAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp()
    });

    await syncJLYCloudCarViewFromCore(
      carId
    );

    if (
      window.currentCarData
    ) {
      window.currentCarData = {
        ...window.currentCarData,

        gameDate:
          "",

        gameTime:
          "",

        status:
          "規劃中",

        planningStatus:
          "unscheduled",

        calendar:
          nextCalendar,

        history
      };
    }

    await renderCarDetail();

    alert(
      googleDeleted
        ? "已退回規劃中，Google Calendar 行程也已刪除。"
        : (
            "已退回規劃中。\n\n" +
            "⚠️ Google Calendar 原行程可能仍存在，請稍後確認。"
          )
    );
  } catch (error) {
    console.error(
      "退回規劃失敗：",
      error
    );

    alert(
      "退回規劃失敗：" +
      (
        error.message ||
        "未知錯誤"
      )
    );
  }
}

async function finishCar() {
  if (
    !confirm(
      "確定要將這台車標記為已結束嗎？"
    )
  ) {
    return;
  }

  const db = window.db;
  const carId = getCarId();

  if (!db) {
    alert("Firebase 尚未載入");
    return;
  }

  try {
    const carRef =
      db.collection("cars").doc(carId);

    const doc =
      await carRef.get();

    if (!doc.exists) {
      alert("找不到這台車");
      return;
    }

    const car = doc.data();

    const history = addHistory(
      car,
      "已結束",
      "車團已標記為已結束"
    );

    await carRef.update({
      status: "已結束",
      endedAt: nowTime(),
      history,
      updatedAt: nowTime()
    });

    await syncJLYCloudCarViewFromCore(
      carId
    );

    alert("已標記為已結束");

    renderCarDetail();
  } catch (error) {
    console.error(
      "結束車團失敗：",
      error
    );

    alert(
      "操作失敗：" +
      error.message
    );
  }
}

async function cancelCar() {
  const reason = prompt(
    "請輸入取消原因，可空白：",
    ""
  );

  if (
    !confirm(
      "確定要取消這台車嗎？取消後資料會保留。"
    )
  ) {
    return;
  }

  const db = window.db;
  const carId = getCarId();

  if (!db) {
    alert("Firebase 尚未載入");
    return;
  }

  try {
    const carRef =
      db.collection("cars").doc(carId);

    const doc =
      await carRef.get();

    if (!doc.exists) {
      alert("找不到這台車");
      return;
    }

    const car = doc.data();

    const reasonText =
      reason && reason.trim()
        ? reason.trim()
        : "未填寫";

    const history = addHistory(
      car,
      "已取消",
      "車團已取消，原因：" +
        reasonText
    );

    await carRef.update({
      status: "已取消",
      cancelReason: reasonText,
      cancelledAt: nowTime(),
      history,
      updatedAt: nowTime()
    });

    await syncJLYCloudCarViewFromCore(
      carId
    );

    alert(
      "已取消車團，紀錄已保留"
    );

    renderCarDetail();
  } catch (error) {
    console.error(
      "取消車團失敗：",
      error
    );

    alert(
      "操作失敗：" +
      error.message
    );
  }
}

/* =========================
   報名申請
   已搬至：
   modules/car/detail/application/application-actions.js
========================= */

function getApplicationActionsModule() {
  const module =
    window
      .JLYCarDetailApplicationActions;

  if (!module) {
    throw new Error(
      "Application Actions 模組尚未載入"
    );
  }

  return module;
}

async function approveApplication(
  index
) {
  return getApplicationActionsModule()
    .approveApplication(
      index
    );
}

async function rejectApplication(
  index
) {
  return getApplicationActionsModule()
    .rejectApplication(
      index
    );
}

/* =========================
   Player 搜尋工具
   已搬至：
   modules/car/detail/player/player-search.js
========================= */

function getPlayerSearchModule() {
  const module =
    window.JLYCarDetailPlayerSearch;

  if (!module) {
    throw new Error(
      "Player Search 模組尚未載入"
    );
  }

  return module;
}

function normalizePlayerName(name) {
  return getPlayerSearchModule()
    .normalizePlayerName(name);
}

function getPlayerDatabaseName(player) {
  return getPlayerSearchModule()
    .getPlayerDatabaseName(player);
}

async function searchPlayersByName(name) {
  return getPlayerSearchModule()
    .searchPlayersByName(name);
}

async function createGuestPlayer(
  playerName
) {
  return getPlayerSearchModule()
    .createGuestPlayer(
      playerName
    );
}

async function selectOrCreatePlayer(
  playerName
) {
  return getPlayerSearchModule()
    .selectOrCreatePlayer(
      playerName
    );
}

/* =========================
   玩家編輯 Modal
   已搬至：
   modules/car/detail/player/player-editor.js
========================= */

function getPlayerEditorModule() {
  const module =
    window.JLYCarDetailPlayerEditor;

  if (!module) {
    throw new Error(
      "Player Editor 模組尚未載入"
    );
  }

  return module;
}

function ensurePlayerModal() {
  return getPlayerEditorModule()
    .ensurePlayerModal();
}

function openPlayerEditor(config) {
  return getPlayerEditorModule()
    .openPlayerEditor(config);
}

function closePlayerEditor() {
  return getPlayerEditorModule()
    .closePlayerEditor();
}

function readPlayerEditorValues() {
  return getPlayerEditorModule()
    .readPlayerEditorValues();
}

async function savePlayerEditor(
  updateDefault
) {
  return getPlayerEditorModule()
    .savePlayerEditor(
      updateDefault
    );
}

// ============================================================
// 第 4B：將玩家移出車團
// 已搬至：
// modules/car/detail/player/player-actions.js
// ============================================================

function getPlayerActionsModule() {
  const module =
    window.JLYCarDetailPlayerActions;

  if (!module) {
    throw new Error(
      "Player Actions 模組尚未載入"
    );
  }

  return module;
}

async function removePlayerFromCar(
  playerIndex
) {
  return getPlayerActionsModule()
    .removePlayerFromCar(
      playerIndex
    );
}

// ============================================================
// 第 5A：主揪手動新增玩家
// 已搬至：
// modules/car/detail/player/player-manual-add.js
// ============================================================

function getPlayerManualAddModule() {
  const module =
    window.JLYCarDetailPlayerManualAdd;

  if (!module) {
    throw new Error(
      "Player Manual Add 模組尚未載入"
    );
  }

  return module;
}

async function addPlayerManually(
  seatId = ""
) {
  return getPlayerManualAddModule()
    .addPlayerManually(
      seatId
    );
}

/* =========================
   第 5B：車團詳情與玩家列表
========================= */

function escapeHtml(value) {
  return String(
    value == null
      ? ""
      : value
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getDetailBox() {
  return (
    document.getElementById(
      "detailBox"
    ) ||
    document.getElementById(
      "carDetail"
    ) ||
    document.querySelector(
      "[data-car-detail]"
    )
  );
}

async function saveSeatSlotsToFirestore(
  nextSlots,
  actionResult
) {
  const db = window.db;
  const carId = getCarId();

  if (!db) {
    throw new Error(
      "Firebase 尚未載入"
    );
  }

  if (!carId) {
    throw new Error(
      "找不到車團 ID"
    );
  }

  const slots =
    Array.isArray(nextSlots)
      ? nextSlots.map(function (slot) {
          return {
            ...slot,
            player:
              slot && slot.player
                ? {
                    ...slot.player
                  }
                : null
          };
        })
      : [];

  await db
    .collection("cars")
    .doc(carId)
    .update({
      slots,
      updatedAt: nowTime()
    });

  await syncJLYCloudCarViewFromCore(
    carId
  );

  console.log(
    "✅ Seat Engine 已同步 Firestore",
    {
      actionResult,
      slots
    }
  );

  return slots;
}

function renderSeatBoard(
  car,
  players
) {
  const mount =
    document.getElementById(
      "seatBoardMount"
    );

  if (!mount) {
    console.warn(
      "找不到 seatBoardMount"
    );

    return;
  }

  if (
    !window.JLYSeatController ||
    !window.JLYSeatController.isReady()
  ) {
    if (
      !window.JLYSeatBoard ||
      !window.JLYSeatBoard.isReady()
    ) {
      mount.innerHTML =
        buildSeatBoardHtml(
          car,
          players
        );

      return;
    }

    window.JLYSeatBoard.render(
      mount,
      car,
      players,
      {
        editable: true,
        draggable: true,
        showWaitingArea: true,
        showSummary: true
      }
    );

    return;
  }

  window.JLYSeatController.render(
    mount,
    car,
    players,
    {
      editable: true,
      draggable: true,
      showWaitingArea: true,
      showSummary: true,

      onSlotsChange:
        async function (
          nextSlots,
          actionResult
        ) {
          try {
            car.slots =
              Array.isArray(nextSlots)
                ? nextSlots.map(
                    function (slot) {
                      return {
                        ...slot,
                        player:
                          slot &&
                          slot.player
                            ? {
                                ...slot.player
                              }
                            : null
                      };
                    }
                  )
                : [];

            await saveSeatSlotsToFirestore(
              car.slots,
              actionResult
            );
          } catch (error) {
            console.error(
              "座位資料儲存失敗：",
              error
            );

            alert(
              "座位變更尚未成功儲存，請重新整理後再試。\n\n" +
                (
                  error &&
                  error.message
                    ? error.message
                    : "未知錯誤"
                )
            );
          }
        }
    }
  );
}

function getPlayerDisplayName(
  player
) {
  return (
    player.hostAlias ||
    player.name ||
    player.displayName ||
    player.playerName ||
    "未命名玩家"
  );
}

function getPlayerSeatLabel(
  player,
  index
) {
  return (
    player.seatLabel ||
    player.roleChoice ||
    String(index + 1)
  );
}

function getPlayerSummary(
  player
) {
  const parts = [
    getPlayerDisplayName(player),
    player.position || "不限"
  ];

  if (
    player.isCrossPlay === true
  ) {
    parts.push("反串");
  }

  if (
    player.status &&
    player.status !== "已加入"
  ) {
    parts.push(
      player.status
    );
  }

  return parts.join("／");
}

function countPlayersByPosition(
  players,
  position
) {
  return players.filter(
    function (player) {
      return (
        player.status !==
          "已取消" &&
        player.position ===
          position
      );
    }
  ).length;
}

function formatHistoryTime(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleString(
    "zh-TW",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

function openExistingPlayerEditor(
  playerIndex
) {
  const index =
    Number(playerIndex);

  if (
    !Number.isInteger(index) ||
    index < 0
  ) {
    alert("找不到玩家資料");
    return;
  }

  const player =
    window
      .currentCarPlayers[
        index
      ];

  if (!player) {
    alert(
      "找不到玩家資料，請重新整理頁面"
    );

    return;
  }

  openPlayerEditor({
    mode: "edit",
    playerIndex: index,
    data: player
  });
}

function buildApplicationsHtml(
  applications
) {
  if (
    applications.length === 0
  ) {
    return (
      "<p>目前沒有待確認申請</p>"
    );
  }

  return applications
    .map(function (
      app,
      index
    ) {
      const playerName =
        app.name ||
        app.playerName ||
        "未命名玩家";

        const stablePlayerId = String(
  app.playerId ||
  app.id ||
  app.applicationId ||
  (
    "car-player-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  )
);

      const position =
        app.role ||
        app.position ||
        "不限";

      const crossPlayText =
        app.isCrossPlay === true
          ? "／反串"
          : "";

      return `
        <div class="player-card">
          <p>
            👤 ${escapeHtml(
              playerName
            )}
          </p>

          <p>
            ${escapeHtml(
              position
            )}${crossPlayText}
          </p>

          <div class="row">
            <button
              type="button"
              onclick="approveApplication(${index})"
            >
              ✅ 核准
            </button>

            <button
              type="button"
              class="danger"
              onclick="rejectApplication(${index})"
            >
              ❌ 拒絕
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function buildPlayersHtml(
  players
) {
  if (
    players.length === 0
  ) {
    return (
      "<p>目前尚無玩家</p>"
    );
  }

  return players
    .map(function (
      player,
      index
    ) {
      const seatLabel =
        getPlayerSeatLabel(
          player,
          index
        );

      const summary =
        getPlayerSummary(
          player
        );

      const noteHtml =
        player.hostNote
          ? `
            <div
              class="compact-player-meta"
            >
              備註：${escapeHtml(
                player.hostNote
              )}
            </div>
          `
          : "";

      return `
        <button
          type="button"
          class="compact-player-row"
          onclick="openExistingPlayerEditor(${index})"
          aria-label="編輯 ${escapeHtml(
            getPlayerDisplayName(
              player
            )
          )}"
        >
          <span
            class="compact-player-seat"
          >
            ${escapeHtml(
              seatLabel
            )}
          </span>

          <span
            class="compact-player-main"
          >
            <span
              class="compact-player-name"
            >
              ${escapeHtml(
                summary
              )}
            </span>

            ${noteHtml}
          </span>

          <span
            aria-hidden="true"
          >
            ✏️
          </span>
        </button>
      `;
    })
    .join("");
}

// ============================================================
// 席位畫面
// ============================================================

function getSeatPlayerId(
  player,
  index
) {
  return (
    player.playerId ||
    player.id ||
    player.applicationId ||
    `legacy-player-${index + 1}`
  );
}

function findPlayerBySeat(
  seat,
  players
) {
  if (!seat.playerId) {
    return null;
  }

  return (
    players.find(function (
      player,
      index
    ) {
      return (
        getSeatPlayerId(
          player,
          index
        ) === seat.playerId
      );
    }) || null
  );
}

function buildSingleSeatHtml(
  seat,
  players
) {
  const player =
    findPlayerBySeat(
      seat,
      players
    );

  const seatNumber =
    seat.order ||
    seat.slotId ||
    seat.id ||
    "";

  if (!player) {
      return `
  <button
    type="button"
    class="compact-player-row"
    onclick="openEmptySeat('${seat.id}')"
  >
        <span
          class="compact-player-seat"
        >
          ${escapeHtml(
            seatNumber
          )}
        </span>

        <span
          class="compact-player-main"
        >
          <span
            class="compact-player-name"
          >
            空位
          </span>
        </span>
      </button>
    `;
  }

  const playerIndex =
    players.indexOf(player);

  return `
    <button
      type="button"
      class="compact-player-row"
      onclick="openExistingPlayerEditor(${playerIndex})"
    >
      <span
        class="compact-player-seat"
      >
        ${escapeHtml(
          seatNumber
        )}
      </span>

      <span
        class="compact-player-main"
      >
        <span
          class="compact-player-name"
        >
          ${escapeHtml(
            getPlayerSummary(
              player
            )
          )}
        </span>

        ${
          player.hostNote
            ? `
              <span
                class="compact-player-meta"
              >
                備註：${escapeHtml(
                  player.hostNote
                )}
              </span>
            `
            : ""
        }
      </span>

      <span
        aria-hidden="true"
      >
        ✏️
      </span>
    </button>
  `;
}

function buildSeatGroupHtml(
  title,
  seats,
  players
) {
  if (seats.length === 0) {
    return "";
  }

  return `
    <div
      class="seat-group"
      style="margin-top: 18px;"
    >
      <h4
        style="
          margin: 0 0 10px;
        "
      >
        ${title}
      </h4>

      ${seats
        .map(function (seat) {
          return buildSingleSeatHtml(
            seat,
            players
          );
        })
        .join("")}
    </div>
  `;
}

function buildSeatBoardHtml(
  car,
  players
) {
  const slots =
    typeof getSlots === "function"
      ? getSlots(car)
      : (
          Array.isArray(car.slots)
            ? car.slots
            : []
        );

  if (slots.length === 0) {
    return buildPlayersHtml(
      players
    );
  }

  const maleSeats =
    slots.filter(function (seat) {
      return (
        seat.originalType === "male" ||
        (
          seat.originalType ===
            "flexible" &&
          seat.type === "male"
        )
      );
    });

  const femaleSeats =
    slots.filter(function (seat) {
      return (
        seat.originalType === "female" ||
        (
          seat.originalType ===
            "flexible" &&
          seat.type === "female"
        )
      );
    });

  const flexibleSeats =
    slots.filter(function (seat) {
      return (
        seat.originalType ===
          "flexible" &&
        seat.type !== "male" &&
        seat.type !== "female"
      );
    });

  return `
    ${buildSeatGroupHtml(
      "👦 男位",
      maleSeats,
      players
    )}

    ${buildSeatGroupHtml(
      "👧 女位",
      femaleSeats,
      players
    )}

    ${buildSeatGroupHtml(
      "👤 不限位",
      flexibleSeats,
      players
    )}
  `;
}

function buildHistoryHtml(
  history
) {
  if (
    history.length === 0
  ) {
    return (
      "<p>目前沒有紀錄</p>"
    );
  }

  return [...history]
    .reverse()
    .map(function (
      item
    ) {
      return `
        <div
          class="timeline-item"
        >
          <p>
            ${escapeHtml(
              formatHistoryTime(
                item.time
              )
            )}
          </p>

          <p>
            ${escapeHtml(
              item.type ||
              "紀錄"
            )}｜${escapeHtml(
              item.text ||
              ""
            )}
          </p>
        </div>
      `;
    })
    .join("");
}

/* ============================================================
   車團詳情頁區塊渲染
   第一階段只拆分畫面結構，不改變原有功能與資料流程。
============================================================ */

// ============================================================
// 第 5B-1：車團資訊小卡
// 未來拆檔時，可整段搬到 cardetail-info.js
// ============================================================

function buildCarSummaryHtml(config) {
  const {
    scriptName,
    car,
    studioName,
    status,
    activePlayerCount,
    total
  } = config;

  // ----------------------------------------------------------
  // 顯示文字
  // ----------------------------------------------------------

  const isPlanning =
  car.status ===
    "規劃中" ||
  car.planningStatus ===
    "unscheduled" ||
  !car.gameDate;

const dateText =
  isPlanning
    ? "日期待安排"
    : (
        car.gameDate ||
        "尚未設定"
      );

const timeText =
  isPlanning
    ? "—"
    : (
        car.gameTime ||
        "尚未設定"
      );

  const priceNumber =
    Number(car.price || 0);

  const priceText =
    priceNumber > 0
      ? `NT$ ${priceNumber.toLocaleString("zh-TW")}`
      : "尚未設定";

  const peopleText =
    total > 0
      ? `${activePlayerCount} / ${total}`
      : `${activePlayerCount} 人`;

  const studioText =
    studioName ||
    "尚未設定";

  const locationText =
    car.location ||
    car.address ||
    "尚未設定";

  const noteText =
    car.note ||
    "無";

  // ----------------------------------------------------------
  // 車團狀態燈號
  // ----------------------------------------------------------

  const statusClass =
  status === "規劃中"
    ? "is-planning"
    : status === "招募中"
      ? "is-recruiting"
      : status === "已滿"
        ? "is-full"
        : status === "已結束"
          ? "is-finished"
          : status === "已取消"
            ? "is-cancelled"
            : "";

  // ----------------------------------------------------------
  // 單張資訊卡產生器
  // editable 為 true 時，點擊會前往編輯車團頁
  // 目前人數只顯示，因此不傳 editable
  // ----------------------------------------------------------

  function buildInfoItem(options) {
    const {
      icon,
      label,
      value,
      field,
      editable,
      wide
    } = options;

    const cardClass = [
      "car-info-item",
      editable
        ? "is-editable"
        : "is-readonly",
      wide
        ? "is-wide"
        : ""
    ]
      .filter(Boolean)
      .join(" ");

    const fieldAttribute =
      field
        ? `data-car-field="${escapeHtml(field)}"`
        : "";

    const clickAttribute =
      editable && field
        ? `onclick="openSingleFieldEditor('${escapeHtml(field)}')"`
        : "";

    const keyboardAttributes =
  editable && field
    ? `
      role="button"
      tabindex="0"
      onkeydown="
        if (
          event.key === 'Enter' ||
          event.key === ' '
        ) {
          event.preventDefault();
          openSingleFieldEditor(
            '${escapeHtml(field)}'
          );
        }
      "
    `
    : "";

    return `
      <div
        class="${cardClass}"
        ${fieldAttribute}
        ${clickAttribute}
        ${keyboardAttributes}
      >
        <div class="car-info-item-top">
          <span
            class="car-info-icon"
            aria-hidden="true"
          >
            ${icon}
          </span>

          <span class="car-info-label">
            ${escapeHtml(label)}
          </span>

          ${
            editable
              ? `
                <span
                  class="car-info-edit-hint"
                  aria-hidden="true"
                >
                  ›
                </span>
              `
              : ""
          }
        </div>

        <div class="car-info-value">
          ${escapeHtml(value)}
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------------
  // 完整資訊區
  // ----------------------------------------------------------

  return `
    <section class="car-info-section">

      <div class="car-info-title-row">
        <h1 class="car-info-title">
          ${escapeHtml(scriptName)}
        </h1>

        <div
          class="car-status-indicator ${statusClass}"
          aria-label="${escapeHtml(status)}"
        >
          <span
            class="car-status-light"
            aria-hidden="true"
          ></span>

          <span class="car-status-text">
            ${escapeHtml(status)}
          </span>
        </div>
      </div>

      <div class="car-info-grid">

        ${buildInfoItem({
          icon: "📅",
          label: "日期",
          value: dateText,
          field: "gameDate",
          editable: true
        })}

        ${buildInfoItem({
          icon: "🕒",
          label: "時間",
          value: timeText,
          field: "gameTime",
          editable: true
        })}

        ${buildInfoItem({
          icon: "💰",
          label: "金額",
          value: priceText,
          field: "price",
          editable: true
        })}

        ${buildInfoItem({
          icon: "👥",
          label: "目前人數",
          value: peopleText,
          editable: false
        })}

        ${buildInfoItem({
          icon: "🏠",
          label: "工作室",
          value: studioText,
          field: "studioName",
          editable: true
        })}

        ${buildInfoItem({
          icon: "📍",
          label: "地點",
          value: locationText,
          field: "location",
          editable: true
        })}

        ${buildInfoItem({
          icon: "📝",
          label: "備註",
          value: noteText,
          field: "note",
          editable: true,
          wide: true
        })}

      </div>
    </section>
  `;
}

// ============================================================
// 單一欄位編輯入口
// 目前先顯示提示，下一步再接正式編輯視窗
// ============================================================

// ============================================================
// 第 5B-3：車團資訊單一欄位編輯
// ============================================================

function openSingleFieldEditor(fieldName) {
  const car =
    window.currentCarData;

  if (!car) {
    alert("車團資料尚未載入");
    return;
  }

  const fieldConfigMap = {
    gameDate: {
      label: "日期",
      type: "date",
      value: car.gameDate || ""
    },

    gameTime: {
      label: "時間",
      type: "time",
      value: car.gameTime || ""
    },

    price: {
      label: "金額",
      type: "number",
      value: car.price || "",
      placeholder: "請輸入金額"
    },

    studioName: {
      label: "工作室",
      type: "text",
      value:
        car.studioName ||
        car.organizer ||
        "",
      placeholder: "請輸入工作室名稱"
    },

    location: {
      label: "地點",
      type: "text",
      value:
        car.location ||
        car.address ||
        "",
      placeholder: "請輸入地點"
    },

    note: {
      label: "備註",
      type: "textarea",
      value: car.note || "",
      placeholder: "請輸入備註"
    }
  };

  const config =
    fieldConfigMap[fieldName];

  if (!config) {
    alert("這個欄位目前無法編輯");
    return;
  }

  closeSingleFieldEditor();

  const backdrop =
    document.createElement("div");

  backdrop.id =
    "singleFieldEditorBackdrop";

  backdrop.className =
    "single-field-editor-backdrop";

  backdrop.innerHTML = `
    <div
      class="single-field-editor-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="singleFieldEditorTitle"
    >
      <div class="single-field-editor-header">
        <h3 id="singleFieldEditorTitle">
          修改${escapeHtml(config.label)}
        </h3>

        <button
          type="button"
          class="single-field-editor-close"
          onclick="closeSingleFieldEditor()"
          aria-label="關閉"
        >
          ×
        </button>
      </div>

      <div class="single-field-editor-body">
        ${
          config.type === "textarea"
            ? `
              <textarea
                id="singleFieldEditorInput"
                class="single-field-editor-input single-field-editor-textarea"
                placeholder="${escapeHtml(
                  config.placeholder || ""
                )}"
              ></textarea>
            `
            : `
              <input
                id="singleFieldEditorInput"
                class="single-field-editor-input"
                type="${escapeHtml(config.type)}"
                placeholder="${escapeHtml(
                  config.placeholder || ""
                )}"
                ${
                  config.type === "number"
                    ? `min="0" step="1" inputmode="numeric"`
                    : ""
                }
              >
            `
        }
      </div>

      <div class="single-field-editor-actions">
        <button
          type="button"
          class="single-field-editor-cancel"
          onclick="closeSingleFieldEditor()"
        >
          取消
        </button>

        <button
          type="button"
          class="single-field-editor-save"
          onclick="saveSingleFieldEdit('${escapeHtml(
            fieldName
          )}')"
        >
          儲存
        </button>
      </div>
    </div>
  `;

  backdrop.addEventListener(
    "click",
    function (event) {
      if (event.target === backdrop) {
        closeSingleFieldEditor();
      }
    }
  );

  document.body.appendChild(
    backdrop
  );

  const input =
    document.getElementById(
      "singleFieldEditorInput"
    );

  if (input) {
    input.value =
      String(config.value || "");

    setTimeout(function () {
      input.focus();

      if (
        typeof input.select ===
          "function" &&
        config.type !== "date" &&
        config.type !== "time"
      ) {
        input.select();
      }
    }, 50);

    input.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Enter" &&
          config.type !== "textarea"
        ) {
          event.preventDefault();

          saveSingleFieldEdit(
            fieldName
          );
        }

        if (event.key === "Escape") {
          closeSingleFieldEditor();
        }
      }
    );
  }
}

function closeSingleFieldEditor() {
  const backdrop =
    document.getElementById(
      "singleFieldEditorBackdrop"
    );

  if (backdrop) {
    backdrop.remove();
  }
}

async function saveSingleFieldEdit(
  fieldName
) {
  const db =
    window.db;

  const carId =
    getCarId();

  const input =
    document.getElementById(
      "singleFieldEditorInput"
    );

  const saveButton =
    document.querySelector(
      ".single-field-editor-save"
    );

  if (!db) {
    alert("Firebase 尚未載入");
    return;
  }

  if (!carId) {
    alert("找不到車團 ID");
    return;
  }

  if (!input) {
    alert("找不到輸入欄位");
    return;
  }

  let value =
    input.value.trim();

  if (fieldName === "price") {
    const priceNumber =
      Number(value || 0);

    if (
      !Number.isFinite(priceNumber) ||
      priceNumber < 0
    ) {
      alert("請輸入正確的金額");
      input.focus();
      return;
    }

    value = priceNumber;
  }

  if (
    fieldName === "gameDate" &&
    !value
  ) {
    alert("請選擇日期");
    input.focus();
    return;
  }

  if (
    fieldName === "gameTime" &&
    !value
  ) {
    alert("請選擇時間");
    input.focus();
    return;
  }

  const updateData = {
    [fieldName]: value,
    updatedAt:
      firebase.firestore
        .FieldValue
        .serverTimestamp()
  };

  try {
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent =
      "儲存中…";
  }

  const currentCar =
    window.currentCarData
      ? {
          ...window.currentCarData
        }
      : null;

  const shouldSyncCalendar =
    Boolean(
      currentCar &&
      window
        .JLYCalendarDetailActions &&
      window
        .JLYCalendarDetailActions
        .needsCalendarSync(
          currentCar,
          fieldName
        )
    );

  /*
    Google OAuth 必須靠近使用者按下
    「儲存」的操作，避免 Popup 被阻擋。
  */
  let googleAuthorized =
    false;

  if (shouldSyncCalendar) {
    try {
      await window
        .JLYCalendarDetailActions
        .authorizeForCar(
          currentCar
        );

      googleAuthorized =
        true;
    } catch (authError) {
      console.warn(
        "Google Calendar 授權未完成：",
        authError
      );
    }
  }

  /*
    JLY 資料先正常更新。
    Google 失敗不能阻止 JLY。
  */
  await db
    .collection("cars")
    .doc(carId)
    .update(updateData);

  await syncJLYCloudCarViewFromCore(
    carId
  );

  if (
    window.currentCarData
  ) {
    window.currentCarData[
      fieldName
    ] = value;

    if (
      fieldName ===
      "scriptName"
    ) {
      window.currentCarData
        .activityName =
        value;
    }

    if (
      fieldName ===
      "location"
    ) {
      window.currentCarData
        .locationName =
        value;
    }

    if (
      fieldName ===
      "locationName"
    ) {
      window.currentCarData
        .location =
        value;
    }
  }

  let calendarResult =
    null;

  if (
    shouldSyncCalendar &&
    googleAuthorized
  ) {
    calendarResult =
      await window
        .JLYCalendarDetailActions
        .syncAfterFieldUpdate({
          carId,
          car:
            currentCar,

          fieldName,
          value
        });
  }

  closeSingleFieldEditor();

  await renderCarDetail();

  if (
    shouldSyncCalendar &&
    !googleAuthorized
  ) {
    alert(
      "JLY 車團已更新，但 Google Calendar 尚未同步。\n\n" +
      "Google 授權未完成，之後可重新同步。"
    );
  } else if (
    calendarResult &&
    calendarResult.ok ===
      false
  ) {
    alert(
      "JLY 車團已更新，但 Google Calendar 更新失敗。\n\n" +
      (
        calendarResult.error &&
        calendarResult.error.message
          ? calendarResult
              .error.message
          : "未知錯誤"
      )
    );
  }

  } catch (error) {
    console.error(
      "更新車團欄位失敗：",
      error
    );

    alert(
      "儲存失敗：" +
      (
        error.message ||
        "未知錯誤"
      )
    );

    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent =
        "儲存";
    }
  }
}

function buildApplicationsSectionHtml(applications) {
  return `
    <div class="card">
      <h3>
        🔔 待確認申請
      </h3>

      ${buildApplicationsHtml(applications)}
    </div>
  `;
}

function buildStaffSectionHtml(car) {
  if (
    !window.JLYStaffController ||
    typeof window.JLYStaffController.render !== "function"
  ) {
    return "";
  }

  return window.JLYStaffController.render(car);
}

// ============================================================
// 第 5B-2：席位區標題與席位設定入口
// 未來拆檔時，可整段搬到 cardetail-seat.js
// ============================================================

function buildSeatSectionHtml(car) {
  return `
    <section class="seat-section">

      <div class="seat-section-header">

        <div class="seat-section-title-group">
          <h3 class="seat-section-title">
            席位安排
          </h3>

          <p class="seat-section-description">
            點玩家可編輯本場資料，點空位可加入玩家。
          </p>
        </div>

        <button
          type="button"
          class="seat-settings-button"
          onclick="openSeatSettings()"
        >
          <span
            class="seat-settings-icon"
            aria-hidden="true"
          >
            ⚙️
          </span>

          <span>
            席位設定
          </span>
        </button>

      </div>

      ${buildStaffSectionHtml(car)}

      <div id="seatBoardMount">
        <div class="seat-empty-state">
          座位載入中……
        </div>
      </div>

    </section>
  `;
}

// ============================================================
// 席位設定入口
// 目前先沿用完整編輯車團頁
// 未來再改成獨立席位設定 Modal
// ============================================================

// ============================================================
// 席位設定入口
// ============================================================

function openSeatSettings() {
  const carId =
    getCarId();

  if (!carId) {
    alert("找不到車團 ID");
    return;
  }

  location.href =
    "editcar.html?id=" +
    encodeURIComponent(carId) +
    "#seat-settings";
}

// ============================================================
// 車團歷史紀錄區
// ============================================================

function buildHistorySectionHtml(history) {
  return `
    <div class="card">
      <h3>📜 車團紀錄</h3>

      ${
        Array.isArray(history) &&
        history.length
          ? history
              .slice()
              .reverse()
              .map(function (item) {
                return `
                  <div class="history-item">
                    <strong>
                      ${escapeHtml(
                        item.type || ""
                      )}
                    </strong>

                    <p>
                      ${escapeHtml(
                        item.text || ""
                      )}
                    </p>

                    <small>
                      ${escapeHtml(
                        item.time || ""
                      )}
                    </small>
                  </div>
                `;
              })
              .join("")
          : `
            <p class="empty-text">
              尚無紀錄
            </p>
          `
      }
    </div>
  `;
}

// ============================================================
// 車團詳情頁完整結構
// ============================================================

function buildCarDetailPageHtml(config) {
  const pageRender =
    window.JLYCarDetailPageRender;

  if (
    pageRender &&
    typeof pageRender.buildPageHtml ===
      "function"
  ) {
    return pageRender.buildPageHtml(
      config
    );
  }

  console.warn(
    "Car Detail Page Render 尚未載入，使用舊版頁面組合"
  );

  return `
    ${buildCarNavigation(
      config.scriptName
    )}

    ${buildCarSummaryHtml(
      config
    )}

    ${buildSeatSectionHtml(
      config.car
    )}

    ${buildApplicationsSectionHtml(
      config.applications
    )}

    ${buildHistorySectionHtml(
      config.history
    )}
  `;
}

// ============================================================
// 載入並顯示車團詳情
// ============================================================

async function renderCarDetail() {
  const detailBox =
    getDetailBox();

  const db =
    window.db;

  const carId =
    getCarId();

  if (!detailBox) {
    console.error(
      "找不到車團詳情容器 detailBox"
    );

    return;
  }

  if (!db) {
    detailBox.innerHTML = `
      <div class="card">
        <h2>
          Firebase 尚未載入
        </h2>

        <p>
          請重新整理頁面後再試。
        </p>
      </div>
    `;

    return;
  }

  if (!carId) {
    detailBox.innerHTML = `
      <div class="card">
        <h2>
          找不到車團 ID
        </h2>
      </div>
    `;

    return;
  }

  detailBox.innerHTML = `
    <div class="card">
      <p>
        正在載入車團資料……
      </p>
    </div>
  `;

  try {
    const detailLoader =
  window.JLYCarDetailLoader;

if (
  !detailLoader ||
  typeof detailLoader.loadCar !==
    "function"
) {
  throw new Error(
    "Car Detail Loader 尚未載入"
  );
}

const loadedResult =
  await detailLoader.loadCar(
    carId
  );

const car =
  loadedResult.car;

const players =
  loadedResult.players;

const activePlayers =
  loadedResult.activePlayers;

const applications =
  loadedResult.applications;

const history =
  loadedResult.history;

window.currentCarData =
  car;

window.currentCarPlayers =
  players;

console.log(
  "🧩 Card Detail 使用 Loader 資料：",
  {
    carId:
      loadedResult.carId,

    playerCount:
      players.length,

    activePlayerCount:
      activePlayers.length,

    applicationCount:
      applications.length,

    slotCount:
      loadedResult.slots.length,

    upgradeChanged:
      Boolean(
        loadedResult.upgradeResult &&
        loadedResult.upgradeResult.changed
      )
  }
);

    const maleCount =
      countPlayersByPosition(
        activePlayers,
        "男位"
      );

    const femaleCount =
      countPlayersByPosition(
        activePlayers,
        "女位"
      );

    const anyCount =
      countPlayersByPosition(
        activePlayers,
        "不限"
      );

    const maleSlots =
      Number(
        car.maleSlots || 0
      );

    const femaleSlots =
      Number(
        car.femaleSlots || 0
      );

    const flexibleSlots =
      Number(
        car.flexibleSlots ||
        car.flexSlots ||
        0
      );

    const total =
      getTotal(car);

    const need =
      getNeed(car);

    const status =
      getAutoStatus(car);

    const scriptName =
      car.scriptName ||
      car.name ||
      "未命名劇本";

    const studioName =
      car.studioName ||
      car.location ||
      car.organizer ||
      "未填地點／工作室";

    const dmText =
      Array.isArray(car.dmList)
        ? car.dmList
            .filter(Boolean)
            .join("、")
        : (
            car.dmName ||
            "未填 DM"
          );

    detailBox.innerHTML =
      buildCarDetailPageHtml({
        scriptName,

        car,

        studioName,

        dmText,

        status,

        maleCount,

        femaleCount,

        anyCount,

        maleSlots,

        femaleSlots,

        flexibleSlots,

        activePlayerCount:
          activePlayers.length,

        total,

        need,

        applications,

        history
      });

    renderSeatBoard(
      car,
      players
    );

    enableSwipeNavigation();

  } catch (error) {
    console.error(
      "載入車團詳情失敗：",
      error
    );

    detailBox.innerHTML = `
      ${buildCarNavigation("")}

      <div class="card">
        <h2>
          載入失敗
        </h2>

        <p>
          ${escapeHtml(
            error.message ||
            "未知錯誤"
          )}
        </p>

        <button
          type="button"
          onclick="renderCarDetail()"
        >
          🔄 重新載入
        </button>
      </div>
    `;
  }
}

/* =========================
   全域函式
========================= */

window.openEmptySeat =
  async function (
    seatId
  ) {
    if (!seatId) {
      alert("找不到席位資料");
      return;
    }

    console.log(
      "準備加入席位：",
      seatId
    );

    await addPlayerManually(
      seatId
    );
  };

window.renderCarDetail =
  renderCarDetail;

  window
  .JLYCarDetailApplicationActionsConfig = {
    getCarId,

    nowTime,

    addHistory,

    renderCarDetail
  };

window.finishCar =
  finishCar;

window.cancelCar =
  cancelCar;

window.approveApplication =
  approveApplication;

window.rejectApplication =
  rejectApplication;

window.addPlayerManually =
  addPlayerManually;

window.openExistingPlayerEditor =
  openExistingPlayerEditor;

window.closePlayerEditor =
  closePlayerEditor;

window.savePlayerEditor =
  savePlayerEditor;

window.removePlayerFromCar =
  removePlayerFromCar;

window.navigateCar =
  navigateCar;

window.backToMyCars =
  backToMyCars;

window.copyJoinUrl =
  copyJoinUrl;

  function openJoinPage() {

  location.href =
    "join.html?id=" +
    encodeURIComponent(
      getCarId()
    );

}

/* =========================
   LINE 揪團文案
========================= */

function getRecruitRemainingText(car) {
  const slots =
    Array.isArray(car && car.slots)
      ? car.slots
      : [];

  const isEmptySeat = function (seat) {
    return !(
      seat &&
      (
        seat.playerId ||
        seat.player
      )
    );
  };

  if (slots.length > 0) {
    const maleSeats =
      slots.filter(function (seat) {
        return (
          seat.originalType === "male" ||
          (
            seat.originalType === "flexible" &&
            seat.type === "male"
          )
        );
      });

    const femaleSeats =
      slots.filter(function (seat) {
        return (
          seat.originalType === "female" ||
          (
            seat.originalType === "flexible" &&
            seat.type === "female"
          )
        );
      });

    const flexibleSeats =
      slots.filter(function (seat) {
        return (
          seat.originalType === "flexible" &&
          seat.type !== "male" &&
          seat.type !== "female"
        );
      });

    /*
      有男女席位的車：
      分別顯示剩餘男／女席位。
    */
    if (
      maleSeats.length > 0 ||
      femaleSeats.length > 0
    ) {
      const maleNeed =
        maleSeats.filter(isEmptySeat).length;

      const femaleNeed =
        femaleSeats.filter(isEmptySeat).length;

      const parts = [];

      if (maleNeed > 0) {
        parts.push(
          maleNeed + "男"
        );
      }

      if (femaleNeed > 0) {
        parts.push(
          femaleNeed + "女"
        );
      }

      /*
        混合席位若仍有真正「不限位」，
        保留顯示，避免席位數字消失。
      */
      const flexibleNeed =
        flexibleSeats.filter(
          isEmptySeat
        ).length;

      if (flexibleNeed > 0) {
        parts.push(
          flexibleNeed + "不限"
        );
      }

      return parts.length
        ? "缺 " + parts.join(" ")
        : "已滿團";
    }

    /*
      純不限車：
      只顯示缺幾人。
    */
    const totalNeed =
      slots.filter(isEmptySeat).length;

    return totalNeed > 0
      ? "缺 " + totalNeed + "人"
      : "已滿團";
  }

  /*
    舊資料沒有 slots 時的安全 fallback。
  */
  const total =
    Number(car.totalPeople || 0);

  const activeCount =
    getActivePlayers(car).length;

  const remaining =
    Math.max(
      total - activeCount,
      0
    );

  return remaining > 0
    ? "缺 " + remaining + "人"
    : "已滿團";
}

function getRecruitDmText(car) {
  if (
    Array.isArray(car.dmList)
  ) {
    return car.dmList
      .map(function (item) {
        if (
          typeof item === "string"
        ) {
          return item.trim();
        }

        if (
          item &&
          typeof item === "object"
        ) {
          return String(
            item.displayName ||
            item.name ||
            item.dmName ||
            ""
          ).trim();
        }

        return "";
      })
      .filter(Boolean)
      .join("、");
  }

  return String(
    car.dmName || ""
  ).trim();
}

function getRecruitStudioLocationText(
  car
) {
  const studio =
    String(
      car.studioName ||
      car.organizerName ||
      car.organizer ||
      ""
    ).trim();

  const location =
    String(
      car.locationName ||
      car.location ||
      car.address ||
      ""
    ).trim();

  if (
    studio &&
    location &&
    studio !== location
  ) {
    return (
      studio +
      "｜" +
      location
    );
  }

  return (
    studio ||
    location ||
    ""
  );
}

function buildRecruitmentText(
  car,
  options
) {
  const settings =
    options || {};

  const lines = [];

  const scriptName =
    String(
      car.scriptName ||
      car.activityName ||
      "未命名劇本"
    ).trim();

  const date =
    String(
      car.gameDate || ""
    ).trim();

  const time =
    String(
      car.gameTime || ""
    ).trim();

  const price =
    Number(
      car.price || 0
    );

  const dmText =
    getRecruitDmText(car);

  const studioLocation =
    getRecruitStudioLocationText(
      car
    );

  const note =
    String(
      car.note || ""
    ).trim();

  lines.push(
    "🎭 " + scriptName
  );

  lines.push("");

  if (
    date ||
    time
  ) {
    lines.push(
      "📅 " +
      [date, time]
        .filter(Boolean)
        .join(" ")
    );
  }

  if (price > 0) {
    lines.push(
      "💰 $" +
      price.toLocaleString(
        "zh-TW"
      )
    );
  }

  lines.push(
    "👥 " +
    getRecruitRemainingText(car)
  );

  if (
    settings.includeDm &&
    dmText
  ) {
    lines.push("");
    lines.push(
      "🎲 DM：" +
      dmText
    );
  }

  if (studioLocation) {
    lines.push(
      "🏠 " +
      studioLocation
    );
  }

  if (
    settings.includeNote &&
    note
  ) {
    lines.push(
      "📝 備註：" +
      note
    );
  }

  return lines.join("\n").trim();
}

function closeRecruitmentTextModal() {
  const old =
    document.getElementById(
      "recruitmentTextBackdrop"
    );

  if (old) {
    old.remove();
  }
}

async function confirmCopyRecruitmentText() {
  const car =
    window.currentCarData;

  if (!car) {
    alert(
      "車團資料尚未載入完成"
    );
    return;
  }

  const includeDm =
    Boolean(
      document.getElementById(
        "recruitmentIncludeDm"
      ) &&
      document.getElementById(
        "recruitmentIncludeDm"
      ).checked
    );

  const includeNote =
    Boolean(
      document.getElementById(
        "recruitmentIncludeNote"
      ) &&
      document.getElementById(
        "recruitmentIncludeNote"
      ).checked
    );

  const text =
    buildRecruitmentText(
      car,
      {
        includeDm,
        includeNote
      }
    );

  try {
    await navigator.clipboard
      .writeText(text);

    closeRecruitmentTextModal();

    alert(
      "✅ 已複製 LINE 揪團文案"
    );
  } catch (error) {
    console.error(
      "複製 LINE 揪團文案失敗：",
      error
    );

    alert(
      "複製失敗，請稍後再試"
    );
  }
}

function copyRecruitmentText() {
  const car =
    window.currentCarData;

  if (!car) {
    alert(
      "車團資料尚未載入完成"
    );
    return;
  }

  closeCarMenu();
  closeRecruitmentTextModal();

  const dmText =
    getRecruitDmText(car);

  const note =
    String(
      car.note || ""
    ).trim();

  const backdrop =
    document.createElement(
      "div"
    );

  backdrop.id =
    "recruitmentTextBackdrop";

  backdrop.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:9999",
    "background:rgba(0,0,0,.45)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:20px"
  ].join(";");

  backdrop.innerHTML = `
    <div
      style="
        width:min(420px,100%);
        background:#fff;
        border-radius:18px;
        padding:20px;
        box-sizing:border-box;
        box-shadow:0 16px 50px rgba(0,0,0,.22);
      "
    >
      <h3
        style="
          margin:0 0 16px;
        "
      >
        📋 LINE 揪團文案
      </h3>

      <p
        style="
          margin:0 0 16px;
          line-height:1.6;
        "
      >
        劇本、日期時間、金額、缺額、
        工作室／地點會自動帶入。
      </p>

      ${
        dmText
          ? `
            <label
              style="
                display:flex;
                gap:10px;
                align-items:center;
                margin:12px 0;
              "
            >
              <input
                type="checkbox"
                id="recruitmentIncludeDm"
              >
              加入 DM
            </label>
          `
          : ""
      }

      ${
        note
          ? `
            <label
              style="
                display:flex;
                gap:10px;
                align-items:center;
                margin:12px 0;
              "
            >
              <input
                type="checkbox"
                id="recruitmentIncludeNote"
              >
              加入備註
            </label>
          `
          : ""
      }

      <div
        style="
          display:flex;
          gap:10px;
          margin-top:20px;
        "
      >
        <button
          type="button"
          onclick="confirmCopyRecruitmentText()"
          style="
            flex:1;
            padding:12px;
          "
        >
          複製文案
        </button>

        <button
          type="button"
          onclick="closeRecruitmentTextModal()"
          style="
            padding:12px;
          "
        >
          取消
        </button>
      </div>
    </div>
  `;

  backdrop.addEventListener(
    "click",
    function (event) {
      if (
        event.target ===
        backdrop
      ) {
        closeRecruitmentTextModal();
      }
    }
  );

  document.body.appendChild(
    backdrop
  );
}

/*
  舊名稱保留相容，
  避免其他地方仍呼叫它。
*/
async function copyCurrentPublicPost() {
  copyRecruitmentText();
}

window.copyRecruitmentText =
  copyRecruitmentText;

window.confirmCopyRecruitmentText =
  confirmCopyRecruitmentText;

window.closeRecruitmentTextModal =
  closeRecruitmentTextModal;

async function copyCurrentGroupPost() {

  const car =
    window.currentCarData;

  if (!car) {
    return;
  }

  const text = `
🎭 ${car.scriptName}

提醒大家：

📅 ${car.gameDate}
🕒 ${car.gameTime}

🏠 ${car.location || ""}

請準時到場。

謝謝大家❤️
`;

  try {

    await navigator.clipboard.writeText(
      text.trim()
    );

    alert(
      "已複製群組公告"
    );

  } catch (error) {

    console.error(error);

    alert(
      "複製失敗"
    );

  }

}

/* =========================
   初始化
========================= */

document.addEventListener(
  "DOMContentLoaded",
  async function () {

    ensurePlayerModal();

    const timer =
      setInterval(
        function () {

          if (!window.db) {
            return;
          }

          clearInterval(
            timer
          );

          renderCarDetail();

          enableSwipeNavigation();

        },
        200
      );

  }
);