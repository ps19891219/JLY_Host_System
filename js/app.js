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

  if (getTotal(car) > 0 && getPlayers(car).length >= getTotal(car)) {
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

    const need = active.filter(car => getNeed(car) > 0);
    const full = active.filter(car => getAutoStatus(car) === "已滿車");
    const today = active.filter(car => car.gameDate === todayString());

    const activeCount = document.getElementById("activeCount");
    const needCount = document.getElementById("needCount");
    const fullCount = document.getElementById("fullCount");
    const todayCount = document.getElementById("todayCount");

    if (activeCount) activeCount.innerText = active.length;
    if (needCount) needCount.innerText = need.length;
    if (fullCount) fullCount.innerText = full.length;
    if (todayCount) todayCount.innerText = today.length;

  } catch (error) {
    console.error("首頁統計讀取失敗：", error);
  }
}

document.addEventListener("DOMContentLoaded", renderDashboard);