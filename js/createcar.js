console.log("createcar.js 已成功載入！");

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("createCarForm");

  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const isHost = document.getElementById("isHost").checked;

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

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
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
      await window.saveCarToFirebase(car);
      alert("車團建立成功！");
      location.href = "mycar.html";
    } catch (error) {
      console.error(error);
      alert("建立失敗，請查看 Console 錯誤");
    }
  });
});