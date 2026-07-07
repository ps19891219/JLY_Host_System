// ===============================
// JLY Host Assistant
// dashboard.js
// 首頁主控台
// ===============================

function todayString() {
    return new Date().toISOString().slice(0, 10);
}

function renderDashboard() {
    const cars = getCars();

    const activeCars = cars.filter(car => {
        const status = getAutoStatus(car);
        return status !== "已完成" && status !== "已取消";
    });

    const needCars = activeCars.filter(car => getNeed(car) > 0);
    const fullCars = activeCars.filter(car => getNeed(car) <= 0);
    const todayCars = activeCars.filter(car => car.gameDate === todayString());

    document.getElementById("activeCount").innerText = activeCars.length;
    document.getElementById("needCount").innerText = needCars.length;
    document.getElementById("fullCount").innerText = fullCars.length;
    document.getElementById("todayCount").innerText = todayCars.length;
}