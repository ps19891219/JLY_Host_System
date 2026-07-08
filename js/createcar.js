console.log("createcar.js 已成功載入！");

async function createCar() {
  const db = window.db;

  if (!db) {
    alert("Firebase 尚未載入，請重新整理");
    return;
  }

  const isHost = document.getElementById("isHost").checked;
  const now = new Date().toISOString();

  const car = {
    scriptName: document.getElementById("scriptName").value.trim(),
    gameDate: document.getElementById("gameDate").value,
    gameTime: document.getElementById("gameTime").value,
    studioName: document.getElementById("studioName").value.trim(),
    dmName: document.getElementById("dmName").value.trim(),
    totalPeople: Number(document.getElementById("totalPeople").value || 0),
    maleSlots: Number(document.getElementById("maleSlots").value || 0),
    femaleSlots: Number(document.getElementById("femaleSlots").value || 0),
    price: Number(document.getElementById("price").value || 0),
    players: [],
    status: "招募中",
    isHost: isHost,
    role: isHost ? "host" : "record",
    ownerType: isHost ? "self" : "other",
    hostName: isHost ? "我" : "他人",
    createdAt: now,
    updatedAt: now
  };

  if (!car.scriptName) {
    alert("請輸入劇本名稱");
    return;
  }

  if (!car.gameDate) {
    alert("請選擇日期");
    return;
  }

  try {
    await db.collection("cars").add(car);
    alert("車團建立成功！");
    location.href = "mycar.html";
  } catch (error) {
    console.error(error);
    alert("建立失敗，請查看 Console 錯誤");
  }
}

window.createCar = createCar;