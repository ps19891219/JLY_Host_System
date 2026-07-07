// ===============================
// JLY Host Assistant
// cars.js
// 車輛共用邏輯
// ===============================

function getAutoStatus(car) {
    if (car.manualStatus === "已完成") return "已完成";
    if (car.manualStatus === "已取消") return "已取消";

    const total = Number(car.totalPeople || 0);
    const players = car.players || [];

    return players.length >= total ? "已滿車" : "招募中";
}

function getNeed(car) {
    const total = Number(car.totalPeople || 0);
    const players = car.players || [];

    return Math.max(total - players.length, 0);
}

function getPositionCount(players, position) {
    return players.filter(player => player.position === position).length;
}

function createCar(data) {
    const cars = getCars();

    const male = Number(data.maleSlots || 0);
    const female = Number(data.femaleSlots || 0);

    const car = {
        id: createId(),
        scriptName: data.scriptName,
        gameDate: data.gameDate,
        gameTime: data.gameTime,
        studioName: data.studioName,
        dmName: data.dmName,
        price: Number(data.price || 0),
        maleSlots: male,
        femaleSlots: female,
        totalPeople: male + female,
        note: data.note || "",
        manualStatus: "",
        players: [],
        applications: [],
        history: [
            {
                time: new Date().toLocaleString("zh-TW"),
                type: "建立",
                text: `建立車：${data.scriptName}`
            }
        ]
    };

    cars.push(car);
    saveCars(cars);

    saveHistoryData(data);

    return car;
}

function saveHistoryData(data) {
    saveNameToList("scripts", data.scriptName);
    saveNameToList("studios", data.studioName);
    saveNameToList("dms", data.dmName);
}

function saveNameToList(type, name) {
    if (!name) return;

    let list = [];

    if (type === "scripts") list = getScripts();
    if (type === "studios") list = getStudios();
    if (type === "dms") list = getDms();

    const exists = list.some(item => item.name === name);

    if (!exists) {
        list.push({
            id: createId(),
            name: name,
            createdAt: new Date().toLocaleString("zh-TW")
        });
    }

    if (type === "scripts") saveScripts(list);
    if (type === "studios") saveStudios(list);
    if (type === "dms") saveDms(list);
}

function findCarById(carId) {
    const cars = getCars();
    return cars.find(car => String(car.id) === String(carId));
}

function updateCar(updatedCar) {
    const cars = getCars();

    const newCars = cars.map(car => {
        if (String(car.id) === String(updatedCar.id)) {
            return updatedCar;
        }
        return car;
    });

    saveCars(newCars);
}