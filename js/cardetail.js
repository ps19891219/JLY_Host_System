function getCarId() {
  const params = new URLSearchParams(location.search);
  return params.get("id");
}

function getPositionCount(players, position) {
  return players.filter(player => player.position === position).length;
}

function getNeed(car) {
  const players = car.players || [];
  const total = Number(car.totalPeople || 0);
  return Math.max(total - players.length, 0);
}

function getAutoStatus(car) {
  if (car.status === "已完成") return "已完成";
  if (car.status === "已取消") return "已取消";

  const players = car.players || [];
  const total = Number(car.totalPeople || 0);

  if (total > 0 && players.length >= total) return "已滿車";
  return "招募中";
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
      box.innerHTML = `
        <div class="card">
          <h2>找不到這台車</h2>
          <p>可能已被刪除。</p>
        </div>
      `;
      return;
    }

    const car = {
      id: doc.id,
      ...doc.data()
    };

    const players = car.players || [];
    const applications = car.applications || [];
    const history = car.history || [];

    const maleCount = getPositionCount(players, "男位");
    const femaleCount = getPositionCount(players, "女位");
    const anyCount = getPositionCount(players, "不限");

    const maleSlots = Number(car.maleSlots || 0);
    const femaleSlots = Number(car.femaleSlots || 0);

    const total = Number(car.totalPeople || 0);
    const need = getNeed(car);
    const status = getAutoStatus(car);

    box.innerHTML = `
      <div class="card">
        <h2>🎭 ${car.scriptName || "未命名劇本"}</h2>
        <p>${car.isHost ? "👑 我主揪" : "🙋 我參加／紀錄"}</p>
        <p>📅 ${car.gameDate || ""} ${car.gameTime || ""}</p>
        <p>🏠 ${car.studioName || "未填工作室"}</p>
        <p>🎲 DM：${car.dmName || "未填DM"}</p>
        <p>💰 車資：${car.price || 0}</p>
        <p>📌 狀態：${status}</p>
        <p>📝 備註：${car.note || "無"}</p>

        <hr>

        <p>👦 男位：${maleCount} / ${maleSlots}</p>
        <p>👧 女位：${femaleCount} / ${femaleSlots}</p>
        <p>👤 不限：${anyCount}</p>
        <p>👥 總計：${players.length} / ${total}</p>

        <span class="badge">${need > 0 ? "還缺 " + need + " 人" : "🎉 已滿車"}</span>
      </div>

      <button onclick="copyJoinUrl('${car.id}')">📋 複製報名網址</button>

      <button onclick="location.href='join.html?id=${car.id}'">🔗 開啟玩家報名頁</button>

      <button class="gray" onclick="location.href='mycar.html'">← 返回我的車</button>

      <div class="card">
        <h3>🔔 待確認申請</h3>
        ${
          applications.length === 0
            ? "<p>目前沒有申請</p>"
            : applications.map(app => `
              <div class="card">
                <p>👤 ${app.name}</p>
                <p>🎭 ${app.position}</p>
              </div>
            `).join("")
        }
      </div>

      <div class="card">
        <h3>👥 已加入玩家</h3>
        ${
          players.length === 0
            ? "<p>目前尚無玩家</p>"
            : players.map(player => `<p>👤 ${player.name}｜${player.position}</p>`).join("")
        }
      </div>

      <div class="card">
        <h3>📜 紀錄時間軸</h3>
        ${
          history.length === 0
            ? "<p>目前沒有紀錄</p>"
            : history.map(item => `
              <p>${item.time}</p>
              <p>${item.type}｜${item.text}</p>
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

function getJoinUrl(carId) {
  return `${location.origin}${location.pathname.replace("car-detail.html", "join.html")}?id=${carId}`;
}

function copyJoinUrl(carId) {
  navigator.clipboard.writeText(getJoinUrl(carId));
  alert("✅ 已複製玩家報名網址");
}

document.addEventListener("DOMContentLoaded", renderCarDetail);