console.log("mycar.js 已成功載入！");

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

function getRoleText(car) {
  if (car.isHost === true || car.role === "host") {
    return "👑 我主揪";
  }
  return "🙋 我參加／紀錄";
}

async function deleteCar(carId) {
  if (!confirm("確定要刪除這台車嗎？")) return;

  try {
    await window.db.collection("cars").doc(carId).delete();
    alert("已刪除");
    renderMyCars();
  } catch (error) {
    console.error("刪除失敗：", error);
    alert("刪除失敗：" + error.message);
  }
}

async function renderMyCars() {
  const db = window.db;
  const list = document.getElementById("carList");
  const searchInput = document.getElementById("searchInput");

  if (!list) return;

  if (!db) {
    list.innerHTML = `
      <div class="card">
        <h3>讀取失敗</h3>
        <p>Firebase 尚未載入</p>
      </div>
    `;
    return;
  }

  list.innerHTML = `<div class="card">載入中...</div>`;

  try {
    const snapshot = await db
      .collection("cars")
      .orderBy("createdAt", "desc")
      .get();

    let cars = snapshot.docs.map(function (doc) {
      return {
        id: doc.id,
        ...doc.data()
      };
    });

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
      cars = cars.filter(function (car) {
        const text = [
          car.scriptName || "",
          car.gameDate || "",
          car.gameTime || "",
          car.studioName || "",
          car.dmName || "",
          getAutoStatus(car),
          getRoleText(car)
        ].join(" ").toLowerCase();

        return text.includes(keyword);
      });
    }

    if (cars.length === 0) {
      list.innerHTML = `<div class="card"><h3>目前沒有車</h3></div>`;
      return;
    }

    list.innerHTML = cars.map(function (car) {
      const players = car.players || [];
      const status = getAutoStatus(car);
      const need = getNeed(car);
      const badgeText = need > 0 ? "還缺 " + need + " 人" : "🎉 已滿車";
      const roleText = getRoleText(car);

      return `
        <div class="card" onclick="location.href='car-detail.html?id=${car.id}'">
          <h3>🎭 ${car.scriptName || "未命名劇本"}</h3>
          <p>${roleText}</p>
          <p>📅 ${car.gameDate || ""} ${car.gameTime || ""}</p>
          <p>🏠 ${car.studioName || "未填工作室"}</p>
          <p>🎲 DM：${car.dmName || "未填DM"}</p>
          <p>💰 車資：${car.price || 0}</p>
          <p>👥 ${players.length} / ${car.totalPeople || 0}</p>
          <p>📌 狀態：${status}</p>
          <span class="badge">${badgeText}</span>

          <div style="margin-top: 10px;">
            <button type="button" class="gray" onclick="event.stopPropagation(); deleteCar('${car.id}')">
              🗑️ 刪除
            </button>
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("讀取失敗：", error);
    list.innerHTML = `
      <div class="card">
        <h3>讀取失敗</h3>
        <p>Firebase 資料讀取錯誤</p>
      </div>
    `;
  }
}

window.renderMyCars = renderMyCars;
window.deleteCar = deleteCar;

document.addEventListener("DOMContentLoaded", function () {
  renderMyCars();

  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.addEventListener("input", renderMyCars);
  }
});