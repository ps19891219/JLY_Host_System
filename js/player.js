function saveApplication(carId, playerData) {
    const cars = getCars();
    const car = cars.find(car => String(car.id) === String(carId));

    if (!car) {
        alert("找不到這台車");
        return;
    }

    car.applications = car.applications || [];
    car.history = car.history || [];

    car.applications.push({
        id: createId(),
        name: playerData.name,
        position: playerData.position,
        createdAt: new Date().toLocaleString("zh-TW")
    });

    car.history.push({
        time: new Date().toLocaleString("zh-TW"),
        type: "申請",
        text: `${playerData.name} 申請加入`
    });

    saveCars(cars);
}

function submitApplication() {
    const carId = new URLSearchParams(location.search).get("id");

    const name = document.getElementById("playerName").value.trim();
    const position = document.getElementById("playerPosition").value;

    if (!name) {
        alert("請填寫玩家暱稱");
        return;
    }

    saveApplication(carId, { name, position });

    alert("已送出申請，等待主揪確認！");
    location.href = `car-detail.html?id=${carId}`;
}

function acceptPlayer(carId, appId) {
    const cars = getCars();
    const car = cars.find(car => String(car.id) === String(carId));

    if (!car) return;

    car.players = car.players || [];
    car.applications = car.applications || [];
    car.history = car.history || [];

    const app = car.applications.find(item => String(item.id) === String(appId));
    if (!app) return;

    car.players.push({
        id: createId(),
        name: app.name,
        position: app.position,
        joinedAt: new Date().toLocaleString("zh-TW")
    });

    addPlayerToDatabase({
        name: app.name,
        position: app.position
    });

    car.applications = car.applications.filter(item => String(item.id) !== String(appId));

    car.history.push({
        time: new Date().toLocaleString("zh-TW"),
        type: "玩家加入",
        text: `${app.name} 加入車輛`
    });

    saveCars(cars);
    renderCarDetail();
}

function rejectPlayer(carId, appId) {
    const cars = getCars();
    const car = cars.find(car => String(car.id) === String(carId));

    if (!car) return;

    car.applications = car.applications || [];
    car.history = car.history || [];

    const app = car.applications.find(item => String(item.id) === String(appId));

    car.applications = car.applications.filter(item => String(item.id) !== String(appId));

    if (app) {
        car.history.push({
            time: new Date().toLocaleString("zh-TW"),
            type: "拒絕申請",
            text: `${app.name} 被拒絕`
        });
    }

    saveCars(cars);
    renderCarDetail();
}