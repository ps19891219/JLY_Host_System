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

  function createOverlay(id) {
    const old = document.getElementById(id);
    if (old) {
      old.remove();
    }

    const panel = document.createElement("div");
    panel.id = id;
    panel.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:100000",
      "background:rgba(0,0,0,.45)",
      "display:flex",
      "align-items:flex-end",
      "justify-content:center",
      "padding:16px",
      "box-sizing:border-box"
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "width:min(680px,100%)",
      "max-height:82vh",
      "overflow:auto",
      "background:#fff",
      "border-radius:18px",
      "padding:18px",
      "box-sizing:border-box",
      "box-shadow:0 14px 40px rgba(0,0,0,.22)"
    ].join(";");

    panel.addEventListener("click", function (event) {
      if (event.target === panel) {
        panel.remove();
      }
    });

    panel.appendChild(card);
    document.body.appendChild(panel);

    return { panel, card };
  }

  function appendCloseButton(card, panel) {
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "關閉";
    close.style.cssText = [
      "width:100%",
      "margin-top:10px",
      "padding:12px",
      "border-radius:12px",
      "font-weight:700"
    ].join(";");
    close.addEventListener("click", function () {
      panel.remove();
    });
    card.appendChild(close);
  }

  function showOfficialConfirmation(official, originalButton) {
    const ui = createOverlay("mycarGoogleSourceGuardPanel");
    const panel = ui.panel;
    const card = ui.card;

    const title = document.createElement("h3");
    title.textContent = "請核對 JLY 正式車團資料";
    title.style.margin = "0 0 8px";
    card.appendChild(title);

    const note = document.createElement("div");
    note.textContent =
      "以下日期／時間只讀取 Firestore cars/{carId}，不使用 Google 同名事件或 Work Schedule 推測。";
    note.style.cssText =
      "font-size:13px;line-height:1.55;margin-bottom:14px;color:#555";
    card.appendChild(note);

    official.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText = [
        "border:1px solid #ddd",
        "border-radius:12px",
        "padding:12px",
        "margin-bottom:10px",
        "line-height:1.55",
        "word-break:break-word"
      ].join(";");

      const name = document.createElement("strong");
      name.textContent = `🎭 ${item.name}`;
      box.appendChild(name);

      const details = document.createElement("div");
      details.textContent =
        `${item.gameDate} ${item.gameTime}｜${item.durationMinutes} 分鐘\n` +
        `Car ID：${item.carId}`;
      details.style.cssText =
        "margin-top:6px;font-size:13px;white-space:pre-wrap";
      box.appendChild(details);
      card.appendChild(box);
    });

    const action = originalButton;
    action.id = "batchGoogleRepairConfirmedButton";
    action.disabled = false;
    action.textContent = "確認資料正確，補登 Google";
    action.style.cssText = [
      "width:100%",
      "margin-top:8px",
      "padding:13px",
      "border:0",
      "border-radius:12px",
      "font-weight:800",
      "font-size:16px"
    ].join(";");

    action.addEventListener(
      "click",
      function closePanelAfterTrustedClick() {
        setTimeout(function () {
          if (panel.isConnected) {
            panel.remove();
          }
        }, 0);
      },
      { once: true }
    );
    card.appendChild(action);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    cancel.style.cssText = [
      "width:100%",
      "margin-top:10px",
      "padding:12px",
      "border-radius:12px",
      "font-weight:700"
    ].join(";");
    cancel.addEventListener("click", function () {
      panel.remove();
    });
    card.appendChild(cancel);
  }

  async function showCurrentGoogleMappings() {
    if (
      typeof selectedCars === "undefined" ||
      !selectedCars.size
    ) {
      alert("請先勾選要查看 Google 同步結果的車團");
      return;
    }

    if (!window.db) {
      alert("Firebase 尚未載入");
      return;
    }

    const actorId = getActorId();
    if (!actorId) {
      alert("請先登入 JLY 身分");
      return;
    }

    const items = [];

    for (const carId of Array.from(selectedCars)) {
      const snapshot = await window.db
        .collection("cars")
        .doc(carId)
        .get();

      if (!snapshot.exists) {
        items.push({
          carId,
          name: "找不到車團",
          error: "Firestore 沒有這筆正式車團"
        });
        continue;
      }

      const car = snapshot.data() || {};
      if (!isEditableCar(car, actorId)) {
        items.push({
          carId,
          name: carName(car),
          error: "目前身分不可修改這台主揪車"
        });
        continue;
      }

      const calendar = car.calendar || {};
      items.push({
        carId,
        name: carName(car),
        gameDate: text(car.gameDate),
        gameTime: text(car.gameTime),
        durationMinutes: Number(calendar.eventDurationMinutes || 60) || 60,
        eventId: text(calendar.eventId),
        eventUrl: text(calendar.eventUrl),
        syncStatus: text(calendar.syncStatus) || "未記錄",
        lastSyncAt: text(calendar.lastSyncAt),
        lastError: text(calendar.lastError)
      });
    }

    const ui = createOverlay("mycarGoogleStoredMappingsPanel");
    const panel = ui.panel;
    const card = ui.card;

    const title = document.createElement("h3");
    title.textContent = "Google 同步結果";
    title.style.margin = "0 0 8px";
    card.appendChild(title);

    const note = document.createElement("div");
    note.textContent =
      "這裡只讀取 JLY 已保存的 Google eventId / eventUrl，不會重新補登，也不會修改 Google。";
    note.style.cssText =
      "font-size:13px;line-height:1.55;margin-bottom:14px;color:#555";
    card.appendChild(note);

    items.forEach(function (item) {
      const box = document.createElement("div");
      box.style.cssText = [
        "border:1px solid #ddd",
        "border-radius:12px",
        "padding:12px",
        "margin-bottom:12px",
        "word-break:break-word"
      ].join(";");

      const name = document.createElement("strong");
      name.textContent = item.error
        ? `⚠️ ${item.name}`
        : `✅ ${item.name}`;
      box.appendChild(name);

      const details = document.createElement("div");
      details.style.cssText =
        "margin-top:8px;font-size:13px;line-height:1.6;white-space:pre-wrap";

      if (item.error) {
        details.textContent =
          `Car ID：${item.carId}\n${item.error}`;
      } else {
        details.textContent =
          `Car ID：${item.carId}\n` +
          `JLY 時間：${item.gameDate} ${item.gameTime}｜${item.durationMinutes} 分鐘\n` +
          `Event ID：${item.eventId || "未記錄"}\n` +
          `同步狀態：${item.syncStatus}` +
          (item.lastSyncAt ? `\n最後同步：${item.lastSyncAt}` : "") +
          (item.lastError ? `\n錯誤：${item.lastError}` : "");
      }
      box.appendChild(details);

      if (!item.error && item.eventUrl) {
        const link = document.createElement("a");
        link.href = item.eventUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "開啟 Google 事件";
        link.style.cssText = [
          "display:inline-block",
          "margin-top:10px",
          "padding:9px 12px",
          "border-radius:10px",
          "background:#f2f2f2",
          "font-weight:700",
          "text-decoration:none"
        ].join(";");
        box.appendChild(link);
      } else if (!item.error) {
        const noLink = document.createElement("div");
        noLink.textContent = "⚠️ JLY 尚未保存 Google eventUrl";
        noLink.style.cssText =
          "margin-top:10px;font-size:13px;font-weight:700";
        box.appendChild(noLink);
      }

      card.appendChild(box);
    });

    appendCloseButton(card, panel);
  }

  function installMappingsButton() {
    const repairButton = document.getElementById("batchGoogleRepairButton");
    if (!repairButton) {
      return;
    }

    if (document.getElementById("batchGoogleRepairResultsButton")) {
      return;
    }

    const button = document.createElement("button");
    button.id = "batchGoogleRepairResultsButton";
    button.type = "button";
    button.className = repairButton.className || "batch-convert-button";
    button.textContent = "🔎 查看 Google 同步結果";

    button.addEventListener("click", async function () {
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "🔎 讀取同步結果…";

      try {
        await showCurrentGoogleMappings();
      } catch (error) {
        console.error("讀取 Google 同步結果失敗：", error);
        alert(
          "讀取 Google 同步結果失敗：" +
          (error && error.message ? error.message : "未知錯誤")
        );
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });

    repairButton.insertAdjacentElement("afterend", button);
  }

  function installGuard() {
    const button = document.getElementById("batchGoogleRepairButton");

    if (!button || button.dataset.jlySourceGuard === "1") {
      installMappingsButton();
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

        showOfficialConfirmation(official, originalButton);
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
    installMappingsButton();
  }

  function installWhenReady() {
    installGuard();
    installMappingsButton();
    setTimeout(function () {
      installGuard();
      installMappingsButton();
    }, 300);
    setTimeout(function () {
      installGuard();
      installMappingsButton();
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installWhenReady);
  } else {
    installWhenReady();
  }
})();
