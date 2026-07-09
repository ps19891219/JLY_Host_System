console.log("createcar.js 已成功載入！");

function nowTime() {
  return new Date().toISOString();
}

function getRadioValue(name, defaultValue) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : defaultValue;
}

function getPeopleMode() {
  return getRadioValue("peopleMode", "gender");
}

function togglePeopleMode() {
  const mode = getPeopleMode();

  document.getElementById("genderBox").style.display =
    mode === "gender" ? "block" : "none";

  document.getElementById("totalBox").style.display =
    mode === "total" ? "block" : "none";
}

async function findSameDayCars(gameDate) {
  const db = window.db;

  const snapshot = await db
    .collection("cars")
    .where("gameDate", "==", gameDate)
    .get();

  return snapshot.docs.map(function (doc) {
    return {
      id: doc.id,
      ...doc.data()
    };
  });
}

function buildConflictMessage(cars) {
  let text = "⚠️ 這一天你已經有車了：\n\n";

  cars.forEach(function (car) {
    text += `🎭 ${car.scriptName || "未命名劇本"}｜${car.gameTime || "時間未填"}\n`;
  });

  text += "\n是否仍要建立新的車？";

  return text;
}

async function createCar() {
  const db = window.db;
  if (!db) return alert("Firebase 尚未載入，請重新整理");

  const scriptName = document.getElementById("scriptName").value.trim();
  const gameDate = document.getElementById("gameDate").value;
  const gameTime = document.getElementById("gameTime").value;
  const locationName = document.getElementById("locationName").value.trim();
  const organizerName = document.getElementById("organizerName").value.trim();
  const dmName = document.getElementById("dmName").value.trim();
  const priceInput = document.getElementById("price").value;
  const note = document.getElementById("note").value.trim();

  if (!scriptName) return alert("請輸入劇本名稱");
  if (!gameDate) return alert("請選擇日期");
  if (!gameTime) return alert("請選擇時間");
  if (!locationName) return alert("請輸入地點");

  const sameDayCars = await findSameDayCars(gameDate);

  let conflictStatus = "none";
  let conflictWithCarIds = [];

  if (sameDayCars.length > 0) {
    const keepGoing = confirm(buildConflictMessage(sameDayCars));
    if (!keepGoing) return;

    conflictStatus = "pending";
    conflictWithCarIds = sameDayCars.map(function (car) {
      return car.id;
    });
  }

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

  const myRole = getRadioValue("myRole", "host");
  const guestListVisibility = getRadioValue("guestListVisibility", "approved_only");
  const visibility = getRadioValue("visibility", "private");

  const now = nowTime();

  const car = {
    scriptName,
    gameDate,
    gameTime,
    locationName,
    organizerName,
    studioName: organizerName,
    dmName,
    price: priceInput === "" ? null : Number(priceInput),
    note,

    peopleMode,
    maleSlots,
    femaleSlots,
    totalPeople,

    myRole,
    isHost: myRole === "host",
    isPlayer: myRole === "player",
    isFavoriteCar: myRole === "favorite",

    visibility,
    guestListVisibility,

    players: [],
    applications: [],
    history: [
      {
        type: "建立車團",
        text: "車團已建立",
        time: now
      }
    ],

    conflictStatus,
    conflictWithCarIds,
    conflictNote: "",

    calendarStatus: "not_added",
    calendarEventId: null,

    status: "招募中",
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