console.log("recruit-controller.js 已成功載入！");

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
      return render.getStatus(car) === "招募中" && String(car.visibility || "").trim() === "public";
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

  async function getAssistCarIds(data, ownerId) {
    if (!window.JLYCarRelations || typeof window.JLYCarRelations.getAssistRecruitingCarIds !== "function") return [];

    const identityIds = typeof data.resolveOwnerIdentityIds === "function"
      ? await data.resolveOwnerIdentityIds(ownerId)
      : [ownerId];

    const groups = await Promise.all(identityIds.map(function (identityId) {
      return window.JLYCarRelations.getAssistRecruitingCarIds(identityId).catch(function () {
        return [];
      });
    }));

    return Array.from(new Set(groups.reduce(function (all, ids) {
      return all.concat(Array.isArray(ids) ? ids : []);
    }, [])));
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

      /* 保留已驗證成功的 MyCar Prepared View 歷史主揪鏈，不用 raw ownerId 二次過濾。 */
      const ownerCars = await data.getRecruitCarsByOwner(recruitPage.ownerId);
      const hostCars = Array.isArray(ownerCars) ? ownerCars : [];

      /* 協助揪團只沿用既有 carRelations.assistRecruiting=true，並涵蓋歷史 Identity aliases。 */
      const assistCarIds = await getAssistCarIds(data, recruitPage.ownerId);
      const assistCars = window.JLYCarData && typeof window.JLYCarData.getCarsByIds === "function"
        ? await window.JLYCarData.getCarsByIds(assistCarIds)
        : [];

      const filteredHostCars = sortRecruitCars(filterRecruitCars(hostCars));
      const hostCarIds = new Set(filteredHostCars.map(function (car) { return car.id; }));

      /* 主揪優先，同一台不重複列入「我協助的」。 */
      const filteredAssistCars = sortRecruitCars(filterRecruitCars(assistCars).filter(function (car) {
        return car && !hostCarIds.has(car.id);
      }));

      const allCars = sortRecruitCars(mergeCars([filteredHostCars, filteredAssistCars]));

      if (window.JLYRecruitBatchShare && typeof window.JLYRecruitBatchShare.setCars === "function") {
        window.JLYRecruitBatchShare.setCars(allCars);
      }

      if (window.JLYRecruitTabs && typeof window.JLYRecruitTabs.init === "function") {
        window.JLYRecruitTabs.init({
          onChange: function (cars) {
            render.renderPage(container, cars);
          }
        });
        window.JLYRecruitTabs.setCarGroups({ all: allCars, host: filteredHostCars, assist: filteredAssistCars });
        window.JLYRecruitTabs.setTab("all");
        return;
      }

      render.renderPage(container, allCars);
    } catch (error) {
      console.error("載入個人揪團頁失敗：", error);
      render.renderError(container, error && error.message ? error.message : "讀取失敗");
    }
  }

  document.addEventListener("DOMContentLoaded", initRecruitPage);
  window.JLYRecruitController = { init: initRecruitPage };
})();
