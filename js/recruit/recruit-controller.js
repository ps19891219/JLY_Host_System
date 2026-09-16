console.log(
  "recruit-controller.js 已成功載入！"
);

(function () {
  "use strict";

  function getContainer() {
    return document.getElementById(
      "recruitCarList"
    );
  }

  function sortRecruitCars(
    cars
  ) {
    return [...cars].sort(
      function (a, b) {
        const aTime =
          new Date(
            (
              a.gameDate ||
              "9999-12-31"
            ) +
            "T" +
            (
              a.gameTime ||
              "23:59"
            )
          ).getTime();

        const bTime =
          new Date(
            (
              b.gameDate ||
              "9999-12-31"
            ) +
            "T" +
            (
              b.gameTime ||
              "23:59"
            )
          ).getTime();

        return aTime - bTime;
      }
    );
  }

function filterRecruitCars(
  cars
) {
  const render =
    window.JLYRecruitRender;

  return cars.filter(
    function (car) {
      if (!car) {
        return false;
      }

      const isRecruiting =
        render.getStatus(car) ===
        "招募中";

      const isPublic =
        String(
          car.visibility || ""
        ).trim() ===
        "public";

      return (
        isRecruiting &&
        isPublic
      );
    }
  );
}

function mergeCars(
  carGroups
) {
  const map =
    new Map();

  carGroups.forEach(
    function (cars) {
      (
        Array.isArray(cars)
          ? cars
          : []
      ).forEach(
        function (car) {
          if (
            !car ||
            !car.id
          ) {
            return;
          }

          map.set(
            car.id,
            car
          );
        }
      );
    }
  );

  return Array.from(
    map.values()
  );
}

  async function initRecruitPage() {
    const container =
      getContainer();

    const data =
      window.JLYRecruitData;

    const render =
      window.JLYRecruitRender;

    if (
      !container ||
      !data ||
      !render
    ) {
      console.error(
        "Recruit 模組尚未完整載入"
      );

      return;
    }

    render.renderLoading(
      container
    );

    try {
      const token =
        data.getShareToken();

      if (!token) {
        render.renderError(
          container,
          "缺少分享連結資訊。"
        );

        return;
      }

      const recruitPage =
        await data
          .getRecruitPageByToken(
            token
          );

      if (
        !recruitPage ||
        !recruitPage.ownerId
      ) {
        render.renderError(
          container,
          "這個分享連結可能已失效。"
        );

        return;
      }

      const ownerCars =
        await data
          .getRecruitCarsByOwner(
            recruitPage.ownerId
          );

/*
  getRecruitCarsByOwner() 已由正式 Car Data
  使用 ownerId 查出頁主正式擁有的車。

  這裡不可再要求 raw Car 帶 isHost / myRole，
  因為這兩個是 MyCar Prepared View 的投影欄位，
  並不是 cars Core 的必要欄位。

  舊邏輯在這裡再次用 isHost / myRole 過濾，
  會把正式 owner 車全部濾成 0 台，連帶讓
  「批次 LINE 揪團文案」沒有任何車可選。
*/
const hostCars =
  Array.isArray(ownerCars)
    ? ownerCars
    : [];

/*
  取得頁主個人設定中，
  有勾「協助揪團」的 Car ID。
*/
const assistCarIds =
  window.JLYCarRelations &&
  typeof window
    .JLYCarRelations
    .getAssistRecruitingCarIds ===
      "function"
    ? await window
        .JLYCarRelations
        .getAssistRecruitingCarIds(
          recruitPage.ownerId
        )
    : [];

/*
  協助揪團的車可能不是頁主擁有，
  所以要依 Car ID 另外取得。
*/
const assistCars =
  window.JLYCarData &&
  typeof window
    .JLYCarData
    .getCarsByIds ===
      "function"
    ? await window
        .JLYCarData
        .getCarsByIds(
          assistCarIds
        )
    : [];

/*
  三個分類都只留下
  目前真正「招募中」且公開的車。
*/
const filteredHostCars =
  sortRecruitCars(
    filterRecruitCars(
      hostCars
    )
  );

const filteredAssistCars =
  sortRecruitCars(
    filterRecruitCars(
      assistCars
    )
  );

const mergedCars =
  mergeCars([
    filteredHostCars,
    filteredAssistCars
  ]);

const allCars =
  sortRecruitCars(
    mergedCars
  );

  if (
  window.JLYRecruitBatchShare &&
  typeof window
    .JLYRecruitBatchShare
    .setCars ===
      "function"
) {
  window
    .JLYRecruitBatchShare
    .setCars(
      allCars
    );
}

if (
  window.JLYRecruitTabs &&
  typeof window
    .JLYRecruitTabs
    .init === "function"
) {
  window.JLYRecruitTabs.init({
    onChange:
      function (cars) {
        render.renderPage(
          container,
          cars
        );
      }
  });

  window.JLYRecruitTabs
    .setCarGroups({
      all:
        allCars,

      host:
        filteredHostCars,

      assist:
        filteredAssistCars
    });

  window.JLYRecruitTabs
    .setTab("all");

  return;
}

render.renderPage(
  container,
  allCars
);

    } catch (error) {
      console.error(
        "載入個人揪團頁失敗：",
        error
      );

      render.renderError(
        container,
        error &&
        error.message
          ? error.message
          : "讀取失敗"
      );
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    initRecruitPage
  );

  window.JLYRecruitController = {
    init:
      initRecruitPage
  };
})();