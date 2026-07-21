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
  const db = window.db;
  const carId = getEditCarId();

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

  if (!carDoc.exists) {
    editBox.innerHTML =
      "找不到這台車";
    return;
  }

  currentEditingCar = {
    id: carDoc.id,
    ...carDoc.data()
  };

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