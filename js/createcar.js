console.log(
  "createcar.js Calendar Popup Fix V1.1 已成功載入！"
);

function nowTime() {
  return new Date().toISOString();
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

  const genderBox =
    document.getElementById(
      "genderBox"
    );

  const totalBox =
    document.getElementById(
      "totalBox"
    );

  if (genderBox) {
    genderBox.style.display =
      mode === "gender"
        ? "block"
        : "none";
  }

  if (totalBox) {
    totalBox.style.display =
      mode === "total"
        ? "block"
        : "none";
  }
}

async function findSameDayCars(
  gameDate
) {
  const db = window.db;

  if (!db) {
    throw new Error(
      "Firebase 尚未載入"
    );
  }

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

  button.disabled = isBusy;

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
    encodeURIComponent(carId)
  );
}

async function persistCar(car) {
  if (
    typeof window
      .saveCarToFirebase ===
    "function"
  ) {
    return window
      .saveCarToFirebase(car);
  }

  const ref =
    await window.db
      .collection("cars")
      .add(car);

  return ref.id;
}

function buildJlyConflictMessage(
  sameDayCars
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

  return lines.join("\n");
}

/*
  Google OAuth 必須在使用者點擊後
  立即觸發。

  不可以先 await Firestore，
  否則 Chrome 可能阻擋彈出視窗。
*/
async function authorizeGoogleImmediately(
  calendarOptions
) {
  const needsGoogle =
    calendarOptions
      .scheduleCheckEnabled ||
    calendarOptions
      .syncEnabled;

  if (!needsGoogle) {
    return {
      needed: false,
      authorized: false,
      error: null
    };
  }

  if (
    !window.JLYCalendarAuth ||
    typeof window
      .JLYCalendarAuth
      .requestAccessToken !==
      "function"
  ) {
    return {
      needed: true,
      authorized: false,
      error: new Error(
        "Google Calendar 授權模組尚未載入"
      )
    };
  }

  try {
    /*
      這裡是整個修正的核心。

      requestAccessToken() 必須在
      createCar() 點擊流程一開始執行。
    */
    await window
      .JLYCalendarAuth
      .requestAccessToken();

    return {
      needed: true,
      authorized: true,
      error: null
    };
  } catch (error) {
    console.error(
      "Google Calendar 授權失敗：",
      error
    );

    return {
      needed: true,
      authorized: false,
      error
    };
  }
}

async function createCar() {
  const db = window.db;

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

  /*
    先完成同步驗證。

    Google 授權必須接近使用者點擊，
    但必要欄位仍應先檢查，
    避免資料沒填完就跳授權。
  */
  if (!scriptName) {
    alert("請輸入劇本名稱");
    return;
  }

  /*
  日期留白時，代表這台車仍在規劃中。
*/
const isUnscheduled =
  !gameDate;

/*
  尚未排日期時，不應單獨留下時間。
*/
if (
  isUnscheduled &&
  gameTime
) {
  alert(
    "這台車尚未安排日期，請先清除時間，或補上日期。"
  );

  return;
}

/*
  有日期，就必須有開始時間。
*/
if (
  !isUnscheduled &&
  !gameTime
) {
  alert("請選擇時間");
  return;
}

/*
  地點改成選填，
  規劃中的車可以之後再補。
*/

  const peopleMode =
    getPeopleMode();

  let maleSlots = 0;
  let femaleSlots = 0;
  let flexibleSlots = 0;
  let totalPeople = 0;

  if (
    peopleMode === "gender"
  ) {
    maleSlots =
      Number(
        document
          .getElementById(
            "maleSlots"
          )
          .value || 0
      );

    femaleSlots =
      Number(
        document
          .getElementById(
            "femaleSlots"
          )
          .value || 0
      );

    flexibleSlots =
      Number(
        document
          .getElementById(
            "flexibleSlots"
          )
          .value || 0
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
          .value || 0
      );

    flexibleSlots =
      totalPeople;
  }

  if (totalPeople <= 0) {
    alert("請設定人數");
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

  const calendarFormValues =
  getCalendarFormValues();

const calendarOptions =
  isUnscheduled
    ? {
        ...calendarFormValues,

        /*
          尚未有日期時：
          - 不檢查撞期
          - 不同步 Google
        */
        scheduleCheckEnabled:
          false,

        syncEnabled:
          false
      }
    : calendarFormValues;

  const now = nowTime();

  setCreateButtonBusy(true);

  try {
    /*
      重要：
      這裡必須排在所有 Firestore await 之前。
    */
    const googleAuthResult =
      await authorizeGoogleImmediately(
        calendarOptions
      );

    let googleAuthorized =
      googleAuthResult.authorized;

    let googleAuthError =
      googleAuthResult.error;

    /*
      Google 授權失敗不能阻止 JLY 建車。

      使用者可以選擇：
      - 取消此次建立
      - 繼續建立，但略過 Google 檢查與同步
    */
    if (
      googleAuthResult.needed &&
      !googleAuthorized
    ) {
      const keepGoing =
        confirm(
          "⚠️ Google Calendar 授權未完成。\n\n" +
          (
            googleAuthError &&
            googleAuthError.message
              ? googleAuthError.message
              : "無法開啟 Google 授權視窗"
          ) +
          "\n\n仍要建立 JLY 車團嗎？\n" +
          "這次將略過 Google 行程檢查與同步。"
        );

      if (!keepGoing) {
        return;
      }
    }

    /*
      Google 授權完成後，
      才開始查 Firestore。
    */
    const sameDayCars =
  isUnscheduled
    ? []
    : await findSameDayCars(
        gameDate
      );

    if (
      calendarOptions
        .scheduleCheckEnabled &&
      googleAuthorized
    ) {
      if (
        !window
          .JLYCalendarController ||
        typeof window
          .JLYCalendarController
          .checkBeforeCreate !==
          "function"
      ) {
        throw new Error(
          "Calendar Controller 尚未載入"
        );
      }

      const checkResult =
        await window
          .JLYCalendarController
          .checkBeforeCreate({
            gameDate,

            jlyCars:
              sameDayCars,

            /*
              已經授權成功，
              Provider 會直接重用現有 Token。
            */
            checkGoogle: true
          });

      if (!checkResult.proceed) {
        return;
      }
    } else if (
      sameDayCars.length > 0
    ) {
      /*
        沒開 Google 檢查，
        或 Google 授權失敗時，
        仍保留原本的 JLY 同日提醒。
      */
      const keepGoing =
        confirm(
          buildJlyConflictMessage(
            sameDayCars
          )
        );

      if (!keepGoing) {
        return;
      }
    }

    const conflictStatus =
      sameDayCars.length > 0
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

    /*
      若使用者要求同步，
      但 Google 授權失敗，
      先在 Car 裡留下失敗狀態。
    */
    if (
      calendarOptions.syncEnabled &&
      !googleAuthorized
    ) {
      calendarData.syncStatus =
        "failed";

      calendarData.lastSyncAt =
        nowTime();

      calendarData.lastError =
        googleAuthError &&
        googleAuthError.message
          ? googleAuthError.message
          : "Google 授權未完成";
    }

    const ownerId =
  window.JLYIdentity &&
  typeof window
    .JLYIdentity
    .ensureCurrentPlayerId ===
      "function"
    ? window
        .JLYIdentity
        .ensureCurrentPlayerId()
    : localStorage.getItem(
        "currentPlayerId"
      );

    const car = {
      ownerId: ownerId || "",
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
          : Number(priceInput),

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

      seatSystemVersion: 1,

      myRole,

      isHost:
        myRole === "host",

      isPlayer:
        myRole === "player",

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
        避免舊版頁面讀取失敗。
      */
      calendarStatus:
        "not_added",

      calendarEventId:
        null,

      /*
  流程狀態：
  - 無日期：規劃中
  - 有日期：招募中
*/
status:
  isUnscheduled
    ? "規劃中"
    : "招募中",

planningStatus:
  isUnscheduled
    ? "unscheduled"
    : "scheduled",

      createdAt: now,

      updatedAt: now
    };

    const carId =
      await persistCar(car);

    let calendarResult = null;

    /*
      只有使用者勾選同步，
      而且 Google 已授權成功，
      才建立 Calendar Event。
    */
    if (
      calendarOptions.syncEnabled &&
      googleAuthorized
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
                settings.titleTemplate,

              calendarId:
                settings.calendarId
            });
      }
    }

    if (
      calendarResult &&
      calendarResult.ok === false
    ) {
      alert(
        "車團已建立，但 Google Calendar 同步失敗。\n\n" +
        (
          calendarResult.error &&
          calendarResult.error.message
            ? calendarResult
                .error.message
            : "未知錯誤"
        ) +
        "\n\n之後可以在車團詳細頁重新同步。"
      );
    } else if (
      calendarOptions.syncEnabled &&
      googleAuthorized
    ) {
      alert(
        "車團建立成功，已同步到 Google Calendar！"
      );
    } else if (
      calendarOptions.syncEnabled &&
      !googleAuthorized
    ) {
      alert(
        "車團已建立，但尚未同步到 Google Calendar。\n\n" +
        "系統已保留同步失敗狀態，之後可以重新同步。"
      );
    } else {
      alert(
  isUnscheduled
    ? "車團已建立，並加入規劃中。"
    : "車團建立成功！"
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
    setCreateButtonBusy(false);
  }
}

window.createCar = createCar;

window.togglePeopleMode =
  togglePeopleMode;

document.addEventListener(
  "DOMContentLoaded",
  togglePeopleMode
);