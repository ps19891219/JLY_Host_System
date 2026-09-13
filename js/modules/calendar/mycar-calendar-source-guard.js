(function () {
  "use strict";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function getActorId() {
    if (
      window.JLYIdentity &&
      typeof window.JLYIdentity.getCurrentPlayerId === "function"
    ) {
      return text(window.JLYIdentity.getCurrentPlayerId());
    }

    return text(localStorage.getItem("currentPlayerId"));
  }

  function isEditableCar(car, actorId) {
    const ownerId = text(car && car.ownerId);
    return Boolean(
      actorId &&
      (ownerId === actorId || (!ownerId && car && car.isHost === true))
    );
  }

  function carName(car) {
    return text(
      (car && (car.activityName || car.scriptName || car.title)) ||
      "未命名車團"
    );
  }

  async function readOfficialCars(ids) {
    if (!window.db) {
      throw new Error("Firebase 尚未載入");
    }

    const actorId = getActorId();
    if (!actorId) {
      throw new Error("請先登入 JLY 身分");
    }

    const official = [];

    for (const carId of ids) {
      const snapshot = await window.db
        .collection("cars")
        .doc(carId)
        .get();

      if (!snapshot.exists) {
        throw new Error(`找不到正式車團資料：${carId}`);
      }

      const car = snapshot.data() || {};

      if (!isEditableCar(car, actorId)) {
        throw new Error(`這台不是目前身分可修改的主揪車：${carId}`);
      }

      const gameDate = text(car.gameDate);
      const gameTime = text(car.gameTime);

      if (!gameDate || !gameTime) {
        throw new Error(
          `正式車團缺少日期或時間，禁止補登：${carName(car)}｜${carId}`
        );
      }

      official.push({
        carId,
        car,
        name: carName(car),
        gameDate,
        gameTime,
        durationMinutes: Number(
          (car.calendar && car.calendar.eventDurationMinutes) ||
          car.eventDurationMinutes ||
          60
        ) || 60
      });
    }

    return official;
  }

  function buildConfirmation(official) {
    const lines = [
      "請核對 JLY 正式車團資料：",
      "",
      "以下日期／時間只讀取 cars/{carId}，不使用 Google 同名事件或 Work Schedule 推測。",
      ""
    ];

    official.forEach(function (item) {
      lines.push(
        `🎭 ${item.name}`,
        `${item.gameDate} ${item.gameTime}｜${item.durationMinutes} 分鐘`,
        `Car ID：${item.carId}`,
        ""
      );
    });

    lines.push("確認以上資料正確後，才會開始 Google 補登。");
    return lines.join("\n");
  }

  function installGuard() {
    const button = document.getElementById("batchGoogleRepairButton");

    if (!button || button.dataset.jlySourceGuard === "1") {
      return;
    }

    const originalButton = button;
    const guardedButton = button.cloneNode(true);
    guardedButton.dataset.jlySourceGuard = "1";

    guardedButton.addEventListener("click", async function () {
      try {
        if (
          typeof selectedCars === "undefined" ||
          !selectedCars.size
        ) {
          alert("請先勾選要補登 Google 行事曆的車團");
          return;
        }

        guardedButton.disabled = true;
        guardedButton.textContent = "📅 讀取 JLY 正式車團…";

        const ids = Array.from(selectedCars);
        const official = await readOfficialCars(ids);

        const approved = window.confirm(
          buildConfirmation(official)
        );

        if (!approved) {
          return;
        }

        originalButton.click();
      } catch (error) {
        console.error("Google 補登來源驗證失敗：", error);
        alert(
          "Google 補登已停止：\n" +
          (error && error.message ? error.message : "無法確認 JLY 正式車團資料")
        );
      } finally {
        guardedButton.disabled = false;
        guardedButton.textContent = "📅 補登 Google";
      }
    });

    button.replaceWith(guardedButton);
  }

  function installWhenReady() {
    installGuard();
    setTimeout(installGuard, 300);
    setTimeout(installGuard, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installWhenReady);
  } else {
    installWhenReady();
  }
})();
