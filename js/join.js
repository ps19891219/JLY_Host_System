console.log("join.js 已成功載入！");

let currentCar = null;
let currentCarId = null;

function getCarId() {
  return new URLSearchParams(location.search).get("id");
}

function nowTime() {
  return new Date().toISOString();
}

function getPlayers(car) {
  return car.players || [];
}

function getApplications(car) {
  return car.applications || [];
}

function getGuestListVisibility(car) {
  return car.guestListVisibility || "approved_only";
}

function getPositionText(player) {
  return player.position || player.roleChoice || player.role || "不限";
}

function getTotal(car) {
  const total = Number(car.totalPeople || 0);
  const male = Number(car.maleSlots || 0);
  const female = Number(car.femaleSlots || 0);

  if (total > 0) return total;
  if (male + female > 0) return male + female;
  return 0;
}

function getNeedText(car) {
  const players = getPlayers(car);

  const maleSlots = Number(car.maleSlots || 0);
  const femaleSlots = Number(car.femaleSlots || 0);
  const total = getTotal(car);

  const maleCount = players.filter(function (p) {
    return getPositionText(p).includes("男");
  }).length;

  const femaleCount = players.filter(function (p) {
    return getPositionText(p).includes("女");
  }).length;

  if (maleSlots > 0 || femaleSlots > 0) {
    const maleNeed = Math.max(maleSlots - maleCount, 0);
    const femaleNeed = Math.max(femaleSlots - femaleCount, 0);

    if (maleNeed === 0 && femaleNeed === 0) return "已滿";

    const parts = [];
    if (maleNeed > 0) parts.push(maleNeed + "男");
    if (femaleNeed > 0) parts.push(femaleNeed + "女");

    return "缺" + parts.join("");
  }

  const need = Math.max(total - players.length, 0);
  return need > 0 ? "缺" + need + "人" : "已滿";
}

function canShowGuestList(car) {
  const mode = getGuestListVisibility(car);

  if (mode === "public") return true;

  // LINE 串接前，先不判斷「是否已核准本人」
  // 之後會改成：如果目前登入玩家已在 players 裡，才回傳 true
  return false;
}

function renderGuestList(car) {
  const players = getPlayers(car);

  if (!canShowGuestList(car)) {
    return `
      <div class="card">
        <h3>👥 車友名單</h3>
        <p>主揪目前沒有公開車友名單。</p>
      </div>
    `;
  }

  return `
    <div class="card">
      <h3>👥 車友名單</h3>
      ${
        players.length === 0
          ? "<p>目前尚無玩家</p>"
          : players.map(function (player) {
              return `
                <p>
                  👤 ${player.name || "未命名"}
                  ｜${getPositionText(player)}
                  ${player.isCrossPlay ? "｜反串" : ""}
                </p>
              `;
            }).join("")
      }
    </div>
  `;
}

function renderJoinForm() {
  const formBox = document.getElementById("joinFormBox");
  if (!formBox) return;

  formBox.innerHTML = `
    <div class="card">
      <h3>🙋 我要報名</h3>

      <label>你的暱稱</label>
      <input id="joinName" placeholder="例：小梅">

      <label>報名位置</label>
      <select id="joinRole">
        <option value="男位">男位</option>
        <option value="女位">女位</option>
        <option value="不限">不限</option>
      </select>

      <label class="checkbox-row">
        <input id="isCrossPlay" type="checkbox">
        我是反串
      </label>

      <button type="button" onclick="submitJoin()">
        送出報名
      </button>
    </div>
  `;
}

async function loadJoinPage() {
  const db = window.db;
  const carId = getCarId();
  const box = document.getElementById("joinBox");

  if (!box) return;

  if (!db) {
    box.innerHTML = "<div class='card'><h3>Firebase 尚未載入</h3></div>";
    return;
  }

  if (!carId) {
    box.innerHTML = "<div class='card'><h3>找不到車團 ID</h3></div>";
    return;
  }

  currentCarId = carId;

  try {
    const doc = await db.collection("cars").doc(carId).get();

    if (!doc.exists) {
      box.innerHTML = "<div class='card'><h3>找不到這台車</h3></div>";
      return;
    }

    currentCar = {
      id: doc.id,
      ...doc.data()
    };

    const car = currentCar;
const applications = getApplications(car);
const players = getPlayers(car);

// 取得目前玩家（先用 localStorage，之後改成 LINE）
const myName = (localStorage.getItem("joinPlayerName") || "").trim();

const myApplication = applications.find(function (app) {
  return (app.name || "").trim().toLowerCase() === myName.toLowerCase();
});

const myPlayer = players.find(function (player) {
  const checkName =
    player.playerName ||
    player.name ||
    "";

  return checkName.trim().toLowerCase() === myName.toLowerCase();
});

    box.innerHTML = `
      <div class="card">
        <h2>🎭 ${car.scriptName || "未命名劇本"}</h2>

        <p>📅 ${car.gameDate || "日期未定"} ${car.gameTime || ""}</p>
        <p>📍 ${car.locationName || car.location || "地點未填"}</p>
        <p>🏠 ${car.organizerName || car.studioName || "開團單位未填"}</p>
        <p>💰 車資：${car.price || "未填"}</p>
        <p>👤 目前${getNeedText(car)}</p>

        ${car.note ? `<p>📝 ${car.note}</p>` : ""}
      </div>

      ${
  myPlayer
    ? `
      <div class="card">
        <h3>🟢 你已加入這台車</h3>

        <p>歡迎加入！等待開團即可。</p>

        <button type="button">
          👥 查看車友
        </button>
      </div>
    `
    : myApplication
    ? `
      <div class="card">
        <h3>🟡 已送出報名</h3>

        <p>目前等待主揪審核。</p>

        <button disabled>
          等待審核中
        </button>
      </div>
    `
    : `
      <button type="button" onclick="renderJoinForm()">
        🙋 我要報名
      </button>

      <div id="joinFormBox"></div>
    `
}

      <div class="card">
        <h3>📨 報名狀態</h3>
        ${
          applications.length === 0
            ? "<p>目前沒有待審核申請。</p>"
            : "<p>目前已有 " + applications.length + " 筆申請等待主揪確認。</p>"
        }
      </div>

      ${renderGuestList(car)}
    `;
  } catch (error) {
    console.error("讀取報名頁失敗：", error);
    box.innerHTML = "<div class='card'><h3>讀取失敗</h3><p>" + error.message + "</p></div>";
  }
}

async function submitJoin() {
  const db = window.db;
  const carId = currentCarId || getCarId();

  const nameInput = document.getElementById("joinName");
  const roleInput = document.getElementById("joinRole");
  const crossInput = document.getElementById("isCrossPlay");

  const name = nameInput ? nameInput.value.trim() : "";
  const role = roleInput ? roleInput.value : "不限";
  const isCrossPlay = crossInput ? crossInput.checked : false;

  if (!name) {
    alert("請輸入玩家暱稱");
    return;
  }

  try {
    const carRef = db.collection("cars").doc(carId);
    const doc = await carRef.get();

    if (!doc.exists) {
      alert("找不到這台車");
      return;
    }

    const car = doc.data();

    const players = car.players || [];
    const applications = car.applications || [];

    // ===== 防止重複報名 =====
    const alreadyJoined = players.some(function (player) {
      return (
        (player.playerName || player.name || "")
          .trim()
          .toLowerCase() === name.toLowerCase()
      );
    });

    if (alreadyJoined) {
      alert("你已經是這台車的玩家囉！");
      return;
    }

    const alreadyApply = applications.some(function (app) {
      return (
        (app.name || "")
          .trim()
          .toLowerCase() === name.toLowerCase()
      );
    });

    if (alreadyApply) {
      alert("你已經送出過報名，請等待主揪審核。");
      return;
    }

    // ===== 記住玩家 =====
    localStorage.setItem("joinPlayerName", name);

    applications.push({
      name: name,
      role: role,
      position: role,
      isCrossPlay: isCrossPlay,

      status: "pending",

      source: "join_page",

      createdAt: nowTime(),

      updatedAt: nowTime()
    });

    await carRef.update({
      applications: applications,
      updatedAt: nowTime()
    });

    alert("🎉 報名成功！等待主揪審核。");

    await loadJoinPage();

  } catch (error) {
    console.error(error);
    alert("報名失敗：" + error.message);
  }
}

window.renderJoinForm = renderJoinForm;
window.submitJoin = submitJoin;

document.addEventListener("DOMContentLoaded", loadJoinPage);