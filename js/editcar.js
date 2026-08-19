console.log("editcar.js 已成功載入！");

// ============================================================
// JLY Host System
// 編輯車團 V1.1
// ============================================================

let currentEditingCar = null;

function editNowTime() {
  return new Date().toISOString();
}

function getEditCarId() {
  return new URLSearchParams(
    location.search
  ).get("id");
}

function escapeEditHtml(value) {
  return String(
    value == null ? "" : value
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getEditRadioValue(
  name,
  defaultValue
) {
  const checked =
    document.querySelector(
      `input[name="${name}"]:checked`
    );

  return checked
    ? checked.value
    : defaultValue;
}

function getSavedPeopleMode(car) {
  if (
    car.peopleMode === "gender" ||
    car.peopleMode === "total"
  ) {
    return car.peopleMode;
  }

  const maleSlots =
    Number(car.maleSlots || 0);

  const femaleSlots =
    Number(car.femaleSlots || 0);

  const flexibleSlots =
    Number(
      car.flexibleSlots ||
      car.flexSlots ||
      0
    );

  if (
    maleSlots > 0 ||
    femaleSlots > 0
  ) {
    return "gender";
  }

  if (
    flexibleSlots > 0 ||
    Number(car.totalPeople || 0) > 0
  ) {
    return "total";
  }

  return "gender";
}

function getSavedFlexibleSlots(car) {
  const directValue =
    Number(
      car.flexibleSlots ||
      car.flexSlots ||
      0
    );

  if (directValue > 0) {
    return directValue;
  }

  if (Array.isArray(car.slots)) {
    return car.slots.filter(
      function (slot) {
        return (
          slot.originalType ===
            "flexible" ||
          slot.type === "flexible" ||
          slot.type === "flex"
        );
      }
    ).length;
  }

  const mode =
    getSavedPeopleMode(car);

  if (mode === "total") {
    return Number(
      car.totalPeople ||
      car.capacity ||
      0
    );
  }

  const total =
    Number(
      car.totalPeople ||
      car.capacity ||
      0
    );

  const male =
    Number(car.maleSlots || 0);

  const female =
    Number(car.femaleSlots || 0);

  return Math.max(
    0,
    total - male - female
  );
}

function toggleEditPeopleMode() {
  const mode =
    getEditRadioValue(
      "peopleMode",
      "gender"
    );

  const genderBox =
    document.getElementById(
      "genderBox"
    );

  const totalBox =
    document.getElementById(
      "totalBox"
    );

  if (genderBox) {
    genderBox.style.display =
      mode === "gender"
        ? "block"
        : "none";
  }

  if (totalBox) {
    totalBox.style.display =
      mode === "total"
        ? "block"
        : "none";
  }
}

function renderEditForm(car) {
  const editBox =
    document.getElementById(
      "editBox"
    );

  if (!editBox) {
    return;
  }

  const isPlanning =
  car.status === "規劃中" ||
  car.planningStatus === "unscheduled" ||
  !car.gameDate;
  
  const peopleMode =
    getSavedPeopleMode(car);

  const maleSlots =
    Number(car.maleSlots || 0);

  const femaleSlots =
    Number(car.femaleSlots || 0);

  const flexibleSlots =
    getSavedFlexibleSlots(car);

  const calculatedTotal =
    maleSlots +
    femaleSlots +
    flexibleSlots;

  const totalPeople =
    Number(
      car.totalPeople ||
      car.capacity ||
      calculatedTotal ||
      0
    );

  editBox.innerHTML = `
    <label for="scriptName">
      劇本名稱
    </label>

    <input
      id="scriptName"
      type="text"
      value="${escapeEditHtml(
        car.scriptName ||
        car.name ||
        ""
      )}"
    >

    ${
  isPlanning
    ? `
      <div
        style="
          margin: 14px 0 18px;
          padding: 16px;
          border: 1px solid #f1d48a;
          border-radius: 14px;
          background: #fffaf0;
        "
      >
        <div
          style="
            font-weight: 700;
            margin-bottom: 6px;
          "
        >
          🟡 日期待安排
        </div>

        <div
          style="
            color: #777;
            font-size: 14px;
            line-height: 1.6;
          "
        >
          這台車目前在規劃中。<br>
          日期與時間之後可從車團詳細頁安排。
        </div>
      </div>

      <input
        id="gameDate"
        type="hidden"
        value=""
      >

      <input
        id="gameTime"
        type="hidden"
        value=""
      >
    `
    : `
      <label for="gameDate">
        日期
      </label>

      <input
        id="gameDate"
        type="date"
        value="${escapeEditHtml(
          car.gameDate || ""
        )}"
      >

      <label for="gameTime">
        時間
      </label>

      <input
        id="gameTime"
        type="time"
        value="${escapeEditHtml(
          car.gameTime || ""
        )}"
      >
    `
}

    <label for="locationName">
      地點
    </label>

    <input
      id="locationName"
      type="text"
      value="${escapeEditHtml(
        car.locationName ||
        car.location ||
        ""
      )}"
    >

    <label for="studioName">
      工作室／開團單位
    </label>

    <input
      id="studioName"
      type="text"
      value="${escapeEditHtml(
        car.studioName ||
        car.organizerName ||
        car.organizer ||
        ""
      )}"
    >

    <label for="dmName">
      DM
    </label>

    <input
      id="dmName"
      type="text"
      value="${escapeEditHtml(
        car.dmName || ""
      )}"
    >

    <label for="price">
      車資
    </label>

    <input
      id="price"
      type="number"
      min="0"
      value="${
        car.price == null
          ? ""
          : escapeEditHtml(car.price)
      }"
    >

    <label for="note">
      備註
    </label>

    <textarea
      id="note"
      rows="4"
    >${escapeEditHtml(
      car.note || ""
    )}</textarea>

    <hr>

    <label>
      人數配置
    </label>

    <label class="checkbox-row">
      <input
        type="radio"
        name="peopleMode"
        value="gender"
        ${
          peopleMode === "gender"
            ? "checked"
            : ""
        }
        onchange="toggleEditPeopleMode()"
      >
      固定男女配置
    </label>

    <label class="checkbox-row">
      <input
        type="radio"
        name="peopleMode"
        value="total"
        ${
          peopleMode === "total"
            ? "checked"
            : ""
        }
        onchange="toggleEditPeopleMode()"
      >
      不限性別
    </label>

    <div id="genderBox">
      <label for="maleSlots">
        男位
      </label>

      <input
        id="maleSlots"
        type="number"
        min="0"
        value="${maleSlots}"
      >

      <label for="femaleSlots">
        女位
      </label>

      <input
        id="femaleSlots"
        type="number"
        min="0"
        value="${femaleSlots}"
      >

      <label for="flexibleSlots">
        不限位
      </label>

      <input
        id="flexibleSlots"
        type="number"
        min="0"
        value="${flexibleSlots}"
      >

      <small>
        不限位可依玩家實際選擇，
        自動列入男位或女位。
      </small>
    </div>

    <div id="totalBox">
      <label for="totalPeople">
        總人數
      </label>

      <input
        id="totalPeople"
        type="number"
        min="1"
        value="${totalPeople}"
      >

      <small>
        使用不限性別時，
        全部席位都會建立為不限位。
      </small>
    </div>

    <hr>

    <label class="checkbox-row">
      <input
        id="isHost"
        type="checkbox"
        ${
          car.isHost !== false
            ? "checked"
            : ""
        }
      >
      我是主揪
    </label>

    <label class="checkbox-row">
      <input
        id="isPlayer"
        type="checkbox"
        ${
          car.isPlayer === true
            ? "checked"
            : ""
        }
      >
      我參加
    </label>

    <button
      type="button"
      onclick="saveEditCar()"
    >
      💾 儲存修改
    </button>
  `;

  toggleEditPeopleMode();
}

function getActivePlayers(car) {
  const players =
    Array.isArray(car.players)
      ? car.players
      : [];

  return players.filter(
    function (player) {
      return (
        player.status !== "已取消" &&
        player.status !== "取消"
      );
    }
  );
}

function getPlayerIdForSeat(
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

function normalizePlayerSeatType(
  player
) {
  const position =
    player.position ||
    player.roleChoice ||
    "";

  if (
    position === "男位" ||
    position === "male"
  ) {
    return "male";
  }

  if (
    position === "女位" ||
    position === "female"
  ) {
    return "female";
  }

  return "flexible";
}

/**
 * 人數配置改變時重新建立席位，
 * 並盡量把現有玩家安排回新席位。
 */
function rebuildSlotsWithPlayers(
  car,
  maleSlots,
  femaleSlots,
  flexibleSlots,
  totalPeople
) {
  const newSlots =
    buildSlots({
      maleSlots: maleSlots,
      femaleSlots: femaleSlots,
      flexibleSlots: flexibleSlots,
      totalPeople: totalPeople
    });

  const players =
    getActivePlayers(car);

  function findEmptySlot(type) {
    return newSlots.find(
      function (slot) {
        return (
          !slot.playerId &&
          slot.originalType === type
        );
      }
    );
  }

  function findAnyEmptySlot() {
    return newSlots.find(
      function (slot) {
        return !slot.playerId;
      }
    );
  }

  players.forEach(
    function (player, index) {
      const playerType =
        normalizePlayerSeatType(
          player
        );

      let targetSlot = null;

      if (playerType === "male") {
        targetSlot =
          findEmptySlot("male") ||
          findEmptySlot("flexible") ||
          findAnyEmptySlot();
      } else if (
        playerType === "female"
      ) {
        targetSlot =
          findEmptySlot("female") ||
          findEmptySlot("flexible") ||
          findAnyEmptySlot();
      } else {
        targetSlot =
          findEmptySlot("flexible") ||
          findAnyEmptySlot();
      }

      if (!targetSlot) {
        return;
      }

      targetSlot.playerId =
        getPlayerIdForSeat(
          player,
          index
        );

      targetSlot.updatedAt =
        editNowTime();

      if (
        targetSlot.originalType ===
          "flexible" &&
        (
          playerType === "male" ||
          playerType === "female"
        )
      ) {
        targetSlot.type =
          playerType;
      }
    }
  );

  return newSlots;
}

async function loadEditCar() {
  console.log("① loadEditCar 開始");
  const db = window.db;
  const carId = getEditCarId();
  console.log("② carId =", carId);

  const editBox =
    document.getElementById(
      "editBox"
    );

  if (!editBox) {
    return;
  }

  if (!db) {
    editBox.innerHTML =
      "Firebase 尚未載入";
    return;
  }

  if (!carId) {
    editBox.innerHTML =
      "找不到車團 ID";
    return;
  }

  try {
  const carDoc =
    await db
      .collection("cars")
      .doc(carId)
      .get();
      console.log("③ carDoc.exists =", carDoc.exists);

  if (!carDoc.exists) {
    editBox.innerHTML =
      "找不到這台車";
    return;
  }

  console.log("④ 準備 render");
  currentEditingCar = {
  id: carDoc.id,
  ...carDoc.data()
};

// ============================================================
// 編輯權限檢查
// ============================================================

const permissions =
  window.JLYPermissions;

if (
  !permissions ||
  typeof permissions.canEditCar !==
    "function"
) {
  console.error(
    "JLYPermissions 尚未載入"
  );

  editBox.innerHTML =
    "權限模組尚未載入";

  return;
}

const ownerId =
  String(
    currentEditingCar.ownerId || ""
  ).trim();

// 舊車尚未建立 ownerId 時，
// V1 暫時維持原本可編輯行為。
// 避免歷史車突然全部被鎖住。
const isLegacyCar =
  !ownerId;

const canEdit =
  isLegacyCar ||
  permissions.canEditCar(
    currentEditingCar
  );

if (!canEdit) {
  editBox.innerHTML = `
    <div
      style="
        padding: 24px;
        text-align: center;
      "
    >
      <div
        style="
          font-size: 32px;
          margin-bottom: 12px;
        "
      >
        🔒
      </div>

      <strong>
        目前身分沒有編輯這台車的權限
      </strong>

      <p
        style="
          margin-top: 10px;
          color: #666;
        "
      >
        如果你是系統管理者，
        可以使用右上角切換身分。
      </p>
    </div>
  `;

  return;
}

renderEditForm(
  currentEditingCar
);
} catch (error) {
  console.error(
    "讀取車團失敗：",
    error
  );

  editBox.innerHTML =
    "讀取失敗：" +
    error.message;
}
}

async function saveEditCar() {
  const db = window.db;
  const carId = getEditCarId();

  if (!db) {
    alert("Firebase 尚未載入");
    return;
  }

  if (!carId) {
    alert("找不到車團 ID");
    return;
  }

  if (!currentEditingCar) {
    alert("車團資料尚未載入");
    return;
  }

  const permissions =
  window.JLYPermissions;

if (
  !permissions ||
  typeof permissions.canEditCar !==
    "function"
) {
  alert(
    "權限模組尚未載入"
  );

  return;
}

const ownerId =
  String(
    currentEditingCar.ownerId || ""
  ).trim();

const isLegacyCar =
  !ownerId;

const canEdit =
  isLegacyCar ||
  permissions.canEditCar(
    currentEditingCar
  );

if (!canEdit) {
  alert(
    "目前身分沒有編輯這台車的權限"
  );

  return;
}

  const scriptName =
    document
      .getElementById("scriptName")
      .value
      .trim();

  const gameDate =
    document.getElementById(
      "gameDate"
    ).value;

  const gameTime =
    document.getElementById(
      "gameTime"
    ).value;

  const locationName =
    document
      .getElementById(
        "locationName"
      )
      .value
      .trim();

  const studioName =
    document
      .getElementById(
        "studioName"
      )
      .value
      .trim();

  const dmName =
    document
      .getElementById(
        "dmName"
      )
      .value
      .trim();

  const priceValue =
    document.getElementById(
      "price"
    ).value;

  const note =
    document
      .getElementById(
        "note"
      )
      .value
      .trim();

  if (!scriptName) {
  alert("請輸入劇本名稱");
  return;
}

const isPlanning =
  currentEditingCar.status ===
    "規劃中" ||
  currentEditingCar
    .planningStatus ===
    "unscheduled" ||
  !currentEditingCar.gameDate;

/*
  規劃中的車允許沒有日期與時間。
  正式車才需要日期與時間。
*/
if (
  !isPlanning &&
  !gameDate
) {
  alert("請選擇日期");
  return;
}

if (
  !isPlanning &&
  !gameTime
) {
  alert("請選擇時間");
  return;
}

/*
  地點改成選填。
  規劃中或尚未確認工作室時，
  都可以之後再補。
*/

  if (!locationName) {
    alert("請輸入地點");
    return;
  }

  const peopleMode =
    getEditRadioValue(
      "peopleMode",
      "gender"
    );

  let maleSlots = 0;
  let femaleSlots = 0;
  let flexibleSlots = 0;
  let totalPeople = 0;

  if (peopleMode === "gender") {
    maleSlots = Math.max(
      0,
      Number(
        document.getElementById(
          "maleSlots"
        ).value || 0
      )
    );

    femaleSlots = Math.max(
      0,
      Number(
        document.getElementById(
          "femaleSlots"
        ).value || 0
      )
    );

    flexibleSlots = Math.max(
      0,
      Number(
        document.getElementById(
          "flexibleSlots"
        ).value || 0
      )
    );

    totalPeople =
      maleSlots +
      femaleSlots +
      flexibleSlots;
  } else {
    totalPeople = Math.max(
      0,
      Number(
        document.getElementById(
          "totalPeople"
        ).value || 0
      )
    );

    maleSlots = 0;
    femaleSlots = 0;
    flexibleSlots = totalPeople;
  }

  if (totalPeople <= 0) {
    alert("請設定人數");
    return;
  }

  const activePlayerCount =
    getActivePlayers(
      currentEditingCar
    ).length;

  if (
    totalPeople <
    activePlayerCount
  ) {
    alert(
      `目前已有 ${activePlayerCount} 位玩家，` +
      `總席位不能調整為 ${totalPeople} 位。`
    );

    return;
  }

  const slots =
    rebuildSlotsWithPlayers(
      currentEditingCar,
      maleSlots,
      femaleSlots,
      flexibleSlots,
      totalPeople
    );

  const history =
    Array.isArray(
      currentEditingCar.history
    )
      ? [
          ...currentEditingCar.history
        ]
      : [];

  history.push({
  type: "編輯車團",

  text:
    (
      isPlanning
        ? "更新規劃中車團資料；"
        : "更新正式車團資料；"
    ) +
    "人數配置：" +
    `${maleSlots}男／` +
    `${femaleSlots}女／` +
    `${flexibleSlots}不限`,

  time:
    editNowTime()
});

const updatedData = {
  scriptName,

  gameDate:
    isPlanning
      ? ""
      : gameDate,

  gameTime:
    isPlanning
      ? ""
      : gameTime,

  status:
    isPlanning
      ? "規劃中"
      : currentEditingCar.status,

  planningStatus:
    isPlanning
      ? "unscheduled"
      : "scheduled",

  locationName,
  location: locationName,

  organizerName:
    studioName,

  studioName,

  dmName,

  price:
    priceValue === ""
      ? null
      : Number(priceValue),

  note,

  peopleMode,

  maleSlots,
  femaleSlots,
  flexibleSlots,
  totalPeople,
  capacity:
    totalPeople,

  slots,

  isHost:
    document.getElementById(
      "isHost"
    ).checked,

  isPlayer:
    document.getElementById(
      "isPlayer"
    ).checked,

  dataVersion: 1,
  seatSystemVersion: 1,

  history,

  updatedAt:
    editNowTime()
};

  try {
    const audit =
  window.JLYAudit;

if (
  !audit ||
  typeof audit
    .updateCarWithAudit !==
      "function"
) {
  throw new Error(
    "Audit Core 尚未載入"
  );
}

await audit
  .updateCarWithAudit({
    carId,

    actionType:
      "car_edit",

    source:
      "editcar",

    updateData:
      updatedData
  });

    alert("車團修改完成！");

    location.href =
      "car-detail.html?id=" +
      encodeURIComponent(carId);
  } catch (error) {
    console.error(
      "儲存車團失敗：",
      error
    );

    alert(
      "儲存失敗：" +
      error.message
    );
  }
}

window.loadEditCar =
  loadEditCar;

window.saveEditCar =
  saveEditCar;

window.toggleEditPeopleMode =
  toggleEditPeopleMode;

// ============================================================
// System Admin Mode 即時切換
// ============================================================

window.addEventListener(
  "jly:admin-mode-changed",
  function () {
    loadEditCar();
  }
);

  function initializeEditCarPage() {
  if (window.db) {
    loadEditCar();
    return;
  }

  let attempts = 0;

  const timer = setInterval(
    function () {
      attempts += 1;

      if (window.db) {
        clearInterval(timer);
        loadEditCar();
        return;
      }

      if (attempts >= 40) {
        clearInterval(timer);

        const editBox =
          document.getElementById(
            "editBox"
          );

        if (editBox) {
          editBox.innerHTML =
            "Firebase 載入失敗，請重新整理";
        }
      }
    },
    250
  );
}

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeEditCarPage
  );
} else {
  initializeEditCarPage();
}