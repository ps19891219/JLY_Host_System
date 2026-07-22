console.log("cardetail.js 已成功載入！");

const MYCAR_NAVIGATION_IDS_KEY = "mycarNavigationIds";

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
  if (car.status === "已取消") {
    return "已取消";
  }

  if (car.status === "已結束") {
    return "已結束";
  }

  return getNeed(car) <= 0
    ? "已滿"
    : "招募中";
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
            onclick="copyPlayerJoinLink()"
          >
            🔗 複製玩家連結
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
========================= */

async function approveApplication(index) {
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

    const applications =
      Array.isArray(car.applications)
        ? [...car.applications]
        : [];

    const players =
      Array.isArray(car.players)
        ? [...car.players]
        : [];

    const app =
      applications[index];

    if (!app) {
      alert("找不到這筆申請");
      return;
    }

    const defaultName =
      app.name ||
      app.playerName ||
      "未命名玩家";

    players.push({
      playerId:
        app.playerId || null,

      playerName:
        defaultName,

      name:
        defaultName,

      hostAlias:
        defaultName,

      hostNote:
        "",

      position:
        app.role ||
        app.position ||
        "不限",

      roleChoice:
        "",

      seatLabel:
        String(
          players.length + 1
        ),

      isCrossPlay:
        app.isCrossPlay === true,

      source:
        app.source ||
        "join_page",

      status:
        "已加入",

      joinedAt:
        nowTime()
    });

    applications.splice(
      index,
      1
    );

    const history = addHistory(
      car,
      "玩家加入",
      defaultName +
        " 已核准加入車團"
    );

    await carRef.update({
      players,
      applications,
      history,
      updatedAt: nowTime()
    });

    alert("已核准加入！");

    renderCarDetail();
  } catch (error) {
    console.error(
      "核准申請失敗：",
      error
    );

    alert(
      "核准失敗：" +
      error.message
    );
  }
}

async function rejectApplication(index) {
  if (
    !confirm(
      "確定要拒絕這筆申請嗎？"
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

    const applications =
      Array.isArray(car.applications)
        ? [...car.applications]
        : [];

    const app =
      applications[index];

    applications.splice(
      index,
      1
    );

    const playerName =
      app &&
      (
        app.name ||
        app.playerName
      )
        ? app.name ||
          app.playerName
        : "一位玩家";

    const history = addHistory(
      car,
      "拒絕申請",
      playerName +
        " 的報名申請已被拒絕"
    );

    await carRef.update({
      applications,
      history,
      updatedAt: nowTime()
    });

    alert("已拒絕申請");

    renderCarDetail();
  } catch (error) {
    console.error(
      "拒絕申請失敗：",
      error
    );

    alert(
      "拒絕失敗：" +
      error.message
    );
  }
}

/* =========================
   Player 搜尋工具
========================= */

function normalizePlayerName(name) {
  return String(
    name || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function getPlayerDatabaseName(player) {
  return (
    player.displayName ||
    player.nickname ||
    player.playerName ||
    player.name ||
    "未命名玩家"
  );
}

async function searchPlayersByName(name) {
  const db = window.db;

  if (!db) {
    throw new Error(
      "Firebase 尚未載入"
    );
  }

  const targetName =
    normalizePlayerName(name);

  const snapshot =
    await db
      .collection("players")
      .get();

  return snapshot.docs
    .map(function (doc) {
      return {
        id: doc.id,
        ...doc.data()
      };
    })
    .filter(function (player) {
      const names = [
        player.displayName,
        player.nickname,
        player.playerName,
        player.lineDisplayName,
        ...(
          Array.isArray(
            player.aliases
          )
            ? player.aliases
            : []
        )
      ];

      return names.some(
        function (item) {
          return (
            normalizePlayerName(
              item
            ) === targetName
          );
        }
      );
    });
}

async function createGuestPlayer(
  playerName
) {
  const db = window.db;

  if (!db) {
    throw new Error(
      "Firebase 尚未載入"
    );
  }

  const now =
    nowTime();

  const newPlayerRef =
    await db
      .collection("players")
      .add({
        displayName:
          playerName,

        nickname:
          playerName,

        aliases:
          [],

        memberType:
          "guest",

        type:
          "guest",

        status:
          "active",

        isLineLinked:
          false,

        lineUserId:
          null,

        lineDisplayName:
          "",

        linePictureUrl:
          "",

        source:
          "host_manual",

        defaultPosition:
          "不限",

        defaultCrossPlay:
          false,

        createdAt:
          now,

        updatedAt:
          now
      });

  return {
    id:
      newPlayerRef.id,

    displayName:
      playerName,

    nickname:
      playerName,

    aliases:
      [],

    memberType:
      "guest",

    type:
      "guest",

    status:
      "active",

    isLineLinked:
      false,

    defaultPosition:
      "不限",

    defaultCrossPlay:
      false,

    createdAt:
      now,

    updatedAt:
      now
  };
}

async function selectOrCreatePlayer(
  playerName
) {
  const matches =
    await searchPlayersByName(
      playerName
    );

  let selectedPlayer = null;

  if (matches.length > 0) {
    let message =
      "找到同名玩家：\n\n";

    matches.forEach(
      function (
        player,
        index
      ) {
        const linkedText =
          player.isLineLinked
            ? "已串 LINE"
            : "訪客玩家";

        const defaultPosition =
          player.defaultPosition ||
          "不限";

        const crossPlayText =
          player.defaultCrossPlay
            ? "｜反串"
            : "";

        message +=
          `${index + 1}.`  +
          `${getPlayerDatabaseName(player)}` +
          `｜${linkedText}` +
          `｜${defaultPosition}` +
          `${crossPlayText}\n`;
      }
    );

    message +=
      "\n請輸入要使用的玩家編號。\n" +
      "輸入 0 代表建立另一位同名玩家。";

    const answer =
      prompt(
        message,
        "1"
      );

    if (answer === null) {
      return null;
    }

    const selectedNumber =
      Number(answer);

    if (
      !Number.isInteger(
        selectedNumber
      ) ||
      selectedNumber < 0 ||
      selectedNumber >
        matches.length
    ) {
      alert(
        "輸入的編號不正確"
      );

      return null;
    }

    if (
      selectedNumber > 0
    ) {
      selectedPlayer =
        matches[
          selectedNumber - 1
        ];
    }
  }

  if (!selectedPlayer) {
    const createNew =
      confirm(
        matches.length > 0
          ? `確定要建立另一位新的「${playerName}」嗎？`
          : `目前沒有「${playerName}」的資料，是否建立為訪客玩家？`
      );

    if (!createNew) {
      return null;
    }

    selectedPlayer =
      await createGuestPlayer(
        playerName
      );
  }

  return selectedPlayer;
}

/* =========================
   玩家編輯 Modal
========================= */

let playerEditorState = null;

function ensurePlayerModal() {
  if (
    document.getElementById(
      "playerEditorModal"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.textContent = `
    .player-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background:
        rgba(0, 0, 0, 0.48);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }

    .player-modal-backdrop[hidden] {
      display: none;
    }

    .player-modal {
      width:
        min(100%, 460px);
      max-height:
        90vh;
      overflow-y:
        auto;
      background:
        #ffffff;
      border-radius:
        18px;
      padding:
        18px;
      box-sizing:
        border-box;
    }

    .player-modal h3 {
      margin-top:
        0;
    }

    .player-modal .field {
      margin:
        14px 0;
    }

    .player-modal label {
      display:
        block;
      margin-bottom:
        6px;
      font-weight:
        700;
    }

    .player-modal input,
    .player-modal select,
    .player-modal textarea {
      width:
        100%;
      box-sizing:
        border-box;
    }

    .player-modal .inline-check {
      display:
        flex;
      align-items:
        center;
      gap:
        8px;
      font-weight:
        700;
    }

    .player-modal .inline-check input {
      width:
        auto;
    }

    .player-modal-actions {
      display:
        grid;
      gap:
        8px;
      margin-top:
        18px;
    }

    .compact-player-row {
  display:
    flex;
  align-items:
    center;
  gap:
    8px;
  width:
    100%;
  padding:
    10px 12px;
  margin:
    6px 0;
  border-radius:
    12px;
  border:
    1px solid
    rgba(0, 0, 0, 0.12);
  background:
    #ffffff;
  color:
    #333333;
  text-align:
    left;
  box-sizing:
    border-box;
}

    .compact-player-seat {
      flex:
        0 0 auto;
      min-width:
        28px;
      font-weight:
        800;
    }

    .compact-player-main {
      flex:
        1;
      min-width:
        0;
    }

    .compact-player-name {
      font-weight:
        800;
    }

    .compact-player-meta {
  font-size:
    14px;
  color:
    #666666;
  opacity:
    1;
}

    .car-detail-navigation {
      display:
        grid;
      grid-template-columns:
        1fr 1fr 1fr;
      gap:
        8px;
      margin:
        12px 0;
    }

    .car-detail-navigation button {
      margin:
        0;
    }

    @media (
      max-width: 420px
    ) {
      .car-detail-navigation {
        grid-template-columns:
          1fr;
      }
    }
  `;

  document.head.appendChild(
    style
  );

  const modal =
    document.createElement(
      "div"
    );

  modal.id =
    "playerEditorModal";

  modal.className =
    "player-modal-backdrop";

  modal.hidden =
    true;

  modal.innerHTML = `
    <div
      class="player-modal"
      role="dialog"
      aria-modal="true"
    >
      <h3
        id="playerEditorTitle"
      >
        玩家資料
      </h3>

      <div class="field">
        <label
          for="playerEditorName"
        >
          玩家名稱
        </label>

        <input
          id="playerEditorName"
          type="text"
        >
      </div>

      <div class="field">
        <label
          for="playerEditorPosition"
        >
          位置
        </label>

        <select
          id="playerEditorPosition"
        >
          <option value="不限">
            不限
          </option>

          <option value="男位">
            男位
          </option>

          <option value="女位">
            女位
          </option>
        </select>
      </div>

      <div class="field">
        <label
          class="inline-check"
        >
          <input
            id="playerEditorCrossPlay"
            type="checkbox"
          >

          反串
        </label>
      </div>

      <div class="field">
        <label
          for="playerEditorSeatLabel"
        >
          席位名稱
        </label>

        <input
          id="playerEditorSeatLabel"
          type="text"
          placeholder="未填時顯示 1、2、3……"
        >
      </div>

      <div class="field">
        <label
          for="playerEditorStatus"
        >
          本場狀態
        </label>

        <select
          id="playerEditorStatus"
        >
          <option value="已加入">
            已加入
          </option>

          <option value="候補">
            候補
          </option>

          <option value="已取消">
            已取消
          </option>
        </select>
      </div>

      <div class="field">
        <label
          for="playerEditorNote"
        >
          主揪備註
        </label>

        <textarea
          id="playerEditorNote"
          rows="3"
          placeholder="可空白"
        ></textarea>
      </div>

      <div
        class="player-modal-actions"
      >
        <button
          id="playerEditorSaveButton"
          type="button"
        >
          💾 儲存本場資料
        </button>

        <button
          id="playerEditorSaveDefaultButton"
          type="button"
          class="gray"
        >
          💾 儲存並更新玩家預設
        </button>

        <button
          id="playerEditorRemoveButton"
          type="button"
          class="gray"
          hidden
        >
          🚪 移出車團
        </button>

        <button
          type="button"
          class="gray"
          onclick="closePlayerEditor()"
        >
          ✖️ 取消
        </button>
      </div>
    </div>
  `;

  modal.addEventListener(
    "click",
    function (event) {
      if (
        event.target === modal
      ) {
        closePlayerEditor();
      }
    }
  );

  document.body.appendChild(
    modal
  );
}

function closePlayerEditor() {
  const modal =
    document.getElementById(
      "playerEditorModal"
    );

  if (modal) {
    modal.hidden =
      true;
  }

  playerEditorState =
    null;
}

function openPlayerEditor(
  config
) {
  ensurePlayerModal();

  playerEditorState = {
    mode:
      config.mode,

    playerIndex:
      typeof config.playerIndex ===
      "number"
        ? config.playerIndex
        : null,

    selectedPlayer:
      config.selectedPlayer ||
      null
  };

  const modal =
    document.getElementById(
      "playerEditorModal"
    );

  const title =
    document.getElementById(
      "playerEditorTitle"
    );

  const nameInput =
    document.getElementById(
      "playerEditorName"
    );

  const positionInput =
    document.getElementById(
      "playerEditorPosition"
    );

  const crossPlayInput =
    document.getElementById(
      "playerEditorCrossPlay"
    );

  const seatLabelInput =
    document.getElementById(
      "playerEditorSeatLabel"
    );

  const statusInput =
    document.getElementById(
      "playerEditorStatus"
    );

  const noteInput =
    document.getElementById(
      "playerEditorNote"
    );

  const removeButton =
    document.getElementById(
      "playerEditorRemoveButton"
    );

  const data =
    config.data || {};

  const selectedPlayer =
    config.selectedPlayer || {};

  title.textContent =
    config.mode === "edit"
      ? "✏️ 編輯人員資料"
      : "➕ 加入玩家";

  nameInput.value =
    data.hostAlias ||
    data.name ||
    data.playerName ||
    getPlayerDatabaseName(
      selectedPlayer
    );

  positionInput.value =
    data.position ||
    selectedPlayer.defaultPosition ||
    "不限";

  crossPlayInput.checked =
    typeof data.isCrossPlay ===
    "boolean"
      ? data.isCrossPlay
      : selectedPlayer.defaultCrossPlay ===
        true;

  seatLabelInput.value =
    data.seatLabel ||
    data.roleChoice ||
    "";

  statusInput.value =
    data.status ||
    "已加入";

  noteInput.value =
    data.hostNote ||
    "";

  removeButton.hidden =
    config.mode !== "edit";

  document.getElementById(
    "playerEditorSaveButton"
  ).onclick = function () {
    savePlayerEditor(false);
  };

  document.getElementById(
    "playerEditorSaveDefaultButton"
  ).onclick = function () {
    savePlayerEditor(true);
  };

    removeButton.onclick =
    function () {
      if (
        !playerEditorState ||
        playerEditorState.mode !==
          "edit"
      ) {
        return;
      }

      removePlayerFromCar(
        playerEditorState.playerIndex
      );
    };

  modal.hidden =
    false;
}

function readPlayerEditorValues() {
  const hostAlias =
    document
      .getElementById(
        "playerEditorName"
      )
      .value
      .trim();

  if (!hostAlias) {
    alert(
      "請輸入玩家名稱"
    );

    return null;
  }

  return {
    hostAlias,

    position:
      document.getElementById(
        "playerEditorPosition"
      ).value,

    isCrossPlay:
      document.getElementById(
        "playerEditorCrossPlay"
      ).checked,

    seatLabel:
      document
        .getElementById(
          "playerEditorSeatLabel"
        )
        .value
        .trim(),

    status:
      document.getElementById(
        "playerEditorStatus"
      ).value,

    hostNote:
      document
        .getElementById(
          "playerEditorNote"
        )
        .value
        .trim()
  };
}

async function savePlayerEditor(updateDefault) {

  if (!playerEditorState) {
    return;
  }

  const db = window.db;
  const carId = getCarId();

  if (!db) {
    alert("Firebase 尚未載入");
    return;
  }

  const values = readPlayerEditorValues();

  if (!values) {
    return;
  }

  try {

    const carRef =
      db.collection("cars").doc(carId);

    const carDoc =
      await carRef.get();

    if (!carDoc.exists) {
      alert("找不到這台車");
      return;
    }

    const car = carDoc.data();

    const players =
      Array.isArray(car.players)
        ? [...car.players]
        : [];

        const slots =
  Array.isArray(car.slots)
    ? car.slots.map(function (seat) {
        return {
          ...seat
        };
      })
    : [];

    let playerId = null;
    let historyType = "";
    let historyText = "";

    if (playerEditorState.mode === "add") {

      const selectedPlayer =
        playerEditorState.selectedPlayer;

      if (!selectedPlayer) {
        alert("找不到玩家");
        return;
      }

      const alreadyInCar =
        players.some(function (player) {

          return (
            player.playerId ===
            selectedPlayer.id
          );

        });

      if (alreadyInCar) {

        alert("這位玩家已經在車上");

        return;
      }

      playerId =
        selectedPlayer.id;

      players.push({

        playerId,

        playerName:
          getPlayerDatabaseName(
            selectedPlayer
          ),

        hostAlias:
          values.hostAlias,

        name:
          values.hostAlias,

        hostNote:
          values.hostNote,

        position:
          values.position,

        seatLabel:
          values.seatLabel,

        roleChoice:
          values.seatLabel,

        isCrossPlay:
          values.isCrossPlay,

        memberType:
          selectedPlayer.memberType ||
          "guest",

        isLineLinked:
          selectedPlayer.isLineLinked ===
          true,

        source:
          "host_manual",

        status:
          values.status,

        joinedAt:
          nowTime()

      });

      const addingSeatId =
  window.currentAddingSeatId || "";

console.log(
  "addingSeatId =",
  addingSeatId
);

console.log(
  "slots =",
  slots
);

if (addingSeatId) {
  const seat = slots.find(function (item) {
    return item.id === addingSeatId;
  });

  console.log(
    "找到的 seat =",
    seat
  );

  if (seat) {
    seat.playerId = playerId;
  }
}

      historyType =
        "主揪新增玩家";

      historyText =
        values.hostAlias +
        " 已由主揪加入車團";

    } else {

      const index =
        playerEditorState.playerIndex;

      const currentPlayer =
        players[index];

      if (!currentPlayer) {

        alert("找不到玩家");

        return;
      }

      playerId =
        currentPlayer.playerId || null;

      players[index] = {

        ...currentPlayer,

        hostAlias:
          values.hostAlias,

        name:
          values.hostAlias,

        hostNote:
          values.hostNote,

        position:
          values.position,

        seatLabel:
          values.seatLabel,

        roleChoice:
          values.seatLabel,

        isCrossPlay:
          values.isCrossPlay,

        status:
          values.status,

        updatedAt:
          nowTime()

      };

      historyType =
        "編輯玩家";

      historyText =
        values.hostAlias +
        " 已更新資料";

    }

    const history =
      addHistory(
        car,
        historyType,
        historyText
      );

    await carRef.update({

  players,

  slots,

  history,

  updatedAt: nowTime()

});

    if (
      updateDefault &&
      playerId
    ) {

      await db
        .collection("players")
        .doc(playerId)
        .set({

          displayName:
            values.hostAlias,

          nickname:
            values.hostAlias,

          defaultPosition:
            values.position,

          defaultCrossPlay:
            values.isCrossPlay,

          updatedAt:
            nowTime()

        }, {

          merge: true

        });

    }

    window.currentAddingSeatId = "";

    closePlayerEditor();

    alert(

      updateDefault
        ? "已更新玩家預設"
        : "已儲存本場資料"

    );

    renderCarDetail();

  } catch (error) {

    console.error(error);

    alert(
      "儲存失敗：" +
      error.message
    );

  }

}

// ============================================================
// 第 4B：將玩家移出車團
// ============================================================

async function removePlayerFromCar(playerIndex) {
  const db = window.db;
  const carId = getCarId();

  if (!db) {
    alert("Firebase 尚未載入");
    return;
  }

  if (!carId) {
    alert("找不到車團 ID");
    return;
  }

  const normalizedPlayerIndex = Number(playerIndex);

  if (
    !Number.isInteger(normalizedPlayerIndex) ||
    normalizedPlayerIndex < 0
  ) {
    alert("找不到要移除的玩家");
    return;
  }

  try {
    const carRef = db
      .collection("cars")
      .doc(carId);

    const carSnapshot = await carRef.get();

    if (!carSnapshot.exists) {
      alert("找不到這台車");
      return;
    }

    const carData = carSnapshot.data() || {};

    const players = Array.isArray(carData.players)
      ? [...carData.players]
      : [];

    if (normalizedPlayerIndex >= players.length) {
      alert("這位玩家已不存在，請重新整理頁面");
      await renderCarDetail();
      return;
    }

    const targetPlayer =
      players[normalizedPlayerIndex] || {};

    const playerDisplayName =
      targetPlayer.hostAlias ||
      targetPlayer.displayName ||
      targetPlayer.playerName ||
      "未命名玩家";

    const confirmRemove = confirm(
      `確定要將「${playerDisplayName}」移出這台車嗎？\n\n` +
        "移除後會保留在車團紀錄時間軸中。"
    );

    if (!confirmRemove) {
      return;
    }

    players.splice(normalizedPlayerIndex, 1);

    const history = Array.isArray(carData.history)
      ? [...carData.history]
      : [];

    history.push({
      type: "主揪移除玩家",
      text: `主揪將玩家「${playerDisplayName}」移出車團`,
      time: new Date().toISOString(),

      playerId:
        targetPlayer.playerId ||
        targetPlayer.id ||
        "",

      playerName:
        targetPlayer.playerName ||
        targetPlayer.displayName ||
        playerDisplayName,

      hostAlias:
        targetPlayer.hostAlias ||
        "",

      position:
        targetPlayer.position ||
        "不限",

      isCrossPlay:
        Boolean(targetPlayer.isCrossPlay),

      source:
        targetPlayer.source ||
        ""
    });

    await carRef.update({
      players: players,
      history: history,
      updatedAt:
        firebase.firestore.FieldValue.serverTimestamp()
    });

    closePlayerEditor();

    alert(`已將「${playerDisplayName}」移出車團`);

    await renderCarDetail();
  } catch (error) {
    console.error(
      "removePlayerFromCar 發生錯誤：",
      error
    );

    alert(
      "移除玩家失敗，請稍後再試。\n\n" +
        (error && error.message
          ? error.message
          : "")
    );
  }
}

// ============================================================
// 第 5A：主揪手動新增玩家
// ============================================================

async function addPlayerManually(
  seatId = ""
) {

  const db = window.db;
  const carId = getCarId();

  if (!db) {
    alert("Firebase 尚未載入");
    return;
  }

  if (!carId) {
  alert("找不到車團 ID");
  return;
}

window.currentAddingSeatId =
  seatId || "";

console.log(
  "目前準備加入的空位：",
  window.currentAddingSeatId
);

  const inputName = prompt(
    "請輸入玩家名稱：",
    ""
  );

  if (
    !inputName ||
    !inputName.trim()
  ) {
    return;
  }

  const playerName =
    inputName.trim();

  try {

    const matches =
      await searchPlayersByName(
        playerName
      );

    let selectedPlayer = null;

    // --------------------------------------------------------
    // 有找到同名或相似名稱玩家
    // --------------------------------------------------------

    if (
      Array.isArray(matches) &&
      matches.length > 0
    ) {

      let message =
        "找到以下玩家：\n\n";

      matches.forEach(function (
        player,
        index
      ) {

        const databaseName =
          getPlayerDatabaseName(player);

        const linkedText =
          player.isLineLinked === true
            ? "已串 LINE"
            : "訪客玩家";

        const defaultPosition =
          player.defaultPosition ||
          "不限";

        const crossPlayText =
          player.defaultCrossPlay === true
            ? "／反串"
            : "";

        const playCount =
          Number(
            player.playCount || 0
          );

        message +=
          `${index + 1}.`  +
          `${databaseName}` +
          `／${linkedText}` +
          `／${defaultPosition}` +
          `${crossPlayText}` +
          `／已玩 ${playCount} 本\n`;

      });

      message +=
        "\n請輸入玩家前面的編號。\n" +
        "輸入 0 可建立新的訪客玩家。";

      const selectedInput =
        prompt(message, "1");

      if (selectedInput === null) {
        return;
      }

      const selectedNumber =
        Number(
          selectedInput.trim()
        );

      if (
        !Number.isInteger(
          selectedNumber
        ) ||
        selectedNumber < 0 ||
        selectedNumber > matches.length
      ) {

        alert("輸入的編號不正確");
        return;

      }

      if (selectedNumber > 0) {

        selectedPlayer =
          matches[
            selectedNumber - 1
          ];

      }

    }

    // --------------------------------------------------------
    // 沒找到玩家，或選擇建立訪客玩家
    // --------------------------------------------------------

    if (!selectedPlayer) {

      const createGuest =
        confirm(
          `找不到或未選擇現有玩家。\n\n` +
          `是否建立新的訪客玩家「${playerName}」？`
        );

      if (!createGuest) {
        return;
      }

      const playerRef =
        db
          .collection("players")
          .doc();

      const newPlayer = {

        id:
          playerRef.id,

        displayName:
          playerName,

        nickname:
          playerName,

        aliases:
          [playerName],

        normalizedName:
          normalizePlayerName(
            playerName
          ),

        memberType:
          "guest",

        isLineLinked:
          false,

        lineDisplayName:
          "",

        defaultPosition:
          "不限",

        defaultCrossPlay:
          false,

        playCount:
          0,

        source:
          "host_manual",

        createdAt:
          nowTime(),

        updatedAt:
          nowTime()

      };

      await playerRef.set(
        newPlayer,
        {
          merge: true
        }
      );

      selectedPlayer =
        newPlayer;

    }

    // --------------------------------------------------------
    // 確認玩家尚未在這台車上
    // --------------------------------------------------------

    const carRef =
      db
        .collection("cars")
        .doc(carId);

    const carDoc =
      await carRef.get();

    if (!carDoc.exists) {
      alert("找不到這台車");
      return;
    }

    const car =
      carDoc.data() || {};

    const players =
      Array.isArray(car.players)
        ? car.players
        : [];

    const slots =
      Array.isArray(car.slots)
        ? [...car.slots]
        : [];

    const existingPlayer =
  players.find(function (
        player
      ) {

        if (
          selectedPlayer.id &&
          player.playerId ===
            selectedPlayer.id
        ) {
          return true;
        }

        const existingName =
          player.hostAlias ||
          player.name ||
          player.playerName ||
          "";

        const selectedName =
          getPlayerDatabaseName(
            selectedPlayer
          );

        return (
          normalizePlayerName(
            existingName
          ) ===
          normalizePlayerName(
            selectedName
          )
        );

      });

    if (existingPlayer) {
  const addingSeatId =
    window.currentAddingSeatId || "";

  const existingPlayerId =
    existingPlayer.playerId ||
    existingPlayer.id ||
    existingPlayer.profileId ||
    existingPlayer.applicationId ||
    selectedPlayer.id ||
    null;

  const currentSeat =
    slots.find(function (seat) {
      return (
        existingPlayerId &&
        seat.playerId === existingPlayerId
      );
    });

  if (currentSeat) {
    alert(
      `${getPlayerDatabaseName(
        selectedPlayer
      )} 已經在這台車上，而且已有座位`
    );

    window.currentAddingSeatId = "";
    return;
  }

  if (addingSeatId) {
    const emptySeat =
      slots.find(function (seat) {
        return (
          seat.id === addingSeatId ||
          seat.slotId === addingSeatId ||
          String(seat.order) ===
            String(addingSeatId)
        );
      });

    if (!emptySeat) {
      alert("找不到剛才點擊的空位");
      return;
    }

    if (emptySeat.playerId) {
      alert("這個位置已經有人了");
      return;
    }

    emptySeat.playerId =
      existingPlayerId;

    emptySeat.player = {
      id: existingPlayerId,
      name:
        existingPlayer.hostAlias ||
        existingPlayer.name ||
        existingPlayer.playerName ||
        getPlayerDatabaseName(
          selectedPlayer
        )
    };

    const selectedPosition =
      existingPlayer.position || "";

    if (
      emptySeat.originalType ===
        "flexible" &&
      (
        selectedPosition === "男位" ||
        selectedPosition === "male"
      )
    ) {
      emptySeat.type = "male";
    }

    if (
      emptySeat.originalType ===
        "flexible" &&
      (
        selectedPosition === "女位" ||
        selectedPosition === "female"
      )
    ) {
      emptySeat.type = "female";
    }

    await carRef.update({
      slots,
      updatedAt: nowTime()
    });

    window.currentAddingSeatId = "";

    alert(
      `${getPlayerDatabaseName(
        selectedPlayer
      )} 已補入空位`
    );

    closePlayerEditor();
    renderCarDetail();
    return;
  }

  alert(
    `${getPlayerDatabaseName(
      selectedPlayer
    )} 已經在這台車上`
  );

  return;
}

    // --------------------------------------------------------
    // 開啟玩家資料 Modal
    // 實際寫入 Firestore 交由 savePlayerEditor()
    // --------------------------------------------------------

    window.currentAddingSeatId =
  seatId || "";

openPlayerEditor({
  mode: "add",
  selectedPlayer,
  seatId:
    seatId || ""
});

  } catch (error) {

    console.error(
      "addPlayerManually 發生錯誤：",
      error
    );

    alert(
      "新增玩家失敗：" +
      (
        error &&
        error.message
          ? error.message
          : "未知錯誤"
      )
    );

  }

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
    const carDoc =
      await db
        .collection("cars")
        .doc(carId)
        .get();

    if (!carDoc.exists) {
      detailBox.innerHTML = `
        ${buildCarNavigation()}

        <div class="card">
          <h2>
            找不到這台車
          </h2>
        </div>
      `;

      return;
    }

    const car = {
      id:
        carDoc.id,

      ...carDoc.data()
    };

    const players =
      getPlayers(car);

    const activePlayers =
      getActivePlayers(car);

    const applications =
      Array.isArray(
        car.applications
      )
        ? car.applications
        : [];

    const history =
      Array.isArray(
        car.history
      )
        ? car.history
        : [];

    window.currentCarData =
      car;

    window.currentCarPlayers =
      players;

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
      Array.isArray(
        car.dmList
      )
        ? car.dmList
            .filter(Boolean)
            .join("、")
        : (
            car.dmName ||
            "未填 DM"
          );

    const canOperate =
      car.status !==
        "已結束" &&
      car.status !==
        "已取消";

    detailBox.innerHTML = `
      ${buildCarNavigation(scriptName)}

      <div class="card">
        <h2>
          🎭 ${escapeHtml(
            scriptName
          )}
        </h2>

        <p>
          📅 ${escapeHtml(
            car.gameDate ||
            "未填日期"
          )}
          ${escapeHtml(
            car.gameTime ||
            ""
          )}
        </p>

        <p>
          🏠 ${escapeHtml(
            studioName
          )}
        </p>

        <p>
          🎲 DM：${escapeHtml(
            dmText
          )}
        </p>

        <p>
          💰 車資：${escapeHtml(
            car.price || 0
          )}
        </p>

        <p>
          📌 狀態：${escapeHtml(
            status
          )}
        </p>

        <p>
          📝 備註：${escapeHtml(
            car.note || "無"
          )}
        </p>

        <hr>

        <p>
          👦 男位：${maleCount}${
            maleSlots > 0
              ? ` / ${maleSlots}`
              : ""
          }
        </p>

        <p>
          👧 女位：${femaleCount}${
            femaleSlots > 0
              ? ` / ${femaleSlots}`
              : ""
          }
        </p>

        <p>
          👤 不限：${anyCount}${
            flexibleSlots > 0
              ?  `/ ${flexibleSlots}`
              : ""
          }
        </p>

        <p>
          👥 總計：${activePlayers.length}${
            total > 0
              ? ` / ${total}`
              : ""
          }
        </p>

        <span class="badge">
          ${
            need > 0
              ? `還缺 ${need} 人`
              : "🎉 已滿車"
          }
        </span>
      </div>

      <div class="card">
        <h3>
          🔔 待確認申請
        </h3>

        ${buildApplicationsHtml(
          applications
        )}
      </div>

      <div class="seat-header">
  <h3>席位安排</h3>

  <button
    class="sync-seat-btn"
    onclick="syncPlayersToSeats()"
  >
    🔄 同步玩家與席位
  </button>
</div>

        <p
          class="compact-player-meta"
        >
          點玩家即可編輯本場資料或移出車團。
        </p>

        <div
  id="seatBoardMount"
  data-seat-board-mount="true"
></div>
      </div>

      <div class="card">
        <h3>
          📜 紀錄時間軸
        </h3>

        <div class="timeline">
          ${buildHistoryHtml(
            history
          )}
        </div>
      </div>
      }

    `;
  } catch (error) {
    console.error(
      "載入車團詳情失敗：",
      error
    );

    detailBox.innerHTML = `
      ${buildCarNavigation()}

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

async function copyCurrentPublicPost() {

  const car =
    window.currentCarData;

  if (!car) {
    return;
  }

  const text = `
🎭 ${car.scriptName}

📅 ${car.gameDate} ${car.gameTime}

🏠 ${car.location || ""}

🎲 DM：
${Array.isArray(car.dmList)
    ? car.dmList.join("、")
    : car.dmName || ""}

目前還缺
${getNeed(car)} 人

報名：
${getJoinUrl(car.id)}
`;

  try {

    await navigator.clipboard.writeText(
      text.trim()
    );

    alert(
      "已複製揪團資訊"
    );

  } catch (error) {

    console.error(error);

    alert(
      "複製失敗"
    );

  }

}

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