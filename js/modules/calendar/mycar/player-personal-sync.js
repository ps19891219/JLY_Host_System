(function () {
  "use strict";

  const API_BASE = "https://www.googleapis.com/calendar/v3";
  const CALENDAR_ID = "primary";
  const text = (value) => String(value == null ? "" : value).trim();
  const nowIso = () => new Date().toISOString();

  function actorId() {
    if (
      window.JLYIdentity &&
      typeof window.JLYIdentity.getCurrentPlayerId === "function"
    ) {
      return text(window.JLYIdentity.getCurrentPlayerId());
    }
    return text(localStorage.getItem("currentPlayerId"));
  }

  function carName(car) {
    return text(car?.activityName || car?.scriptName || car?.title) || "未命名車團";
  }

  function durationMinutes(car) {
    return Number(
      car?.calendar?.eventDurationMinutes ||
      car?.eventDurationMinutes ||
      60
    ) || 60;
  }

  function carUrl(carId) {
    return location.origin + "/pages/car-view.html?id=" + encodeURIComponent(carId);
  }

  async function resolveMyPreparedView(id) {
    if (!window.JLYMyCarView || typeof window.JLYMyCarView.read !== "function") {
      throw new Error("MyCar Prepared View 模組尚未載入");
    }

    let view = await window.JLYMyCarView.read(id);
    if (view) return view;

    const alias = await window.db
      .collection("myCarViewAliases")
      .doc(id)
      .get();

    if (!alias.exists) return null;
    const viewerId = text((alias.data() || {}).viewerId);
    if (!viewerId) return null;
    return window.JLYMyCarView.read(viewerId);
  }

  async function readSelectedPlayerCars(ids) {
    if (!window.db) throw new Error("Firebase 尚未載入");

    const id = actorId();
    if (!id) throw new Error("請先登入 JLY 身分");

    const view = await resolveMyPreparedView(id);
    if (!view || !Array.isArray(view.cars)) {
      throw new Error("找不到你的 MyCar Prepared View");
    }

    const preparedById = new Map(
      view.cars
        .filter((car) => car && car.id)
        .map((car) => [text(car.id), car])
    );

    const result = [];

    for (const carId of ids) {
      const prepared = preparedById.get(text(carId));

      if (!prepared || prepared.isPlayer !== true || prepared.isHost === true) {
        throw new Error("選取內容含有非「我是玩家」的車團，請切到玩家頁籤後再批次加入行事曆。");
      }

      const snapshot = await window.db
        .collection("cars")
        .doc(carId)
        .get();

      if (!snapshot.exists) {
        throw new Error("找不到正式車團資料：" + carId);
      }

      const car = snapshot.data() || {};
      const gameDate = text(car.gameDate);
      const gameTime = text(car.gameTime);

      if (!gameDate || !gameTime) {
        throw new Error("車團缺少日期或時間：" + carName(car));
      }

      result.push({
        carId,
        car,
        name: carName(car),
        gameDate,
        gameTime,
        durationMinutes: durationMinutes(car)
      });
    }

    return result;
  }

  function googleError(status, body) {
    const message =
      text(body?.error?.message) ||
      "Google Calendar API 錯誤";
    const error = new Error(message + "（HTTP " + status + "）");
    error.httpStatus = status;
    return error;
  }

  async function googleFetch(token, path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", "Bearer " + token);
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(API_BASE + path, {
      ...options,
      headers
    });

    let body = null;
    if (response.status !== 204) {
      try {
        body = await response.json();
      } catch (_error) {
        body = null;
      }
    }

    if (!response.ok) {
      throw googleError(response.status, body);
    }

    return {
      status: response.status,
      body
    };
  }

  async function getPrimaryIdentity(token) {
    return (await googleFetch(token, "/calendars/primary")).body || {};
  }

  async function exactGetOrNull(token, eventId) {
    const id = text(eventId);
    if (!id) return null;

    try {
      return (await googleFetch(
        token,
        "/calendars/primary/events/" + encodeURIComponent(id)
      )).body || null;
    } catch (error) {
      if (error?.httpStatus === 404 || error?.httpStatus === 410) return null;
      throw error;
    }
  }

  function privateValue(event, key) {
    return text(event?.extendedProperties?.private?.[key]);
  }

  async function findPersonalEvent(token, carId, currentActorId) {
    const params = new URLSearchParams({
      privateExtendedProperty: "carId=" + text(carId),
      singleEvents: "true",
      showDeleted: "false",
      maxResults: "20"
    });

    const body = (await googleFetch(
      token,
      "/calendars/primary/events?" + params.toString()
    )).body || {};

    const matches = (Array.isArray(body.items) ? body.items : [])
      .filter((event) =>
        privateValue(event, "carId") === text(carId) &&
        privateValue(event, "jlyActorId") === text(currentActorId) &&
        text(event?.status) !== "cancelled"
      );

    if (matches.length > 1) {
      throw new Error(
        "Google Calendar 找到多筆相同玩家／車團事件，已停止避免重複。"
      );
    }

    return matches[0] || null;
  }

  async function readPersonalCalendarRelation(currentActorId, carId) {
    if (
      !window.JLYCarRelations ||
      typeof window.JLYCarRelations.getRelation !== "function"
    ) {
      throw new Error("Car Relation 模組尚未載入");
    }

    const relation = await window.JLYCarRelations
      .getRelation(currentActorId, carId);

    return relation &&
      relation.personalCalendar &&
      typeof relation.personalCalendar === "object"
        ? relation.personalCalendar
        : {};
  }

  async function writePersonalCalendarRelation(currentActorId, carId, patch) {
    if (
      !window.JLYCarRelations ||
      typeof window.JLYCarRelations.updateRelation !== "function"
    ) {
      throw new Error("Car Relation 模組尚未載入");
    }

    const before = await readPersonalCalendarRelation(
      currentActorId,
      carId
    );

    await window.JLYCarRelations.updateRelation(
      currentActorId,
      carId,
      {
        personalCalendar: {
          ...before,
          ...patch
        }
      }
    );
  }

  function expectedResource(item, currentActorId) {
    const provider = window.JLYCalendarProviderGoogle;

    if (!provider || typeof provider.buildEventResource !== "function") {
      throw new Error("Google Calendar Provider 尚未載入");
    }

    return provider.buildEventResource({
      carId: item.carId,
      car: item.car,
      actorId: currentActorId,
      calendarId: CALENDAR_ID,
      durationMinutes: item.durationMinutes,
      carUrl: carUrl(item.carId)
    });
  }

  function samePersonalEvent(event, carId, currentActorId) {
    return (
      privateValue(event, "carId") === text(carId) &&
      privateValue(event, "jlyActorId") === text(currentActorId)
    );
  }

  async function syncOne(token, item, currentActorId) {
    const relationCalendar =
      await readPersonalCalendarRelation(
        currentActorId,
        item.carId
      );

    const resource =
      expectedResource(
        item,
        currentActorId
      );

    await writePersonalCalendarRelation(
      currentActorId,
      item.carId,
      {
        syncStatus: "syncing",
        lastError: ""
      }
    );

    try {
      let existing = null;
      const mappedEventId =
        text(relationCalendar.eventId);

      if (mappedEventId) {
        const exact =
          await exactGetOrNull(
            token,
            mappedEventId
          );

        if (
          exact &&
          samePersonalEvent(
            exact,
            item.carId,
            currentActorId
          )
        ) {
          existing = exact;
        }
      }

      if (!existing) {
        existing =
          await findPersonalEvent(
            token,
            item.carId,
            currentActorId
          );
      }

      let event;
      let action;

      if (existing?.id) {
        event = (
          await googleFetch(
            token,
            "/calendars/primary/events/" +
              encodeURIComponent(existing.id),
            {
              method: "PATCH",
              body: JSON.stringify(resource)
            }
          )
        ).body || {};
        action = "updated";
      } else {
        event = (
          await googleFetch(
            token,
            "/calendars/primary/events",
            {
              method: "POST",
              body: JSON.stringify(resource)
            }
          )
        ).body || {};
        action = "created";
      }

      const eventId =
        text(event?.id);

      if (!eventId) {
        throw new Error("Google 沒有回傳 Event ID");
      }

      const verified =
        await exactGetOrNull(
          token,
          eventId
        );

      if (
        !verified ||
        !samePersonalEvent(
          verified,
          item.carId,
          currentActorId
        )
      ) {
        throw new Error("Google 個人行事曆事件驗證失敗");
      }

      await writePersonalCalendarRelation(
        currentActorId,
        item.carId,
        {
          provider: "google",
          calendarId: CALENDAR_ID,
          eventId,
          eventUrl: text(verified.htmlLink),
          eventDurationMinutes:
            item.durationMinutes,
          syncStatus: "synced",
          lastSyncAt: nowIso(),
          lastError: ""
        }
      );

      return {
        carId: item.carId,
        name: item.name,
        action,
        event: verified
      };
    } catch (error) {
      await writePersonalCalendarRelation(
        currentActorId,
        item.carId,
        {
          syncStatus: "error",
          lastSyncAt: nowIso(),
          lastError:
            text(error?.message) ||
            "未知錯誤"
        }
      );

      throw error;
    }
  }

  function showResults(accountLabel, succeeded, failed) {
    document.getElementById("mycarPlayerCalendarResultPanel")?.remove();

    const panel = document.createElement("div");
    panel.id = "mycarPlayerCalendarResultPanel";
    panel.style.cssText =
      "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box";

    const card = document.createElement("div");
    card.style.cssText =
      "width:min(680px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-sizing:border-box";

    const title = document.createElement("h3");
    title.textContent =
      "玩家 Google 行事曆｜成功 " +
      succeeded.length +
      " 台、失敗 " +
      failed.length +
      " 台";
    card.appendChild(title);

    const account = document.createElement("div");
    account.textContent =
      "Google Calendar：" + accountLabel;
    account.style.cssText =
      "font-size:13px;margin:0 0 12px;color:#555;word-break:break-word";
    card.appendChild(account);

    succeeded.forEach((item) => {
      const row = document.createElement("div");
      row.style.cssText =
        "border:1px solid #ddd;border-radius:12px;padding:12px;margin-bottom:10px;line-height:1.5";
      row.textContent =
        "✅ " +
        item.name +
        "｜" +
        (item.action === "created" ? "已建立" : "已更新");
      card.appendChild(row);
    });

    failed.forEach((item) => {
      const row = document.createElement("div");
      row.style.cssText =
        "border:1px solid #ead3d3;border-radius:12px;padding:12px;margin-bottom:10px;line-height:1.5";
      row.textContent =
        "❌ " +
        (item.name || item.carId) +
        "：" +
        item.message;
      card.appendChild(row);
    });

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "關閉";
    close.style.cssText =
      "width:100%;padding:12px;margin-top:8px;border-radius:12px;font-weight:700";
    close.addEventListener("click", () => panel.remove());
    card.appendChild(close);

    panel.appendChild(card);
    document.body.appendChild(panel);
  }

  function showConfirmation(items, onConfirm) {
    document.getElementById("mycarPlayerCalendarConfirmPanel")?.remove();

    const panel = document.createElement("div");
    panel.id = "mycarPlayerCalendarConfirmPanel";
    panel.style.cssText =
      "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box";

    const card = document.createElement("div");
    card.style.cssText =
      "width:min(680px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-sizing:border-box";

    const title = document.createElement("h3");
    title.textContent =
      "📅 加入我的 Google 行事曆";
    card.appendChild(title);

    const note = document.createElement("div");
    note.textContent =
      "只會建立／更新你自己的 Google Calendar 事件，不會修改主揪的 Calendar mapping。";
    note.style.cssText =
      "font-size:13px;line-height:1.55;margin-bottom:14px;color:#555";
    card.appendChild(note);

    items.forEach((item) => {
      const row = document.createElement("div");
      row.style.cssText =
        "border:1px solid #ddd;border-radius:12px;padding:10px;margin-bottom:8px";
      row.textContent =
        "🎭 " +
        item.name +
        "\n" +
        item.gameDate +
        " " +
        item.gameTime +
        "｜" +
        item.durationMinutes +
        " 分鐘";
      row.style.whiteSpace = "pre-wrap";
      card.appendChild(row);
    });

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.textContent =
      "確認，加入 Google 行事曆";
    confirm.style.cssText =
      "width:100%;padding:13px;margin-top:8px;border-radius:12px;font-weight:800";
    confirm.addEventListener("click", () => onConfirm(confirm, panel));
    card.appendChild(confirm);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    cancel.style.cssText =
      "width:100%;padding:12px;margin-top:8px;border-radius:12px";
    cancel.addEventListener("click", () => panel.remove());
    card.appendChild(cancel);

    panel.appendChild(card);
    document.body.appendChild(panel);
  }

  async function runConfirmed(items, button, panel) {
    const currentActorId = actorId();
    const auth = window.JLYCalendarAuth;

    if (!currentActorId) {
      alert("請先登入 JLY 身分");
      return;
    }

    if (!auth || typeof auth.requestAccessToken !== "function") {
      alert("Google Calendar 授權模組尚未載入");
      return;
    }

    button.disabled = true;
    button.textContent = "📅 選擇 Google 帳號…";

    try {
      if (typeof auth.clearToken === "function") {
        auth.clearToken();
      }

      const token =
        await auth.requestAccessToken({
          selectAccount: true
        });

      const identity =
        await getPrimaryIdentity(token);

      const accountLabel =
        text(identity?.id || identity?.summary) ||
        "primary";

      if (
        !window.confirm(
          "這次會加入到：\n" +
          accountLabel +
          "\n\n確認使用這個 Google Calendar 嗎？"
        )
      ) {
        throw new Error("已取消：Google Calendar 帳號未確認");
      }

      const succeeded = [];
      const failed = [];

      button.textContent =
        "📅 批次加入中…";

      for (const item of items) {
        try {
          succeeded.push(
            await syncOne(
              token,
              item,
              currentActorId
            )
          );
        } catch (error) {
          failed.push({
            carId: item.carId,
            name: item.name,
            message:
              text(error?.message) ||
              "未知錯誤"
          });
        }
      }

      showResults(
        accountLabel,
        succeeded,
        failed
      );
    } catch (error) {
      console.error(
        "玩家批次 Google Calendar 未完成：",
        error
      );

      alert(
        "Google 行事曆未完成：" +
        (
          text(error?.message) ||
          "未知錯誤"
        )
      );
    } finally {
      if (panel?.isConnected) {
        panel.remove();
      }
      button.disabled = false;
      button.textContent =
        "確認，加入 Google 行事曆";
    }
  }

  async function open() {
    if (
      typeof selectedCars === "undefined" ||
      !selectedCars.size
    ) {
      alert("請先勾選要加入行事曆的玩家車團");
      return;
    }

    try {
      const items =
        await readSelectedPlayerCars(
          Array.from(selectedCars)
        );

      showConfirmation(
        items,
        (button, panel) =>
          runConfirmed(
            items,
            button,
            panel
          )
      );
    } catch (error) {
      console.error(
        "玩家行事曆預檢失敗：",
        error
      );

      alert(
        "無法加入行事曆：" +
        (
          text(error?.message) ||
          "未知錯誤"
        )
      );
    }
  }

  function refreshButton() {
    const button =
      document.getElementById(
        "batchPlayerCalendarButton"
      );

    if (!button) return;

    const count =
      typeof selectedCars !== "undefined"
        ? selectedCars.size
        : 0;

    button.disabled = count === 0;
    button.textContent =
      "📅 加入 Google 行事曆（" +
      count +
      "）";
  }

  function installButton() {
    const toolbar =
      document.getElementById("batchToolbar");

    const countBox =
      document.getElementById("selectedCarCount");

    if (!toolbar || !countBox) return;

    document.getElementById(
      "batchPlayerCalendarButton"
    )?.remove();

    const button =
      document.createElement("button");

    button.id =
      "batchPlayerCalendarButton";

    button.type = "button";
    button.className =
      "batch-convert-button";

    button.addEventListener(
      "click",
      open
    );

    countBox.insertAdjacentElement(
      "afterend",
      button
    );

    const observer =
      new MutationObserver(
        refreshButton
      );

    observer.observe(
      countBox,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );

    refreshButton();
  }

  window.JLYMyCarPlayerCalendar = {
    open,
    readSelectedPlayerCars
  };

  function install() {
    installButton();
    setTimeout(installButton, 300);
    setTimeout(installButton, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      install
    );
  } else {
    install();
  }
})();