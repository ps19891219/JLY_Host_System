console.log("mycar.js 已成功載入！");

function getFilter() {
  return new URLSearchParams(location.search).get("filter") || "all";
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function getPlayers(car) {
  return car.players || [];
}

function getTotal(car) {
  return Number(car.totalPeople || 0);
}

function getNeed(car) {
  return Math.max(getTotal(car) - getPlayers(car).length, 0);
}

function getAutoStatus(car) {
  if (car.status === "已完成") return "已完成";
  if (car.status === "已取消") return "已取消";

  const total = getTotal(car);
  const players = getPlayers(car);

  if (total > 0 && players.length >= total) {
    return "已滿車";
  }

  return "招募中";
}

function getRoleText(car) {
  const tags = [];

  if (car.isHost === true || car.role === "host" || car.ownerType === "self") {
    tags.push("👑 我主揪");
  }

  if (car.isPlayer === false) {
    tags.push("🚫 我不在車上");
  } else {
    tags.push("🙋 我參加");
  }

  return tags.join("　");
}

function getPriceText(car) {
  if (
    car.price === undefined ||
    car.price === null ||
    car.price === "" ||
    Number(car.price) <= 0
  ) {
    return "💰 未填寫 ⚠️";
  }

  return "💰 " + car.price + " 元";
}

function getLocationText(car) {
  return car.locationName || car.location || car.placeName || car.studioName || "";
}

function escapeText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}

async function deleteCar(carId, scriptName) {
  if (!confirm(`確定要刪除「${scriptName || "這台車"}」嗎？`)) return;

  try {
    await window.db.collection("cars").doc(carId).delete();
    alert("已刪除");
    renderMyCars();
  } catch (error) {
    console.error("刪除失敗：", error);
    alert("刪除失敗：" + error.message);
  }
}

function buildCarCard(car) {
  const players = getPlayers(car);
  const need = getNeed(car);
  const roleText = getRoleText(car);
  const priceText = getPriceText(car);
  const locationText = getLocationText(car);

  const badgeText = need > 0 ? "🟡 還缺 " + need + " 人" : "🎉 已滿車";
  const dmLine = car.dmName ? <p>🎲 DM：${car.dmName}</p> : "";
  const locationLine = locationText ? <p>📍 ${locationText}</p> : "";

  return `
    <div class="card" onclick="location.href='car-detail.html?id=${car.id}'">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <h3 style="margin:0;">🎭 ${car.scriptName || "未命名劇本"}</h3>

        <button
          type="button"
          title="刪除"
          onclick="event.stopPropagation(); deleteCar('${car.id}', '${escapeText(car.scriptName)}')"
          style="
            border:none;
            background:transparent;
            font-size:16px;
            padding:2px 4px;
            cursor:pointer;
            opacity:.65;
          "
        >
          🗑️
        </button>
      </div>

      <p>${roleText}</p>
      <p>📅 ${car.gameDate || ""} ${car.gameTime || ""}</p>
      <p>${priceText}</p>
      <p>👥 ${players.length} / ${getTotal(car)}</p>
      <span class="badge">${badgeText}</span>

      ${dmLine}
      ${locationLine}
    </div>
  `;
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
        const text = [
          car.scriptName || "",
          car.gameDate || "",
          car.gameTime || "",
          car.price || "",
          car.dmName || "",
          getLocationText(car),
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

    list.innerHTML = cars.map(buildCarCard).join("");

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