console.log(
  "createcar.js 已成功載入！"
);

function nowTime() {
  return new Date()
    .toISOString();
}

function getRadioValue(
  name,
  defaultValue
) {
  const checked =
    document.querySelector(
      `input[name="${name}"]:checked`
    );

  return checked
    ? checked.value
    : defaultValue;
}

function getPeopleMode() {
  return getRadioValue(
    "peopleMode",
    "gender"
  );
}

function togglePeopleMode() {
  const mode =
    getPeopleMode();

  document
    .getElementById(
      "genderBox"
    )
    .style.display =
      mode === "gender"
        ? "block"
        : "none";

  document
    .getElementById(
      "totalBox"
    )
    .style.display =
      mode === "total"
        ? "block"
        : "none";
}

async function findSameDayCars(
  gameDate
) {
  const db =
    window.db;

  const snapshot =
    await db
      .collection("cars")
      .where(
        "gameDate",
        "==",
        gameDate
      )
      .get();

  return snapshot.docs.map(
    function (doc) {
      return {
        id: doc.id,
        ...doc.data()
      };
    }
  );
}

function getCalendarFormValues() {
  const syncInput =
    document.getElementById(
      "calendarSyncEnabled"
    );

  const checkInput =
    document.getElementById(
      "calendarScheduleCheckEnabled"
    );

  const durationInput =
    document.getElementById(
      "calendarDurationMinutes"
    );

  return {
    syncEnabled:
      Boolean(
        syncInput &&
        syncInput.checked
      ),

    scheduleCheckEnabled:
      Boolean(
        checkInput &&
        checkInput.checked
      ),

    durationMinutes:
      Number(
        durationInput &&
        durationInput.value
          ? durationInput.value
          : 60
      )
  };
}

function setCreateButtonBusy(
  isBusy
) {
  const button =
    document.getElementById(
      "createCarButton"
    );

  if (!button) {
    return;
  }

  button.disabled =
    isBusy;

  button.textContent =
    isBusy
      ? "建立中…"
      : "💾 建立車團";
}

function getCarDetailUrl(
  carId
) {
  return (
    location.origin +
    "/pages/car-detail.html?id=" +
    encodeURIComponent(
      carId
    )
  );
}

async function persistCar(
  car
) {
  if (
    typeof window
      .saveCarToFirebase ===
    "function"
  ) {
    return window
      .saveCarToFirebase(
        car
      );
  }

  const ref =
    await window.db
      .collection("cars")
      .add(car);

  return ref.id;
}

async function createCar() {
  const db =
    window.db;

  if (!db) {
    alert(
      "Firebase 尚未載入，請重新整理"
    );

    return;
  }

  const scriptName =
    document
      .getElementById(
        "scriptName"
      )
      .value
      .trim();

  const gameDate =
    document
      .getElementById(
        "gameDate"
      )
      .value;

  const gameTime =
    document
      .getElementById(
        "gameTime"
      )
      .value;

  const locationName =
    document
      .getElementById(
        "locationName"
      )
      .value
      .trim();

  const organizerName =
    document
      .getElementById(
        "organizerName"
      )
      .value
      .trim();

  const dmName =
    document
      .getElementById(
        "dmName"
      )
      .value
      .trim();

  const priceInput =
    document
      .getElementById(
        "price"
      )
      .value;

  const note =
    document
      .getElementById(
        "note"
      )
      .value
      .trim();

  if (!scriptName) {
    alert(
      "請輸入劇本名稱"
    );

    return;
  }

  if (!gameDate) {
    alert(
      "請選擇日期"
    );

    return;
  }

  if (!gameTime) {
    alert(
      "請選擇時間"
    );

    return;
  }

  if (!locationName) {
    alert(
      "請輸入地點"
    );

    return;
  }

  const peopleMode =
    getPeopleMode();

  let maleSlots = 0;

  let femaleSlots = 0;

  let flexibleSlots = 0;

  let totalPeople = 0;

  if (
    peopleMode ===
    "gender"
  ) {
    maleSlots =
      Number(
        document
          .getElementById(
            "maleSlots"
          )
          .value ||
        0
      );

    femaleSlots =
      Number(
        document
          .getElementById(
            "femaleSlots"
          )
          .value ||
        0
      );

    flexibleSlots =
      Number(
        document
          .getElementById(
            "flexibleSlots"
          )
          .value ||
        0
      );

    totalPeople =
      maleSlots +
      femaleSlots +
      flexibleSlots;
  } else {
    totalPeople =
      Number(
        document
          .getElementById(
            "totalPeople"
          )
          .value ||
        0
      );

    flexibleSlots =
      totalPeople;
  }

  if (
    totalPeople <= 0
  ) {
    alert(
      "請設定人數"
    );

    return;
  }

  const myRole =
    getRadioValue(
      "myRole",
      "host"
    );

  const guestListVisibility =
    getRadioValue(
      "guestListVisibility",
      "approved_only"
    );

  const visibility =
    getRadioValue(
      "visibility",
      "private"
    );

  const calendarOptions =
    getCalendarFormValues();

  const now =
    nowTime();

  setCreateButtonBusy(
    true
  );

  try {
    const sameDayCars =
      await findSameDayCars(
        gameDate
      );

    if (
      calendarOptions
        .scheduleCheckEnabled &&
      (
        !window
          .JLYCalendarController ||
        typeof window
          .JLYCalendarController
          .checkBeforeCreate !==
          "function"
      )
    ) {
      throw new Error(
        "Calendar Controller 尚未載入"
      );
    }

    if (
      calendarOptions
        .scheduleCheckEnabled
    ) {
      const checkResult =
        await window
          .JLYCalendarController
          .checkBeforeCreate({
            gameDate,

            jlyCars:
              sameDayCars,

            checkGoogle:
              true
          });

      if (
        !checkResult.proceed
      ) {
        return;
      }
    } else if (
      sameDayCars.length >
      0
    ) {
      const lines = [
        "⚠️ 這一天你已經有車了：",
        ""
      ];

      sameDayCars.forEach(
        function (car) {
          lines.push(
            "🎭 " +
            (
              car.scriptName ||
              "未命名劇本"
            ) +
            "｜" +
            (
              car.gameTime ||
              "時間未填"
            )
          );
        }
      );

      lines.push(
        "",
        "是否仍要建立新的車？"
      );

      if (
        !confirm(
          lines.join("\n")
        )
      ) {
        return;
      }
    }

    const conflictStatus =
      sameDayCars.length >
      0
        ? "pending"
        : "none";

    const conflictWithCarIds =
      sameDayCars.map(
        function (car) {
          return car.id;
        }
      );

    const calendarData =
      window.JLYCalendarData
        ? window
            .JLYCalendarData
            .buildDefaultCalendarData({
              syncEnabled:
                calendarOptions
                  .syncEnabled,

              eventDurationMinutes:
                calendarOptions
                  .durationMinutes,

              calendarId:
                "primary"
            })
        : {
            provider:
              "google",

            syncEnabled:
              calendarOptions
                .syncEnabled,

            calendarId:
              "primary",

            eventId: "",

            eventUrl: "",

            eventDurationMinutes:
              calendarOptions
                .durationMinutes,

            syncStatus:
              "not_synced",

            lastSyncAt: "",

            lastError: ""
          };

    const car = {
      activityType:
        "劇本",

      activityName:
        scriptName,

      scriptName,

      gameDate,

      gameTime,

      location:
        locationName,

      locationName,

      organizer:
        organizerName,

      organizerName,

      studioName:
        organizerName,

      dmName,

      price:
        priceInput === ""
          ? null
          : Number(
              priceInput
            ),

      note,

      peopleMode,

      maleSlots,

      femaleSlots,

      flexibleSlots,

      totalPeople,

      slots:
        buildSlots({
          peopleMode,

          maleSlots,

          femaleSlots,

          flexibleSlots,

          totalPeople
        }),

      showFlexibleSlotSource:
        false,

      dataVersion: 1,

      seatSystemVersion:
        1,

      myRole,

      isHost:
        myRole ===
        "host",

      isPlayer:
        myRole ===
        "player",

      isFavoriteCar:
        myRole ===
        "favorite",

      visibility,

      guestListVisibility,

      players: [],

      applications: [],

      staffSlots: [],

      history: [
        {
          type:
            "建立車團",

          text:
            "車團已建立",

          time: now
        }
      ],

      conflictStatus,

      conflictWithCarIds,

      conflictNote: "",

      calendar:
        calendarData,

      /*
        暫時保留舊欄位，
        避免舊畫面讀取失敗。
      */
      calendarStatus:
        "not_added",

      calendarEventId:
        null,

      status:
        "招募中",

      createdAt:
        now,

      updatedAt:
        now
    };

    const carId =
      await persistCar(
        car
      );

    let calendarResult =
      null;

    if (
      calendarOptions
        .syncEnabled
    ) {
      if (
        !window
          .JLYCalendarController ||
        typeof window
          .JLYCalendarController
          .syncCreatedCar !==
          "function"
      ) {
        console.warn(
          "Calendar Controller 尚未載入，略過同步"
        );
      } else {
        const settings =
          window
            .JLYCalendarController
            .getSettings();

        calendarResult =
          await window
            .JLYCalendarController
            .syncCreatedCar({
              carId,

              car,

              carUrl:
                getCarDetailUrl(
                  carId
                ),

              durationMinutes:
                calendarOptions
                  .durationMinutes,

              titleTemplate:
                settings
                  .titleTemplate,

              calendarId:
                settings
                  .calendarId
            });
      }
    }

    if (
      calendarResult &&
      calendarResult.ok ===
        false
    ) {
      alert(
        "車團已建立，但 Google Calendar 同步失敗。\n\n" +
        (
          calendarResult
            .error &&
          calendarResult
            .error.message
            ? calendarResult
                .error.message
            : "未知錯誤"
        ) +
        "\n\n你之後可以在車團詳細頁重新同步。"
      );
    } else if (
      calendarOptions
        .syncEnabled
    ) {
      alert(
        "車團建立成功，已同步到 Google Calendar！"
      );
    } else {
      alert(
        "車團建立成功！"
      );
    }

    location.href =
      "mycar.html";
  } catch (error) {
    console.error(
      "建立車團失敗：",
      error
    );

    alert(
      "建立失敗：" +
      (
        error.message ||
        "未知錯誤"
      )
    );
  } finally {
    setCreateButtonBusy(
      false
    );
  }
}

window.createCar =
  createCar;

window.togglePeopleMode =
  togglePeopleMode;

document.addEventListener(
  "DOMContentLoaded",
  togglePeopleMode
);