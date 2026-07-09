console.log("join.js 已成功載入！");

function getCarId() {
  const params = new URLSearchParams(location.search);
  return params.get("id");
}

function getNeed(car) {
  const players = car.players || [];
  const total = Number(car.totalPeople || 0);
  return Math.max(total - players.length, 0);
}

async function renderJoinPage() {
  const db = window.db;
  const carId = getCarId();
  const box = document.getElementById("joinInfo");

  if (!box) return;

  if (!db) {
    box.innerHTML = "<h3>Firebase 尚未載入</h3>";
    return;
  }

  if (!carId) {
    box.innerHTML = "<h3>找不到車團 ID</h3>";
    return;
  }

  try {
    const doc = await db.collection("cars").doc(carId).get();

    if (!doc.exists) {
      box.innerHTML = "<h3>找不到這台車</h3>";
      return;
    }

    const car = doc.data();
    const players = car.players || [];
    const need = getNeed(car);

    box.innerHTML = `
      <h2>🎭 ${car.scriptName || "未命名劇本"}</h2>
      <p>📅 ${car.gameDate || ""} ${car.gameTime || ""}</p>
      <p>📍 ${car.locationName || car.location || car.studioName || "未填地點"}</p>
      <p>💰 ${car.price ? car.price + " 元" : "未填寫 ⚠️"}</p>
      <p>👥 ${players.length} / ${car.totalPeople || 0}</p>
      <span class="badge">${need > 0 ? "還缺 " + need + " 人" : "🎉 已滿車"}</span>
    `;
  } catch (error) {
    console.error(error);
    box.innerHTML = "<h3>讀取失敗</h3>";
  }
}

async function sendApplication() {
  const db = window.db;
  const carId = getCarId();

  if (!db) {
    alert("Firebase 尚未載入，請重新整理");
    return;
  }

  const name = document.getElementById("playerName").value.trim();
  const position = document.getElementById("playerPosition").value;

  if (!name) {
    alert("請輸入暱稱");
    return;
  }

  const application = {
    id: Date.now().toString(),
    name,
    position,
    status: "待確認",
    applyTime: new Date().toISOString()
  };

  try {
    const ref = db.collection("cars").doc(carId);
    const doc = await ref.get();

    if (!doc.exists) {
      alert("找不到這台車");
      return;
    }

    const car = doc.data();
    const applications = car.applications || [];

    applications.push(application);

    await ref.update({
      applications,
      updatedAt: new Date().toISOString()
    });

    alert("報名已送出，等待主揪確認！");
    location.href = "car-detail.html?id=" + carId;

  } catch (error) {
    console.error(error);
    alert("報名失敗：" + error.message);
  }
}

window.sendApplication = sendApplication;

document.addEventListener("DOMContentLoaded", renderJoinPage);