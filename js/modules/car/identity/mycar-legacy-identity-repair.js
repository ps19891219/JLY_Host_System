(function () {
  "use strict";

  const REVISION = 5;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function unique(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean)));
  }

  async function getIdentityContext() {
    const identity = window.JLYIdentity;
    if (!identity) throw new Error("JLY Identity 尚未載入");

    const profileId = typeof identity.getCurrentPlayerProfileId === "function"
      ? text(identity.getCurrentPlayerProfileId())
      : text(localStorage.getItem("currentPlayerProfileId"));

    if (profileId && window.db && typeof identity.syncFromPlayerProfile === "function") {
      await identity.syncFromPlayerProfile(window.db, profileId);
    }

    const viewerId = typeof identity.getCurrentPlayerId === "function"
      ? text(identity.getCurrentPlayerId())
      : text(localStorage.getItem("currentPlayerId"));

    const identityIds = typeof identity.getAllPlayerIdentityIds === "function"
      ? unique(identity.getAllPlayerIdentityIds())
      : unique([viewerId, profileId]);

    if (!viewerId) throw new Error("尚未取得 JLY 使用者身分");

    return {
      viewerId,
      profileId,
      identityIds: unique([viewerId, profileId, ...identityIds])
    };
  }

  async function rebuild() {
    if (!window.JLYCarData) throw new Error("Car Data 尚未載入");
    if (typeof window.ensureMyCarViewModule !== "function") {
      throw new Error("MyCar View Runtime 尚未載入");
    }

    const context = await getIdentityContext();
    const viewModule = await window.ensureMyCarViewModule();
    const carMap = new Map();

    for (const id of context.identityIds) {
      const hostCars = await window.JLYCarData.getCarsByOwner(id);
      hostCars.forEach(car => carMap.set(car.id, car));
    }

    const playerCars = await window.JLYCarData.getCarsByPlayerId(
      context.profileId || context.viewerId
    );
    playerCars.forEach(car => carMap.set(car.id, car));

    const view = viewModule.buildView({
      viewerId: context.viewerId,
      identityIds: context.identityIds,
      cars: Array.from(carMap.values())
    });

    view.identityResolutionRevision = REVISION;
    view.identityResolvedAt = new Date().toISOString();
    view.identityRepairSource = "known-good-car-data-path";

    await viewModule.write(view);
    return view;
  }

  async function run() {
    try {
      const view = await rebuild();
      console.log("✅ MyCar 歷史 Identity Repair 完成", {
        host: view.counts && view.counts.host || 0,
        player: view.counts && view.counts.player || 0,
        all: view.counts && view.counts.all || 0
      });

      if (typeof window.resetMyCarPagination === "function") {
        window.resetMyCarPagination();
      }
      if (typeof window.renderMyCars === "function") {
        await window.renderMyCars({ restoreScroll: false });
      }
    } catch (error) {
      console.error("MyCar 歷史 Identity Repair 失敗：", error);
    }
  }

  window.JLYMyCarLegacyIdentityRepair = { REVISION, getIdentityContext, rebuild, run };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(run, 0); });
  } else {
    setTimeout(run, 0);
  }
})();
