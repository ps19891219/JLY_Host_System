(function () {
  "use strict";

  const TARGET_SCHEMA = 6;
  let runPromise = null;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function unique(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean)));
  }

  function getViewerId() {
    const identity = window.JLYIdentity;
    if (identity && typeof identity.getCurrentPlayerId === "function") {
      return text(identity.getCurrentPlayerId());
    }
    return text(localStorage.getItem("currentPlayerId"));
  }

  async function upgrade() {
    if (typeof window.ensureMyCarViewModule !== "function") {
      return { ok: false, skipped: "view_module_unavailable" };
    }
    if (!window.JLYCarData || typeof window.JLYCarData.getCarsByIds !== "function") {
      return { ok: false, skipped: "car_data_unavailable" };
    }

    const viewerId = getViewerId();
    if (!viewerId) return { ok: false, skipped: "viewer_missing" };

    const mod = await window.ensureMyCarViewModule();
    const current = await mod.read(viewerId);
    if (!current) return { ok: false, skipped: "view_missing" };
    if (Number(current.schemaVersion || 0) >= TARGET_SCHEMA) {
      return { ok: true, skipped: "already_current", view: current };
    }

    const carIds = unique(
      (Array.isArray(current.cars) ? current.cars : []).map(function (car) {
        return car && (car.id || car.carId);
      })
    );

    if (!carIds.length) {
      return { ok: false, skipped: "no_prepared_car_ids" };
    }

    /*
      Migration reads only the cars already indexed by the existing Prepared
      View. It never scans the cars collection and never rediscovers identity.
      This is a one-time schema upgrade so Recruit can safely read visibility
      and other card fields from the Prepared View afterwards.
    */
    const cars = await window.JLYCarData.getCarsByIds(carIds);
    const foundIds = new Set((cars || []).map(function (car) { return text(car && car.id); }).filter(Boolean));
    const missingIds = carIds.filter(function (id) { return !foundIds.has(id); });

    if (missingIds.length) {
      console.warn("MyCar Prepared View upgrade aborted because Core rows are missing", missingIds);
      return { ok: false, skipped: "core_rows_missing", missingIds: missingIds };
    }

    const identityIds = unique([
      viewerId,
      ...(Array.isArray(current.identityIds) ? current.identityIds : [])
    ]);
    const next = mod.buildView({ viewerId: viewerId, identityIds: identityIds, cars: cars });
    next.identityResolutionRevision = current.identityResolutionRevision || 13;
    next.identityResolvedAt = current.identityResolvedAt || null;
    next.identityRepairSource = current.identityRepairSource || "prepared-view-schema-upgrade";
    next.upgradedFromSchemaVersion = Number(current.schemaVersion || 0);
    next.schemaUpgradedAt = new Date().toISOString();

    await mod.write(next);
    console.log("✅ MyCar Prepared View schema upgraded", {
      from: current.schemaVersion,
      to: next.schemaVersion,
      cars: next.cars.length
    });
    return { ok: true, upgraded: true, view: next };
  }

  function run() {
    if (runPromise) return runPromise;
    runPromise = upgrade().finally(function () { runPromise = null; });
    return runPromise;
  }

  window.JLYMyCarPreparedViewUpgrade = {
    TARGET_SCHEMA: TARGET_SCHEMA,
    upgrade: upgrade,
    run: run
  };
})();