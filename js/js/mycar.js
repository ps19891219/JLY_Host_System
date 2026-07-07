function getFilter() {
  const params = new URLSearchParams(location.search);
  return params.get("filter") || "all";
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
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

async function renderMyCars() {
  const list = document.getElementById("carList");
  const searchInput = document.getElementById("searchInput");

  if (!list) return;

  list.innerHTML = `<div class="card">載入中...</div>`;

  try {
    const snapshot = await db.collection("cars")
      .orderBy("createdAt", "desc")
      .get();

    let cars = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const filter = getFilter();
    const keyword = (searchInput?.value || "").trim().toLowerCase();

    if (filter === "need") {
      cars = cars.filter(car => getNeed(car) > 0);
    }

    if (filter === "full") {
      cars = cars.filter(car => getAutoStatus(car) === "已滿車");
    }

    if (filter === "today") {
      cars = cars.filter(car => car.gameDate === todayString());
    }

    if (keyword) {
      cars = cars.filter(car => {
        const text = `
          ${car.scriptName || ""}
          ${car.gameDate || ""}
          ${car.gameTime || ""}
          ${car.studioName || ""}
          ${car.dmName || ""}
          ${getAutoStatus(car)}
        `.toLowerCase();

        return text.includes(keyword);
      });
    }

    if (cars.length === 0) {
      list.innerHTML = `
        <div class="card">
          <h3>目前沒有車</h3>
        </div>
      `;
      return;
    }

    list.innerHTML = cars.map(car => {
      const players = car.players || [];
      const status = getAutoStatus(car);
      const need = getNeed(car);

      return `
        <div class="card" onclick="location.href='car-detail.html?id=${car.id}'">
          <h3>🎭 ${car.scriptName || "未命名劇本"}</h3>
          <p>📅 ${car.gameDate || ""} ${car.gameTime || ""}</p>
          <p>🏠 ${car.studioName || "未填工作室"}</p>
          <p>🎲 DM：${car.dmName || "未填DM"}</p>
          <p>💰 車資：${car.price || 0}</p>
          <p>👥 ${players.length} / ${car.totalPeople || 0}</p>
          <p>📌 狀態：${status}</p>
          <span class="badge">
            ${need > 0 ? "還缺 " + need + " 人" : "🎉 已滿車"}
          </span>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error(error);
    list.innerHTML = `
      <div class="card">
        <h3>讀取失敗</h3>
        <p>Firebase 資料讀取錯誤</p>
      </div>
    `;
  }
}

window.renderMyCars = renderMyCars;