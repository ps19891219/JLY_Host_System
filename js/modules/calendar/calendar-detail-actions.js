(function () {
  "use strict";

  const SYNC_FIELDS = new Set([
    "scriptName",
    "activityName",
    "gameDate",
    "gameTime",
    "location",
    "locationName",
    "studioName",
    "organizer",
    "organizerName"
  ]);

  function getCarId() {
    return new URLSearchParams(
      location.search
    ).get("id");
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

  function needsCalendarSync(
    car,
    fieldName
  ) {
    return Boolean(
      car &&
      car.calendar &&
      car.calendar.syncEnabled ===
        true &&
      car.calendar.eventId &&
      SYNC_FIELDS.has(fieldName)
    );
  }

  async function authorizeForCar(
    car
  ) {
    if (
      !car ||
      !car.calendar ||
      !car.calendar.eventId
    ) {
      return {
        needed: false,
        authorized: false
      };
    }

    if (
      !window.JLYCalendarAuth ||
      typeof window
        .JLYCalendarAuth
        .requestAccessToken !==
        "function"
    ) {
      throw new Error(
        "Google Calendar 授權模組尚未載入"
      );
    }

    await window
      .JLYCalendarAuth
      .requestAccessToken();

    return {
      needed: true,
      authorized: true
    };
  }

  async function syncAfterFieldUpdate(
    config
  ) {
    const carId =
      config.carId ||
      getCarId();

    const fieldName =
      config.fieldName;

    const value =
      config.value;

    const currentCar =
      config.car ||
      window.currentCarData;

    if (
      !needsCalendarSync(
        currentCar,
        fieldName
      )
    ) {
      return {
        ok: true,
        skipped: true
      };
    }

    const nextCar = {
      ...currentCar,
      [fieldName]: value
    };

    /*
      相容同義欄位。
    */
    if (
      fieldName ===
      "scriptName"
    ) {
      nextCar.activityName =
        value;
    }

    if (
      fieldName ===
      "location"
    ) {
      nextCar.locationName =
        value;
    }

    if (
      fieldName ===
      "locationName"
    ) {
      nextCar.location =
        value;
    }

    if (
      fieldName ===
      "studioName"
    ) {
      nextCar.organizerName =
        value;
    }

    const result =
      await window
        .JLYCalendarSync
        .syncUpdatedCar({
          carId,
          car: nextCar,

          carUrl:
            getCarDetailUrl(
              carId
            )
        });

    return result;
  }

  async function deleteCurrentCar() {
  const db =
    window.db;

  const carId =
    getCarId();

  if (!db) {
    alert(
      "Firebase 尚未載入"
    );
    return;
  }

  if (!carId) {
    alert(
      "找不到車團 ID"
    );
    return;
  }

  /*
    必須直接使用目前頁面已載入的資料，
    並在任何 Firestore await 之前觸發 Google 授權。

    否則 Chrome 會判定 Popup
    不是由使用者點擊直接觸發。
  */
  const currentCar =
    window.currentCarData;

  if (!currentCar) {
    alert(
      "車團資料尚未載入完成，請重新整理後再試。"
    );
    return;
  }

  const currentCalendar =
    currentCar.calendar || {};

  let googleAuthorized =
    false;

  let googleAuthError =
    null;

  /*
    有 Google Event 時，
    點擊刪除後立即取得授權。
  */
  if (currentCalendar.eventId) {
    try {
      await authorizeForCar(
        currentCar
      );

      googleAuthorized =
        true;
    } catch (error) {
      googleAuthError =
        error;

      console.warn(
        "Google Calendar 授權未完成：",
        error
      );
    }
  }

  const carRef =
    db.collection("cars")
      .doc(carId);

  try {
    /*
      Google 授權處理完成後，
      才讀取最新 Firestore 資料。
    */
    const snapshot =
      await carRef.get();

    if (!snapshot.exists) {
      alert(
        "找不到這台車"
      );
      return;
    }

    const car =
      snapshot.data();

    const calendar =
      car.calendar || {};

    const summary = [
      "確定要永久刪除這台測試車嗎？",
      "",
      "劇本：" +
        (
          car.scriptName ||
          "未命名劇本"
        ),

      "日期：" +
        (
          car.gameDate ||
          "未設定"
        ),

      "時間：" +
        (
          car.gameTime ||
          "未設定"
        ),

      "",
      "此操作無法復原。"
    ].join("\n");

    if (!confirm(summary)) {
      return;
    }

    let removeGoogle =
      false;

    if (calendar.eventId) {
      removeGoogle =
        confirm(
          "這台車已同步到 Google Calendar。\n\n" +
          "按「確定」：一起刪除 Google 行程\n" +
          "按「取消」：只刪除 JLY 車團"
        );
    }

    if (removeGoogle) {
      if (!googleAuthorized) {
        const deleteJlyOnly =
          confirm(
            "⚠️ Google Calendar 授權未完成。\n\n" +
            (
              googleAuthError &&
              googleAuthError.message
                ? googleAuthError.message
                : "無法取得 Google 授權"
            ) +
            "\n\n是否仍只刪除 JLY 車團？"
          );

        if (!deleteJlyOnly) {
          return;
        }

        removeGoogle =
          false;
      } else {
        const calendarResult =
          await window
            .JLYCalendarSync
            .removeSyncedEvent({
              carId,
              car
            });

        if (
          calendarResult.ok !==
          true
        ) {
          const deleteJlyOnly =
            confirm(
              "⚠️ Google Calendar 行程刪除失敗。\n\n" +
              (
                calendarResult
                  .error &&
                calendarResult
                  .error.message
                  ? calendarResult
                      .error.message
                  : "未知錯誤"
              ) +
              "\n\n是否仍只刪除 JLY 車團？"
            );

          if (!deleteJlyOnly) {
            return;
          }

          removeGoogle =
            false;
        }
      }
    }

    const deleteResponse =
  await fetch(
    "/api/delete-test-car",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify({
          carId
        })
    }
  );


const deleteResult =
  await deleteResponse.json();


if (
  !deleteResponse.ok ||
  !deleteResult.success
) {
  const message =
    deleteResult.error ===
      "line_login_required"
      ? "永久刪除測試車前，請先完成 LINE 登入。"

      : deleteResult.error ===
          "car_owner_required"
        ? "只有這台車的主揪可以永久刪除測試車。"

      : deleteResult.error ===
          "car_not_found"
        ? "找不到這台車，可能已經被刪除。"

      : "測試車資料清理失敗。";

  throw new Error(
    message
  );
}

    /*
      清掉上一台／下一台車的導覽資料。
    */
    try {
      const key =
        "mycarNavigationIds";

      const saved =
        JSON.parse(
          sessionStorage
            .getItem(key) ||
          "[]"
        );

      if (Array.isArray(saved)) {
        sessionStorage.setItem(
          key,
          JSON.stringify(
            saved.filter(
              function (id) {
                return id !==
                  carId;
              }
            )
          )
        );
      }
    } catch (error) {
      console.warn(
        "清理車團導覽紀錄失敗：",
        error
      );
    }

    alert(
      removeGoogle
        ? "測試車與 Google Calendar 行程已刪除。"
        : "測試車已刪除。"
    );

    location.href =
      "mycar.html";
  } catch (error) {
    console.error(
      "刪除車團失敗：",
      error
    );

    alert(
      "刪除失敗：" +
      (
        error.message ||
        "未知錯誤"
      )
    );
  }
}

  window
    .JLYCalendarDetailActions = {
      needsCalendarSync,
      authorizeForCar,
      syncAfterFieldUpdate,
      deleteCurrentCar
    };

  window.deleteCurrentCar =
    deleteCurrentCar;

  console.log(
    "✅ Calendar Detail Actions 已載入"
  );
})();