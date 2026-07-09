console.log("editcar.js 已成功載入！");

function getCarId() {
  return new URLSearchParams(location.search).get("id");
}

async function loadEditCar() {
  const db = window.db;
  const carId = getCarId();
  const box = document.getElementById("editBox");

  if (!box) return;

  if (!db) {
    box.innerHTML = "<h3>Firebase 尚未載入</h3>";
    return;
  }

  if (!carId) {
    box.innerHTML = "<h3>找不到車團 ID</h3>";
    return;
  }

  try {
    const doc = await db.collection("cars").doc(carId).get();

    if (!doc.exists) {
      box.innerHTML = "<h3>找不到這台車</h3>";
      return;
    }

    const car = doc.data();

    box.innerHTML = `
      <label>劇本名稱</label>
      <input id="scriptName" value="${car.scriptName || ""}">

      <label>日期</label>
      <input id="gameDate" type="date" value="${car.gameDate || ""}">

      <label>時間</label>
      <input id="gameTime" type="time" value="${car.gameTime || ""}">

      <label>地點</label>
      <input id="locationName" value="${car.locationName || car.location || car.studioName || ""}">

      <label>工作室</label>
      <input id="studioName" value="${car.studioName || ""}">

      <label>DM</label>
      <input id="dmName" value="${car.dmName || ""}">

      <label>車資</label>
      <input id="price" type="number" value="${car.price || ""}">

      <label>總人數</label>
      <input id="totalPeople" type="number" value="${car.totalPeople || 0}">

      <button type="button" onclick="saveEditCar()">
        💾 儲存修改
      </button>
    `;
  } catch (error) {
    console.error(error);
    box.innerHTML = "<h3>讀取失敗</h3>";
  }
}

async function saveEditCar() {
  const db = window.db;
  const carId = getCarId();

  if (!db || !carId) {
    alert("資料尚未載入");
    return;
  }

  const scriptName = document.getElementById("scriptName").value.trim();
  const gameDate = document.getElementById("gameDate").value;
  const gameTime = document.getElementById("gameTime").value;
  const locationName = document.getElementById("locationName").value.trim();

  if (!scriptName) {
    alert("請輸入劇本名稱");
    return;
  }

  if (!gameDate) {
    alert("請選擇日期");
    return;
  }

  if (!gameTime) {
    alert("請選擇時間");
    return;
  }

  if (!locationName) {
    alert("請輸入地點");
    return;
  }

  const priceInput = document.getElementById("price").value;

  const updatedCar = {
    scriptName,
    gameDate,
    gameTime,
    locationName,
    studioName: document.getElementById("studioName").value.trim(),
    dmName: document.getElementById("dmName").value.trim(),
    price: priceInput === "" ? null : Number(priceInput),
    totalPeople: Number(document.getElementById("totalPeople").value || 0),
    updatedAt: new Date().toISOString()
  };

  try {
    await db.collection("cars").doc(carId).update(updatedCar);
    alert("修改成功！");
    location.href = "car-detail.html?id=" + carId;
  } catch (error) {
    console.error(error);
    alert("修改失敗：" + error.message);
  }
}

window.saveEditCar = saveEditCar;

document.addEventListener("DOMContentLoaded", loadEditCar);