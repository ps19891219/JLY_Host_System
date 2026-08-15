/*
JLY Host System

Module:
Pre-Trip Reminder V1

Responsibilities:

1. Render reminder settings in Car Detail
2. Read reminder config from Firestore
3. Save reminder config to Firestore
4. Preview LINE reminder message
5. Keep Activity data as the source of truth

Firestore:

cars/{carId}/reminders/preTrip

This module does NOT:

- Send LINE Push messages
- Run scheduled jobs
- Copy Activity data into Reminder documents
*/

(function () {
  "use strict";

  const REMINDER_DOCUMENT_ID =
    "preTrip";

  let observer =
    null;

  let hydrating =
    false;


  function text(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }


  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function getCarId() {
    const controller =
      window.JLYCarDetailController;

    if (
      controller &&
      typeof controller.getState ===
        "function"
    ) {
      const state =
        controller.getState();

      const stateCarId =
        text(
          state &&
          state.carId
        );

      if (stateCarId) {
        return stateCarId;
      }
    }

    const car =
      getCurrentCar();

    const carId =
      text(
        car &&
        (
          car.id ||
          car.carId
        )
      );

    if (carId) {
      return carId;
    }

    return text(
      new URLSearchParams(
        location.search
      ).get("id")
    );
  }


  function getCurrentCar() {
    const controller =
      window.JLYCarDetailController;

    if (
      controller &&
      typeof controller.getCurrentCar ===
        "function"
    ) {
      const car =
        controller.getCurrentCar();

      if (car) {
        return car;
      }
    }

    return (
      window.currentCarData ||
      null
    );
  }


  function getDb() {
    if (!window.db) {
      throw new Error(
        "Firebase Firestore 尚未載入"
      );
    }

    return window.db;
  }


  function getReminderRef(
    carId
  ) {
    return getDb()
      .collection("cars")
      .doc(carId)
      .collection("reminders")
      .doc(
        REMINDER_DOCUMENT_ID
      );
  }


  function getSettingsModule() {
    const module =
      window.JLYNotificationSettings;

    if (!module) {
      throw new Error(
        "Notification Settings 尚未載入"
      );
    }

    return module;
  }


  function getMessageModule() {
    const module =
      window.JLYLineMessage;

    if (!module) {
      throw new Error(
        "LINE Message Builder 尚未載入"
      );
    }

    return module;
  }


  function buildSectionHtml() {
    return `
      <section
        class="card"
        id="preTripReminderSection"
        data-reminder-section="pre-trip"
      >
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:12px;
            flex-wrap:wrap;
          "
        >
          <div>
            <h3 style="margin-bottom:6px;">
              ⏰ 行前提醒
            </h3>

            <p
              style="
                margin:0;
                color:#777;
                font-size:14px;
              "
            >
              設定後將由 JLY 小助手於指定時間提醒這台車的 LINE 群組。
            </p>
          </div>

          <label
            style="
              display:flex;
              align-items:center;
              gap:8px;
            "
          >
            <input
              type="checkbox"
              id="preTripReminderEnabled"
            >
            開啟提醒
          </label>
        </div>

        <div
          style="
            margin-top:18px;
            display:grid;
            gap:14px;
          "
        >
          <label>
            提前幾天發送

            <input
              id="preTripReminderOffsetDays"
              type="number"
              min="0"
              max="30"
              step="1"
              value="1"
              style="
                width:100%;
                margin-top:6px;
              "
            >
          </label>

          <label>
            發送時間

            <input
              id="preTripReminderSendTime"
              type="time"
              value="20:00"
              style="
                width:100%;
                margin-top:6px;
              "
            >
          </label>

          <label>
            補充文字

            <textarea
              id="preTripReminderCustomMessage"
              rows="3"
              placeholder="例如：大家可以提早 10 分鐘到～"
              style="
                width:100%;
                margin-top:6px;
                resize:vertical;
              "
            ></textarea>
          </label>
        </div>

        <div
          id="preTripReminderScheduleInfo"
          style="
            margin-top:14px;
            padding:10px 12px;
            background:#f7f7f7;
            border-radius:10px;
            font-size:14px;
          "
        >
          尚未設定
        </div>

        <div
          id="preTripReminderPreview"
          style="
            display:none;
            margin-top:14px;
            padding:14px;
            background:#faf8f4;
            border-radius:12px;
            white-space:pre-wrap;
            line-height:1.7;
          "
        ></div>

        <div
          style="
            display:flex;
            gap:10px;
            flex-wrap:wrap;
            margin-top:16px;
          "
        >
          <button
            type="button"
            onclick="previewPreTripReminder()"
          >
            預覽提醒
          </button>

          <button
            type="button"
            id="savePreTripReminderButton"
            onclick="savePreTripReminder(this)"
          >
            儲存提醒
          </button>
        </div>
      </section>
    `;
  }


  async function loadConfig() {
    const carId =
      getCarId();

    if (!carId) {
      return null;
    }

    const snapshot =
      await getReminderRef(
        carId
      ).get();

    if (!snapshot.exists) {
      return getSettingsModule()
        .normalizeConfig({});
    }

    return getSettingsModule()
      .normalizeConfig(
        snapshot.data()
      );
  }


  function readForm() {
    const enabled =
      document.getElementById(
        "preTripReminderEnabled"
      );

    const offsetDays =
      document.getElementById(
        "preTripReminderOffsetDays"
      );

    const sendTime =
      document.getElementById(
        "preTripReminderSendTime"
      );

    const customMessage =
      document.getElementById(
        "preTripReminderCustomMessage"
      );

    return {
      enabled:
        Boolean(
          enabled &&
          enabled.checked
        ),

      reminderType:
        "pre_trip",

      triggerType:
        "days_before_at_time",

      offsetDays:
        Number(
          offsetDays &&
          offsetDays.value
        ),

      sendTime:
        text(
          sendTime &&
          sendTime.value
        ),

      timezone:
        "Asia/Taipei",

      templateId:
        "pre_trip_default_v1",

      customMessage:
        text(
          customMessage &&
          customMessage.value
        ),

      targetType:
        "line_group"
    };
  }


  function populateForm(
    config
  ) {
    const settings =
      getSettingsModule()
        .normalizeConfig(
          config
        );

    const enabled =
      document.getElementById(
        "preTripReminderEnabled"
      );

    const offsetDays =
      document.getElementById(
        "preTripReminderOffsetDays"
      );

    const sendTime =
      document.getElementById(
        "preTripReminderSendTime"
      );

    const customMessage =
      document.getElementById(
        "preTripReminderCustomMessage"
      );

    if (enabled) {
      enabled.checked =
        settings.enabled;
    }

    if (offsetDays) {
      offsetDays.value =
        settings.offsetDays;
    }

    if (sendTime) {
      sendTime.value =
        settings.sendTime;
    }

    if (customMessage) {
      customMessage.value =
        settings.customMessage;
    }

    updateScheduleInfo(
      settings
    );
  }


  function formatScheduledAt(
    value
  ) {
    const source =
      text(value);

    if (!source) {
      return "";
    }

    const date =
      new Date(source);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        timeZone:
          "Asia/Taipei",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false
      }
    ).format(date);
  }


  function updateScheduleInfo(
    config
  ) {
    const box =
      document.getElementById(
        "preTripReminderScheduleInfo"
      );

    if (!box) {
      return;
    }

    const settings =
      getSettingsModule()
        .normalizeConfig(
          config
        );

    if (!settings.enabled) {
      box.textContent =
        "目前未開啟行前提醒。";

      return;
    }

    if (!settings.scheduledAt) {
      box.textContent =
        "提醒已開啟，但目前無法計算發送時間。請確認車團日期。";

      return;
    }

    const formatted =
      formatScheduledAt(
        settings.scheduledAt
      );

    box.textContent =
      formatted
        ? `預計發送：${formatted}`
        : "提醒時間尚未完成設定。";
  }


  function preview() {
    const car =
      getCurrentCar();

    if (!car) {
      window.alert(
        "目前還沒有載入車團資料"
      );

      return "";
    }

    const config =
      getSettingsModule()
        .prepareForSave(
          car,
          readForm()
        );

    const message =
      getMessageModule()
        .buildReminderMessage(
          car,
          config
        );

    const previewBox =
      document.getElementById(
        "preTripReminderPreview"
      );

    if (previewBox) {
      previewBox.textContent =
        message;

      previewBox.style.display =
        "block";
    }

    updateScheduleInfo(
      config
    );

    return message;
  }


  async function save(
    button
  ) {
    const carId =
      getCarId();

    const car =
      getCurrentCar();

    if (!carId || !car) {
      window.alert(
        "目前無法取得車團資料"
      );

      return;
    }

    const settingsModule =
      getSettingsModule();

    const existing =
      await loadConfig();

    const prepared =
      settingsModule
        .prepareForSave(
          car,
          readForm()
        );

    const now =
      new Date()
        .toISOString();

    const scheduleChanged =
      !existing ||
      existing.scheduledAt !==
        prepared.scheduledAt ||
      existing.enabled !==
        prepared.enabled ||
      existing.templateId !==
        prepared.templateId ||
      existing.customMessage !==
        prepared.customMessage;

    const data = {
      ...prepared,

      schemaVersion: 1,

      carId,

      /*
       * Activity fields such as scriptName,
       * date, time and location are intentionally
       * NOT copied into this document.
       */

      createdAt:
        existing &&
        existing.createdAt
          ? existing.createdAt
          : now,

      updatedAt:
        now,

      sentAt:
        scheduleChanged
          ? ""
          : text(
              existing &&
              existing.sentAt
            ),

      lastError:
        scheduleChanged
          ? ""
          : text(
              existing &&
              existing.lastError
            )
    };

    if (button) {
      button.disabled =
        true;

      button.textContent =
        "儲存中...";
    }

    try {
      await getReminderRef(
        carId
      ).set(
        data,
        {
          merge: true
        }
      );

      populateForm(
        data
      );

      window.alert(
        data.enabled
          ? "行前提醒設定已儲存"
          : "行前提醒已關閉"
      );

    } catch (error) {
      console.error(
        "儲存行前提醒失敗",
        error
      );

      window.alert(
        "行前提醒儲存失敗，請稍後再試"
      );

    } finally {
      if (button) {
        button.disabled =
          false;

        button.textContent =
          "儲存提醒";
      }
    }
  }


  async function hydrate() {
    if (hydrating) {
      return;
    }

    const section =
      document.getElementById(
        "preTripReminderSection"
      );

    if (!section) {
      return;
    }

    if (
      section.dataset.hydrated ===
      "true"
    ) {
      return;
    }

    hydrating =
      true;

    try {
      const config =
        await loadConfig();

      populateForm(
        config || {}
      );

      section.dataset.hydrated =
        "true";

    } catch (error) {
      console.error(
        "讀取行前提醒失敗",
        error
      );

    } finally {
      hydrating =
        false;
    }
  }


  function injectSection() {
    if (
      document.getElementById(
        "preTripReminderSection"
      )
    ) {
      hydrate();

      return;
    }

    const lineBinding =
      document.querySelector(
        ".line-group-binding-card"
      );

    if (lineBinding) {
      lineBinding.insertAdjacentHTML(
        "afterend",
        buildSectionHtml()
      );

      hydrate();

      return;
    }

    const accounting =
      document.getElementById(
        "accountingSection"
      );

    if (accounting) {
      accounting.insertAdjacentHTML(
        "beforebegin",
        buildSectionHtml()
      );

      hydrate();
    }
  }


  function observe() {
    if (observer) {
      return;
    }

    observer =
      new MutationObserver(
        function () {
          injectSection();
        }
      );

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );

    injectSection();
  }


  window.previewPreTripReminder =
    preview;

  window.savePreTripReminder =
    save;


  window.JLYReminder = {
    REMINDER_DOCUMENT_ID,

    buildSectionHtml,

    loadConfig,

    readForm,

    populateForm,

    preview,

    save,

    hydrate,

    injectSection,

    observe
  };


  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      observe
    );
  } else {
    observe();
  }
})();