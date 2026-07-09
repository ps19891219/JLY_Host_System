function getCarId() {
  return new URLSearchParams(location.search).get("id");
}

function nowTime() {
  return new Date().toISOString();
}

function addHistory(car, type, text) {
  const history = car.history || [];

  history.push({
    type,
    text,
    time: nowTime()
  });

  return history;
}

function getPlayers(car) {
  return car.players || [];
}

function getTotal(car) {
  const total = Number(car.totalPeople || 0);
  const male = Number(car.maleSlots || 0);
  const female = Number(car.femaleSlots || 0);

  if (total > 0) return total;
  if (male + female > 0) return male + female;
  return 0;
}

function getNeed(car) {
  return Math.max(getTotal(car) - getPlayers(car).length, 0);
}

function getAutoStatus(car) {
  if (car.status === "已取消") return "已取消";
  if (car.status === "已結束") return "已結束";
  return getNeed(car) <= 0 ? "已滿" : "招募中";
}

function getJoinUrl(carId) {
  return location.origin + "/pages/join.html?id=" + carId;
}

function copyJoinUrl(carId) {
  navigator.clipboard.writeText(getJoinUrl(carId));
  alert("✅ 已複製玩家報名網址");
}

async function finishCar() {
  if (!confirm("確定要將這台車標記為已結束嗎？")) return;

  const db = window.db;
  const carId = getCarId();
  const carRef = db.collection("cars").doc(carId);
  const doc = await carRef.get();

  if (!doc.exists) return alert("找不到這台車");

  const car = doc.data();
  const history = addHistory(car, "已結束", "車團已標記為已結束");

  await carRef.update({
    status: "已結束",
    endedAt: nowTime(),
    history,
    updatedAt: nowTime()
  });

  alert("已標記為已結束");
  renderCarDetail();
}

async function cancelCar() {
  const reason = prompt("請輸入取消原因，可空白：", "");

  if (!confirm("確定要取消這台車嗎？取消後資料會保留。")) return;

  const db = window.db;
  const carId = getCarId();
  const carRef = db.collection("cars").doc(carId);
  const doc = await carRef.get();

  if (!doc.exists) return alert("找不到這台車");

  const car = doc.data();
  const reasonText = reason && reason.trim() ? reason.trim() : "未填寫";
  const history = addHistory(car, "已取消", "車團已取消，原因：" + reasonText);

  await carRef.update({
    status: "已取消",
    cancelReason: reasonText,
    cancelledAt: nowTime(),
    history,
    updatedAt: nowTime()
  });

  alert("已取消車團，紀錄已保留");
  renderCarDetail();
}
async function approveApplication(index) {
  const db = window.db;
  const carId = getCarId();
  const carRef = db.collection("cars").doc(carId);
  const doc = await carRef.get();

  if (!doc.exists) return alert("找不到這台車");

  const car = doc.data();
  const applications = car.applications || [];
  const players = car.players || [];
  const app = applications[index];

  if (!app) return alert("找不到這筆申請");

  const defaultName = app.name || app.playerName || "未命名玩家";

  const hostAlias = prompt(
    "主揪顯示名稱，可修改：",
    defaultName
  );

  if (!hostAlias || !hostAlias.trim()) return;

  const hostNote = prompt(
    "主揪備註，可空白：",
    ""
  ) || "";

  players.push({
    playerName: defaultName,
    name: hostAlias.trim(),
    hostAlias: hostAlias.trim(),
    hostNote: hostNote.trim(),
    position: app.role || app.position || "不限",
    roleChoice: app.role || app.position || "不限",
    isCrossPlay: app.isCrossPlay || false,
    source: app.source || "join_page",
    status: "已加入",
    joinedAt: nowTime()
  });

  applications.splice(index, 1);

  const history = addHistory(
    car,
    "玩家加入",
    hostAlias.trim() + " 已核准加入車團"
  );

  await carRef.update({
    players,
    applications,
    history,
    updatedAt: nowTime()
  });

  alert("已核准加入！");
  renderCarDetail();
}

async function rejectApplication(index) {
  if (!confirm("確定要拒絕這筆申請嗎？")) return;

  const db = window.db;
  const carId = getCarId();
  const carRef = db.collection("cars").doc(carId);
  const doc = await carRef.get();

  if (!doc.exists) return alert("找不到這台車");

  const car = doc.data();
  const applications = car.applications || [];
  const app = applications[index];

  applications.splice(index, 1);

  const history = addHistory(
    car,
    "拒絕申請",
    (app?.name || "一位玩家") + " 的報名申請已被拒絕"
  );

  await carRef.update({
    applications,
    history,
    updatedAt: nowTime()
  });

  alert("已拒絕申請");
  renderCarDetail();
}

async function renderCarDetail() {
  const db = window.db;
  const carId = getCarId();
  const box = document.getElementById("detailBox");

  if (!box) return;

  if (!db) {
    box.innerHTML = `<div class="card"><h2>Firebase 尚未載入</h2></div>`;
    return;
  }

  try {
    const doc = await db.collection("cars").doc(carId).get();

    if (!doc.exists) {
      box.innerHTML = `<div class="card"><h2>找不到這台車</h2></div>`;
      return;
    }

    const car = { id: doc.id, ...doc.data() };
    const players = car.players || [];
    const applications = car.applications || [];
    const history = car.history || [];
    const status = getAutoStatus(car);

    box.innerHTML = `
      <div class="card">
        <h2>🎭 ${car.scriptName || "未命名劇本"}</h2>
        <p>📅 ${car.gameDate || "日期未定"} ${car.gameTime || ""}</p>
        <p>📍 ${car.locationName || car.location || "地點未填"}</p>
        <p>🏠 ${car.organizerName || car.studioName || "開團單位未填"}</p>
        <p>🎲 DM：${car.dmName || "未填"}</p>
        <p>💰 車資：${car.price || "未填"}</p>
        <p>📌 狀態：${status}</p>
        <p>📝 備註：${car.note || "無"}</p>

        ${
          car.status === "已取消"
            ? `<p>🚫 取消原因：${car.cancelReason || "未填寫"}</p>`
            : ""
        }

        <hr>

        <p>👦 男位：${car.maleSlots || 0}</p>
        <p>👧 女位：${car.femaleSlots || 0}</p>
        <p>👥 已加入：${players.length} 人</p>
        <span class="badge">${getNeed(car) > 0 ? "還缺 " + getNeed(car) + " 人" : "🎉 已滿"}</span>
      </div>

      <button onclick="copyJoinUrl('${car.id}')">📋 複製報名網址</button>
      <button onclick="location.href='join.html?id=${car.id}'">🔗 開啟玩家報名頁</button>
      <button onclick="location.href='editcar.html?id=${car.id}'">✏️ 編輯車團</button>

      <button onclick="finishCar()">✅ 標記已結束</button>
      <button class="gray" onclick="cancelCar()">❌ 取消車團</button>

      <button class="gray" onclick="location.href='mycar.html'">← 返回我的車</button>

      <div class="card">
        <h3>🔔 待確認申請</h3>
        ${
          applications.length === 0
            ? "<p>目前沒有申請</p>"
            : applications.map((app, index) => `
              <div class="card">
                <p>👤 玩家填寫：${app.name || app.playerName || "未命名"}</p>
                <p>🎭 ${app.role || app.position || "不限"}</p>
                <p>${app.isCrossPlay ? "✅ 反串" : "未勾反串"}</p>

                <button onclick="approveApplication(${index})">✅ 核准</button>
                <button class="gray" onclick="rejectApplication(${index})">❌ 拒絕</button>
              </div>
            `).join("")
        }
      </div>

      <div class="card">
        <h3>👥 已加入玩家</h3>
        ${
          players.length === 0
            ? "<p>目前尚無玩家</p>"
            : players.map(player => `
              <div class="card">
                <p>👤 ${player.hostAlias || player.name || player.playerName || "未命名玩家"}</p>
                <p>玩家填寫：${player.playerName || player.name || "未填"}</p>
                <p>位置：${player.position || player.roleChoice || "不限"}${player.isCrossPlay ? "｜反串" : ""}</p>
                ${player.hostNote ? <p>📝 主揪備註：${player.hostNote}</p> : ""}
              </div>
            `).join("")
        }
      </div>

      <div class="card">
        <h3>📜 紀錄時間軸</h3>
        ${
          history.length === 0
            ? "<p>目前沒有紀錄</p>"
            : history.slice().reverse().map(item => `
              <p><strong>${item.type}</strong></p>
              <p>${item.text}</p>
              <small>${item.time || ""}</small>
              <hr>
            `).join("")
        }
      </div>
    `;
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="card"><h2>讀取失敗</h2><p>${error.message}</p></div>`;
  }
}

window.copyJoinUrl = copyJoinUrl;
window.approveApplication = approveApplication;
window.rejectApplication = rejectApplication;
window.finishCar = finishCar;
window.cancelCar = cancelCar;

document.addEventListener("DOMContentLoaded", renderCarDetail);