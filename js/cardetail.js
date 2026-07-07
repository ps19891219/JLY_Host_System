function getCarId() {
    const params = new URLSearchParams(location.search);
    return params.get("id");
}

function getPositionCount(players, position) {
    return players.filter(player => player.position === position).length;
}

function renderCarDetail() {
    const carId = getCarId();
    const cars = getCars();
    const car = cars.find(c => String(c.id) === String(carId));

    const box = document.getElementById("detailBox");

    if (!box) return;

    if (!car) {
        box.innerHTML = `
            <div class="card">
                <h2>找不到這台車</h2>
                <p>可能已被刪除。</p>
            </div>
        `;
        return;
    }

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
            <h2>🎭 ${car.scriptName}</h2>
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

            <span class="badge">
                ${need > 0 ? "還缺 " + need + " 人" : "🎉 已滿車"}
            </span>
        </div>

        <button onclick="copyJoinUrl('${car.id}')">
            📋 複製報名網址
        </button>

        <button onclick="location.href='join.html?id=${car.id}'">
            🔗 開啟玩家報名頁
        </button>

        <div class="card">
            <h3>🔔 待確認申請</h3>

            ${
                applications.length === 0
                ? "<p>目前沒有申請</p>"
                : applications.map(app => `
                    <div class="card">
                        <p>👤 ${app.name}</p>
                        <p>🎭 ${app.position}</p>
                        <div class="row">
                            <button onclick="acceptPlayer('${car.id}', '${app.id}')">
                                接受
                            </button>
                            <button class="danger" onclick="rejectPlayer('${car.id}', '${app.id}')">
                                拒絕
                            </button>
                        </div>
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
                    <p>👤 ${player.name}｜${player.position}</p>
                `).join("")
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
}

function getJoinUrl(carId) {
    return `${location.origin}${location.pathname.replace("car-detail.html", "join.html")}?id=${carId}`;
}

function copyJoinUrl(carId) {
    navigator.clipboard.writeText(getJoinUrl(carId));
    alert("✅ 已複製玩家報名網址");
}   