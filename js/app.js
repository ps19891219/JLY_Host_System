console.log("app.js 已成功載入！");

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

async function renderDashboard() {
  const db = window.db;

  if (!db) {
    console.error("Firebase 尚未載入");
    return;
  }

  try {
    const snapshot = await db.collection("cars").get();

    const cars = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const active = cars.filter(car => {
      const status = getAutoStatus(car);
      return status !== "已完成" && status !== "已取消";
    });

    const needCars = active.filter(car => getNeed(car) > 0);
    const fullCars = active.filter(car => getTotal(car) > 0 && getNeed(car) === 0);
    const todayCars = active.filter(car => car.gameDate === todayString());

    const activeCount = document.getElementById("activeCount");
    const needCount = document.getElementById("needCount");
    const fullCount = document.getElementById("fullCount");
    const todayCount = document.getElementById("todayCount");

    if (activeCount) activeCount.innerText = active.length;
    if (needCount) needCount.innerText = needCars.length;
    if (fullCount) fullCount.innerText = fullCars.length;
    if (todayCount) todayCount.innerText = todayCars.length;

    console.log("首頁統計", {
      全部: cars.length,
      開團中: active.length,
      還缺人: needCars.length,
      已滿車: fullCars.length,
      今天開團: todayCars.length
    });

  } catch (error) {
    console.error("首頁統計讀取失敗：", error);
  }
}

window.renderDashboard = renderDashboard;

document.addEventListener("DOMContentLoaded", renderDashboard);