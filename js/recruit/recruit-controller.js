console.log("recruit-controller.js 已成功載入！");

(function () {
  "use strict";

  let initPromise = null;
  let moduleRetryCount = 0;
  const MAX_MODULE_RETRIES = 20;

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

  function retryWhenModulesReady(container) {
    if (moduleRetryCount >= MAX_MODULE_RETRIES) {
      container.innerHTML = '<div class="recruit-error"><h2>揪團頁載入未完成</h2><p>資料模組沒有完成載入，請重新整理頁面。</p></div>';
      console.error("Recruit 模組載入逾時", {
        data: !!window.JLYRecruitData,
        render: !!window.JLYRecruitRender
      });
      return;
    }

    moduleRetryCount += 1;
    initPromise = null;
    window.setTimeout(initRecruitPage, 150);
  }

  async function runRecruitPage() {
    const container = getContainer();
    const data = window.JLYRecruitData;
    const render = window.JLYRecruitRender;

    if (!container) return;
    if (!data || !render) {
      container.innerHTML = '<div class="recruit-loading">正在載入揪團資料…</div>';
      retryWhenModulesReady(container);
      return;
    }

    moduleRetryCount = 0;
    render.renderLoading(container);

    try {
      const token = data.getShareToken();
      if (!token) return render.renderError(container, "缺少分享連結資訊。");

      const recruitPage = await data.getRecruitPageByToken(token);
      if (!recruitPage || !recruitPage.ownerId) {
        return render.renderError(container, "這個分享連結可能已失效。");
      }

      const ownerCars = await data.getRecruitCarsByOwner(recruitPage.ownerId);
      const hostCars = Array.isArray(ownerCars) ? ownerCars : [];
      const assistCarIds = window.JLYCarRelations && typeof window.JLYCarRelations.getAssistRecruitingCarIds === "function"
        ? await window.JLYCarRelations.getAssistRecruitingCarIds(recruitPage.ownerId)
        : [];

      const hostById = new Map(hostCars.filter(function (car) { return car && car.id; }).map(function (car) { return [car.id, car]; }));
      const assistCars = [];
      const missingAssistIds = [];
      (Array.isArray(assistCarIds) ? assistCarIds : []).forEach(function (carId) {
        if (hostById.has(carId)) assistCars.push(hostById.get(carId));
        else missingAssistIds.push(carId);
      });

      if (missingAssistIds.length && typeof data.getPreparedCarsByIds === "function") {
        assistCars.push(...(await data.getPreparedCarsByIds(missingAssistIds)));
      }

      const filteredHostCars = sortRecruitCars(filterRecruitCars(hostCars));
      const filteredAssistCars = sortRecruitCars(filterRecruitCars(assistCars));
      const allCars = sortRecruitCars(mergeCars([filteredHostCars, filteredAssistCars]));

      if (window.JLYRecruitBatchShare && typeof window.JLYRecruitBatchShare.setCars === "function") {
        window.JLYRecruitBatchShare.setCars(allCars);
      }

      if (window.JLYRecruitTabs && typeof window.JLYRecruitTabs.init === "function") {
        window.JLYRecruitTabs.init({ onChange: function (cars) { render.renderPage(container, cars); } });
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

  function initRecruitPage() {
    if (initPromise) return initPromise;
    initPromise = Promise.resolve().then(runRecruitPage).catch(function (error) {
      initPromise = null;
      throw error;
    });
    return initPromise;
  }

  window.JLYRecruitController = { init: initRecruitPage };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRecruitPage, { once: true });
  } else {
    initRecruitPage();
  }
})();
