let cars = JSON.parse(localStorage.getItem("cars")) || [];

function saveCars() {
  localStorage.setItem("cars", JSON.stringify(cars));
}

function getId() {
  return new URLSearchParams(location.search).get("id");
}

function getFilter() {
  return new URLSearchParams(location.search).get("filter") || "all";
}

function findCar(id) {
  return cars.find(c => String(c.id) === String(id));
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function getPlayers(car) {
  return car.players || [];
}

function getTotal(car) {
  return Number(car.totalPeople || car.people || 0);
}

function getNeed(car) {
  return getTotal(car) - getPlayers(car).length;
}

function getAutoStatus(car) {
  if (car.manualStatus === "已完成") return "已完成";
  if (car.manualStatus === "已取消") return "已取消";
  return getNeed(car) <= 0 ? "已滿車" : "招募中";
}

function addHistory(car, type, text) {
  car.history = car.history || [];
  car.history.push({
    time: new Date().toLocaleString("zh-TW"),
    type,
    text
  });
}

function saveCar() {
  const male = Number(maleSlots.value || 0);
const female = Number(femaleSlots.value || 0);

const car = {
  id: Date.now(),
  scriptName: scriptName.value.trim(),
  gameDate: gameDate.value,
  gameTime: gameTime.value,
  studioName: studioName.value.trim(),
  dmName: dmName.value.trim(),
  price: Number(price.value || 0),
  maleSlots: male,
  femaleSlots: female,
  totalPeople: male + female,
  note: note.value.trim(),
  manualStatus: "",
  players: [],
  applications: [],
  history: []
};

function renderDashboard() {
  const active = cars.filter(c => getAutoStatus(c) !== "已完成" && getAutoStatus(c) !== "已取消");
  const need = active.filter(c => getNeed(c) > 0);
  const full = active.filter(c => getNeed(c) <= 0);
  const today = active.filter(c => c.gameDate === todayString());
  const done = cars.filter(c => getAutoStatus(c) === "已完成");

  activeCount.innerText = active.length;
  needCount.innerText = need.length;
  fullCount.innerText = full.length;
  todayCount.innerText = today.length;
  doneCount.innerText = done.length;
}

function renderMyCars() {
  const list = document.getElementById("carList");
  if (!list) return;

  const filter = getFilter();
  const searchText = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";

  let showCars = [...cars];

  if (filter === "active") {
    showCars = showCars.filter(c => getAutoStatus(c) !== "已完成" && getAutoStatus(c) !== "已取消");
  }

  if (filter === "need") {
    showCars = showCars.filter(c => getAutoStatus(c) !== "已完成" && getAutoStatus(c) !== "已取消" && getNeed(c) > 0);
  }

  if (filter === "full") {
    showCars = showCars.filter(c => getAutoStatus(c) === "已滿車");
  }

  if (filter === "today") {
    showCars = showCars.filter(c => c.gameDate === todayString());
  }

  if (filter === "done") {
    showCars = showCars.filter(c => getAutoStatus(c) === "已完成");
  }

  if (searchText) {
    showCars = showCars.filter(car => {
      const text = `
        ${car.scriptName || ""}
        ${car.gameDate || ""}
        ${car.gameTime || ""}
        ${car.studioName || ""}
        ${car.dmName || ""}
        ${getAutoStatus(car)}
      `.toLowerCase();

      return text.includes(searchText);
    });
  }

  if (showCars.length === 0) {
    list.innerHTML = `<div class="card"><h3>目前沒有符合的車</h3></div>`;
    return;
  }

  list.innerHTML = showCars.map(car => {
    const need = getNeed(car);
    const status = getAutoStatus(car);

    return `
      <div class="card" onclick="location.href='car-detail.html?id=${car.id}'">
        <h3>🎭 ${car.scriptName}</h3>
        <p>📅 ${car.gameDate || ""} ${car.gameTime || ""}</p>
        <p>🏠 ${car.studioName || "未填工作室"}</p>
        <p>🎲 DM：${car.dmName || "未填"}</p>
        <p>👥 ${getPlayers(car).length} / ${getTotal(car)}</p>
        <p>狀態：${status}</p>
        <span class="badge">${need > 0 ? "還缺 " + need + " 人" : "已滿車"}</span>
      </div>
    `;
  }).join("");
}

function getJoinUrl(carId) {
  return `${location.origin}${location.pathname.replace("car-detail.html", "join.html")}?id=${carId}`;
}

function copyJoinUrl(carId) {
  const url = getJoinUrl(carId);
  navigator.clipboard.writeText(url);
  alert("已複製報名網址！");
}

function renderCarDetail() {
  const id = getId();
  const car = findCar(id);
  const box = document.getElementById("detailBox");

  if (!box) return;

  if (!car) {
    box.innerHTML = `<div class="card"><h3>找不到這台車</h3></div>`;
    return;
  }

  car.players = car.players || [];
  car.applications = car.applications || [];
  car.history = car.history || [];

  const need = getNeed(car);
  const status = getAutoStatus(car);
  const joinUrl = getJoinUrl(car.id);

  box.innerHTML = `
    <div class="card">
      <h2>🎭 ${car.scriptName}</h2>
      <p>📅 ${car.gameDate || ""} ${car.gameTime || ""}</p>
      <p>🏠 ${car.studioName || "未填工作室"}</p>
      <p>🎲 DM：${car.dmName || "未填"}</p>
      <p>👥 ${car.players.length} / ${getTotal(car)}</p>
      <p>狀態：${status}</p>
      <span class="badge">${need > 0 ? "還缺 " + need + " 人" : "已滿車"}</span>
    </div>

    <button onclick="copyJoinUrl('${car.id}')">
      📋 複製報名網址
    </button>

    <button onclick="location.href='join.html?id=${car.id}'">
      🔗 打開玩家報名頁
    </button>

    <div class="card">
      <h3>🔒 群組公告用連結</h3>
      <p style="word-break:break-all;">${joinUrl}</p>
    </div>

    <div class="card">
      <h3>👥 已加入玩家</h3>
      ${car.players.length === 0 ? "<p>目前沒有玩家</p>" : car.players.map(p => `<p>${p.name}｜${p.position}</p>`).join("")}
    </div>

    <div class="card">
      <h3>🔔 待確認申請</h3>
      ${car.applications.length === 0 ? "<p>目前沒有申請</p>" : car.applications.map((a, i) => `
        <p>${a.name}｜${a.position}</p>
        <div class="row">
          <button onclick="acceptPlayer('${car.id}', ${i})">接受</button>
          <button class="danger" onclick="rejectPlayer('${car.id}', ${i})">拒絕</button>
        </div>
      `).join("")}
    </div>

    <div class="card">
      <h3>📜 紀錄時間軸</h3>
      ${car.history.length === 0 ? "<p>目前沒有紀錄</p>" : car.history.map(h => `
        <p>${h.time}</p>
        <p>${h.type}｜${h.text}</p>
        <hr>
      `).join("")}
    </div>

    <button onclick="completeCar('${car.id}')">
      ✅ 標記完成
    </button>

    <button class="danger" onclick="cancelCar('${car.id}')">
      ❌ 取消這台車
    </button>

    <button class="danger" onclick="deleteCar('${car.id}')">
      🗑 刪除這台車
    </button>
  `;
}

function renderJoinPage() {
  const id = getId();
  const car = findCar(id);
  const box = document.getElementById("joinInfo");

  if (!box) return;

  if (!car) {
    box.innerHTML = `<div class="card"><h3>找不到這台車</h3></div>`;
    return;
  }

  const need = getNeed(car);
  const status = getAutoStatus(car);

  box.innerHTML = `
    <div class="card">
      <h2>🎭 ${car.scriptName}</h2>
      <p>📅 ${car.gameDate || ""} ${car.gameTime || ""}</p>
      <p>🏠 ${car.studioName || "未填工作室"}</p>
      <p>🎲 DM：${car.dmName || "未填"}</p>
      <p>👥 ${getPlayers(car).length} / ${getTotal(car)}</p>
      <p>狀態：${status}</p>
      <span class="badge">${need > 0 ? "還缺 " + need + " 人" : "已滿車"}</span>
    </div>
  `;
}

function sendApplication() {
  const id = getId();
  const car = findCar(id);

  if (!car) {
    alert("找不到這台車");
    return;
  }

  const name = playerName.value.trim();
  const position = playerPosition.value;

  if (!name) {
    alert("請填暱稱");
    return;
  }

  car.applications = car.applications || [];

  car.applications.push({
    name,
    position,
    applyTime: new Date().toLocaleString("zh-TW")
  });

  addHistory(car, "申請", `${name} 申請加入`);
  saveCars();

  alert("已送出申請，等待主揪確認！");
  location.href = `car-detail.html?id=${car.id}`;
}

function acceptPlayer(carId, index) {
  const car = findCar(carId);
  const app = car.applications[index];

  car.players = car.players || [];
  car.players.push(app);
  car.applications.splice(index, 1);

  addHistory(car, "玩家加入", `${app.name} 加入車輛`);
  saveCars();
  renderCarDetail();
}

function rejectPlayer(carId, index) {
  const car = findCar(carId);
  const app = car.applications[index];

  car.applications.splice(index, 1);

  addHistory(car, "拒絕申請", `${app.name} 被拒絕`);
  saveCars();
  renderCarDetail();
}

function completeCar(id) {
  const car = findCar(id);
  if (!car) return;

  if (!confirm("確定標記為已完成嗎？")) return;

  car.manualStatus = "已完成";
  addHistory(car, "完成", "這台車已完成");
  saveCars();
  renderCarDetail();
}

function cancelCar(id) {
  const car = findCar(id);
  if (!car) return;

  const reason = prompt("請輸入取消原因：") || "未填原因";

  car.manualStatus = "已取消";
  addHistory(car, "取消", `取消原因：${reason}`);
  saveCars();
  renderCarDetail();
}

function deleteCar(id) {
  if (!confirm("確定刪除這台車嗎？")) return;

  cars = cars.filter(c => String(c.id) !== String(id));
  saveCars();

  location.href = "mycar.html";
}