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

      const ownerIdentityIds =
        typeof data.resolveOwnerIdentityIds ===
          "function"
          ? await data
              .resolveOwnerIdentityIds(
                recruitPage.ownerId
              )
          : [recruitPage.ownerId];

      const ownerIdentitySet =
        new Set(
          ownerIdentityIds.map(
            function (id) {
              return String(id || "").trim();
            }
          )
        );

      const ownerCars =
        await data
          .getRecruitCarsByOwner(
            recruitPage.ownerId
          );

/*
  MyCar Prepared View 負責提供歷史相關車團的 carId，
  但「我主揪的」仍必須由 cars Core 的正式 owner 關係判定。
  不使用 Prepared View 的 isHost 投影直接當頁籤分類，
  避免歷史角色投影把非主揪車誤放進主揪頁籤。
*/
const hostCars =
  (Array.isArray(ownerCars)
    ? ownerCars
    : [])
    .filter(function (car) {
      const ownerIds = [
        car && car.ownerId,
        car && car.ownerPersonId,
        car && car.ownerProfileId,
        car && car.hostId,
        car && car.hostPersonId,
        car && car.hostProfileId,
        car && car.createdByPersonId
      ]
        .map(function (id) {
          return String(id || "").trim();
        })
        .filter(Boolean);

      return ownerIds.some(
        function (id) {
          return ownerIdentitySet.has(id);
        }
      );
    });

/*
  「我協助的」沿用既有 carRelations.assistRecruiting=true。
  歷史 Identity aliases 都做 bounded relation read，
  不把一般玩家／DM 車自動視為協助揪團。
*/
const assistCarIdGroups =
  window.JLYCarRelations &&
  typeof window
    .JLYCarRelations
    .getAssistRecruitingCarIds ===
      "function"
    ? await Promise.all(
        ownerIdentityIds.map(
          function (identityId) {
            return window
              .JLYCarRelations
              .getAssistRecruitingCarIds(
                identityId
              )
              .catch(function () {
                return [];
              });
          }
        )
      )
    : [];

const assistCarIds =
  Array.from(
    new Set(
      assistCarIdGroups.reduce(
        function (all, ids) {
          return all.concat(
            Array.isArray(ids)
              ? ids
              : []
          );
        },
        []
      )
    )
  );

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

const hostCarIds =
  new Set(
    filteredHostCars.map(
      function (car) {
        return car.id;
      }
    )
  );

const filteredAssistCars =
  sortRecruitCars(
    filterRecruitCars(
      assistCars
    ).filter(
      function (car) {
        return (
          car &&
          !hostCarIds.has(car.id)
        );
      }
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