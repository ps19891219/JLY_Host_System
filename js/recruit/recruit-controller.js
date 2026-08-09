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

  function isHostCar(car) {
  return Boolean(
    car &&
    (
      car.isHost === true ||
      car.myRole === "host"
    )
  );
}

function filterRecruitCars(
  cars
) {
  const render =
    window.JLYRecruitRender;

  return cars.filter(
    function (car) {
      return (
        render.getStatus(car) ===
        "招募中"
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
  ownerId 代表資料屬於這個人，
  但個人揪團頁只自動顯示
  他實際是主揪的車。
*/
const hostCars =
  ownerCars.filter(
    isHostCar
  );

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
  合併：
  1. 我主揪的車
  2. 我協助揪團的車

  同一台如果重複，只保留一份。
*/
const mergedCars =
  mergeCars([
    hostCars,
    assistCars
  ]);

const cars =
  sortRecruitCars(
    filterRecruitCars(
      mergedCars
    )
  );

      render.renderPage(
        container,
        cars
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