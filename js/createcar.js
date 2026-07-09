console.log("createcar.js 已成功載入！");

function getPeopleMode() {
  const checked = document.querySelector('input[name="peopleMode"]:checked');
  return checked ? checked.value : "gender";
}

function togglePeopleMode() {
  const mode = getPeopleMode();
  document.getElementById("genderBox").style.display = mode === "gender" ? "block" : "none";
  document.getElementById("totalBox").style.display = mode === "total" ? "block" : "none";
}

async function createCar() {
  const db = window.db;
  if (!db) return alert("Firebase 尚未載入，請重新整理");

  const scriptName = document.getElementById("scriptName").value.trim();
  const scriptImageUrl = document.getElementById("scriptImageUrl").value.trim();
  const gameDate = document.getElementById("gameDate").value;
  const gameTime = document.getElementById("gameTime").value;
  const locationName = document.getElementById("locationName").value.trim();
  const studioName = document.getElementById("studioName").value.trim();
  const dmName = document.getElementById("dmName").value.trim();
  const priceInput = document.getElementById("price").value;

  if (!scriptName) return alert("請輸入劇本名稱");
  if (!gameDate) return alert("請選擇日期");
  if (!gameTime) return alert("請選擇時間");
  if (!locationName) return alert("請輸入地點");

  const peopleMode = getPeopleMode();

  let maleSlots = 0;
  let femaleSlots = 0;
  let totalPeople = 0;

  if (peopleMode === "gender") {
    maleSlots = Number(document.getElementById("maleSlots").value || 0);
    femaleSlots = Number(document.getElementById("femaleSlots").value || 0);
    totalPeople = maleSlots + femaleSlots;
  } else {
    totalPeople = Number(document.getElementById("totalPeople").value || 0);
  }

  if (totalPeople <= 0) return alert("請設定人數");

  const isHost = document.getElementById("isHost").checked;
  const isPlayer = document.getElementById("isPlayer").checked;
  const now = new Date().toISOString();

  const car = {
    scriptName,
    scriptImageUrl,
    gameDate,
    gameTime,
    locationName,
    studioName,
    dmName,
    price: priceInput === "" ? null : Number(priceInput),

    peopleMode,
    maleSlots,
    femaleSlots,
    totalPeople,

    players: [],
    applications: [],
    history: [],

    status: "招募中",
    isHost,
    isPlayer,
    role: isHost ? "host" : "record",
    ownerType: isHost ? "self" : "other",

    createdAt: now,
    updatedAt: now
  };

  try {
    await db.collection("cars").add(car);
    alert("車團建立成功！");
    location.href = "mycar.html";
  } catch (error) {
    console.error("建立車團失敗：", error);
    alert("建立失敗：" + error.message);
  }
}

window.createCar = createCar;
window.togglePeopleMode = togglePeopleMode;

document.addEventListener("DOMContentLoaded", togglePeopleMode);