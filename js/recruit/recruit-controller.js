console.log(
  "recruit-controller.js 已成功載入！"
);

(function () {
  "use strict";

  function getContainer() {
    return document.getElementById("recruitCarList");
  }

  function sortRecruitCars(cars) {
    return [...cars].sort(function (a, b) {
      const aTime = new Date((a.gameDate || "9999-12-31") + "T" + (a.gameTime || "23:59")).getTime();
      const bTime = new Date((b.gameDate || "9999-12-31") + "T" + (b.gameTime || "23:59")).getTime();
      return aTime - bTime;
    });
  }

  function filterRecruitCars(cars) {
    const render = window.JLYRecruitRender;
    return cars.filter(function (car) {
      if (!car) return false;
      const isRecruiting = render.getStatus(car) === "招募中";
      const isPublic = String(car.visibility || "").trim() === "public";
      return isRecruiting && isPublic;
    });
  }

  function mergeCars(carGroups) {
    const map = new Map();
    carGroups.forEach(function (cars) {
      (Array.isArray(cars) ? cars : []).forEach(function (car) {
        if (car && car.id) map.set(car.id, car);
      });
    });
    return Array.from(map.values());
  }

  function getCreateCarRole(car) {
    return String(car && car.myRole || "").trim().toLowerCase();
  }

  function isPlayerCreatedCar(car) {
    return getCreateCarRole(car) === "player";
  }

  async function initRecruitPage() {
    const container = getContainer();
    const data = window.JLYRecruitData;
    const render = window.JLYRecruitRender;

    if (!container || !data || !render) {
      console.error("Recruit 模組尚未完整載入");
      return;
    }

    render.renderLoading(container);

    try {
      const token = data.getShareToken();
      if (!token) {
        render.renderError(container, "缺少分享連結資訊。");
        return;
      }

      const recruitPage = await data.getRecruitPageByToken(token);
      if (!recruitPage || !recruitPage.ownerId) {
        render.renderError(container, "這個分享連結可能已失效。");
        return;
      }

      const ownerCars = await data.getRecruitCarsByOwner(recruitPage.ownerId);
      const historicalCars = Array.isArray(ownerCars) ? ownerCars : [];

      /*
        createcar.js already stores the user's explicit selection in car.myRole.
        Do not reinterpret a car with myRole="player" as host merely because an
        old Prepared View indexed it under the same historical identity.
      */
      const rolePlayerCars = historicalCars.filter(isPlayerCreatedCar);
      const hostCars = historicalCars.filter(function (car) {
        return !isPlayerCreatedCar(car);
      });

      const ownerIdentityIds = typeof data.resolveOwnerIdentityIds === "function"
        ? await data.resolveOwnerIdentityIds(recruitPage.ownerId)
        : [recruitPage.ownerId];

      let assistCarIds = [];
      if (window.JLYCarRelations && typeof window.JLYCarRelations.getAssistRecruitingCarIds === "function") {
        const groups = await Promise.all(
          ownerIdentityIds.map(function (identityId) {
            return window.JLYCarRelations.getAssistRecruitingCarIds(identityId);
          })
        );
        assistCarIds = Array.from(new Set(groups.flat().filter(Boolean)));
      }

      const relationAssistCars = window.JLYCarData && typeof window.JLYCarData.getCarsByIds === "function"
        ? await window.JLYCarData.getCarsByIds(assistCarIds)
        : [];

      const filteredHostCars = sortRecruitCars(filterRecruitCars(hostCars));
      const filteredNonHostCars = sortRecruitCars(
        filterRecruitCars(mergeCars([rolePlayerCars, relationAssistCars]))
      );

      const nonHostIds = new Set(filteredNonHostCars.map(function (car) { return car.id; }));
      const exclusiveHostCars = filteredHostCars.filter(function (car) {
        return car && !nonHostIds.has(car.id);
      });

      /* Keep All complete. Classification must never delete the recovered history. */
      const allCars = sortRecruitCars(
        filterRecruitCars(mergeCars([historicalCars, relationAssistCars]))
      );

      if (window.JLYRecruitBatchShare && typeof window.JLYRecruitBatchShare.setCars === "function") {
        window.JLYRecruitBatchShare.setCars(allCars);
      }

      if (window.JLYRecruitTabs && typeof window.JLYRecruitTabs.init === "function") {
        window.JLYRecruitTabs.init({
          onChange: function (cars) {
            render.renderPage(container, cars);
          }
        });

        window.JLYRecruitTabs.setCarGroups({
          all: allCars,
          host: exclusiveHostCars,
          assist: filteredNonHostCars
        });
        window.JLYRecruitTabs.setTab("all");
        return;
      }

      render.renderPage(container, allCars);
    } catch (error) {
      console.error("載入個人揪團頁失敗：", error);
      render.renderError(
        container,
        error && error.message ? error.message : "讀取失敗"
      );
    }
  }

  document.addEventListener("DOMContentLoaded", initRecruitPage);

  window.JLYRecruitController = {
    init: initRecruitPage
  };
})();