console.log(
  "recruit-data.js 已成功載入！"
);

(function () {
  "use strict";

  const TARGET_SCHEMA = 6;
  const preparedViewCache = new Map();
  const preparedCarCache = new Map();
  const aliasCache = new Map();
  const migrationCache = new Map();

  function getDb() {
    if (!window.db) throw new Error("Firebase 尚未初始化");
    return window.db;
  }

  function normalizeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function uniqueIds(values) {
    return Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map(normalizeText)
        .filter(function (value) {
          return value && !value.toLowerCase().startsWith("line:");
        })
    ));
  }

  function getShareToken() {
    return normalizeText(new URLSearchParams(location.search).get("t"));
  }

  async function getRecruitPageByToken(token) {
    const normalizedToken = normalizeText(token);
    if (!normalizedToken) return null;
    const snapshot = await getDb().collection("recruitPages").doc(normalizedToken).get();
    if (!snapshot.exists) return null;
    return { token: snapshot.id, ...snapshot.data() };
  }

  async function resolveViewerId(aliasId) {
    const normalizedAliasId = normalizeText(aliasId);
    if (!normalizedAliasId) return "";
    if (aliasCache.has(normalizedAliasId)) return aliasCache.get(normalizedAliasId);

    let viewerId = normalizedAliasId;
    try {
      const snapshot = await getDb().collection("myCarViewAliases").doc(normalizedAliasId).get();
      if (snapshot.exists) {
        viewerId = normalizeText((snapshot.data() || {}).viewerId) || normalizedAliasId;
      }
    } catch (error) {
      console.warn("Recruit prepared alias lookup skipped:", normalizedAliasId, error);
    }

    aliasCache.set(normalizedAliasId, viewerId);
    return viewerId;
  }

  async function readPreparedView(viewerId, options) {
    const id = normalizeText(viewerId);
    if (!id) return null;
    const force = options && options.force === true;
    if (!force && preparedViewCache.has(id)) return preparedViewCache.get(id);

    let view = null;
    try {
      const snapshot = await getDb().collection("myCarViews").doc(id).get();
      if (snapshot.exists) {
        const data = snapshot.data() || {};
        if (data.viewType === "mycar_index" && Array.isArray(data.cars)) view = data;
      }
    } catch (error) {
      console.warn("Recruit MyCar prepared-view lookup skipped:", id, error);
    }

    preparedViewCache.set(id, view);
    return view;
  }

  function needsSchemaUpgrade(view) {
    if (!view) return false;
    if (Number(view.schemaVersion || 0) < TARGET_SCHEMA) return true;
    return (Array.isArray(view.cars) ? view.cars : []).some(function (car) {
      return car && car.isHost === true && !normalizeText(car.visibility);
    });
  }

  function mergeCoreIntoPrepared(preparedCar, coreCar) {
    const oldCar = preparedCar && typeof preparedCar === "object" ? preparedCar : {};
    const core = coreCar && typeof coreCar === "object" ? coreCar : {};
    return {
      ...oldCar,
      id: normalizeText(oldCar.id || oldCar.carId || core.id),
      scriptName: normalizeText(core.scriptName || core.title || core.name || oldCar.scriptName),
      gameDate: normalizeText(core.gameDate || core.date || oldCar.gameDate),
      gameTime: normalizeText(core.gameTime || core.time || oldCar.gameTime),
      status: normalizeText(core.status || oldCar.status),
      planningStatus: normalizeText(core.planningStatus || oldCar.planningStatus),
      visibility: normalizeText(core.visibility || oldCar.visibility),
      studioName: normalizeText(core.studioName || core.studio || oldCar.studioName),
      organizerName: normalizeText(core.organizerName || core.groupName || oldCar.organizerName),
      locationName: normalizeText(core.locationName || oldCar.locationName),
      location: normalizeText(core.location || core.address || core.placeName || oldCar.location),
      dmName: normalizeText(core.dmName || oldCar.dmName),
      coverImageUrl: normalizeText(core.coverImageUrl || oldCar.coverImageUrl),
      scriptCoverUrl: normalizeText(core.scriptCoverUrl || oldCar.scriptCoverUrl),
      scriptImageUrl: normalizeText(core.scriptImageUrl || oldCar.scriptImageUrl),
      price: Number(core.price || core.amount || oldCar.price || 0),
      totalPeople: Number(core.totalPeople || oldCar.totalPeople || 0),
      maleSlots: Number(core.maleSlots || oldCar.maleSlots || 0),
      femaleSlots: Number(core.femaleSlots || oldCar.femaleSlots || 0),
      flexibleSlots: Number(core.flexibleSlots || core.flexSlots || oldCar.flexibleSlots || 0),
      players: Array.isArray(core.players) ? core.players.map(function (player) {
        return {
          playerId: normalizeText(player && (player.playerId || player.id || player.profileId)),
          position: normalizeText(player && player.position),
          status: normalizeText(player && player.status)
        };
      }) : (Array.isArray(oldCar.players) ? oldCar.players : []),
      tags: Array.isArray(core.tags) ? core.tags : (Array.isArray(oldCar.tags) ? oldCar.tags : []),
      scriptTags: Array.isArray(core.scriptTags) ? core.scriptTags : (Array.isArray(oldCar.scriptTags) ? oldCar.scriptTags : []),
      myRole: normalizeText(core.myRole || oldCar.myRole).toLowerCase(),
      updatedAt: core.updatedAt || oldCar.updatedAt || null,
      createdAt: core.createdAt || oldCar.createdAt || null,
      // Participant classification is already canonical in the existing view.
      // A schema migration must enrich the snapshot, never reclassify it.
      isHost: oldCar.isHost === true,
      isPlayer: oldCar.isPlayer === true,
      role: oldCar.isHost === true ? "host" : (oldCar.isPlayer === true ? "player" : normalizeText(oldCar.role)),
      ownerType: oldCar.ownerType || (oldCar.isHost === true ? "self" : "")
    };
  }

  async function upgradePreparedView(viewerId, view) {
    const id = normalizeText(viewerId);
    if (!id || !view || !needsSchemaUpgrade(view)) return view;
    if (migrationCache.has(id)) return migrationCache.get(id);

    const task = (async function () {
      const cars = Array.isArray(view.cars) ? view.cars : [];
      const ids = uniqueIds(cars.map(function (car) { return car && (car.id || car.carId); }));
      if (!ids.length) return view;

      // Explicit one-time migration only. Normal Recruit reads remain Prepared-View-only.
      const coreCars = await Promise.all(ids.map(async function (carId) {
        const snapshot = await getDb().collection("cars").doc(carId).get();
        return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
      }));
      const coreById = new Map(coreCars.filter(Boolean).map(function (car) { return [car.id, car]; }));
      const missingIds = ids.filter(function (carId) { return !coreById.has(carId); });
      if (missingIds.length) {
        console.warn("Recruit schema migration aborted: Core rows missing", missingIds);
        return view;
      }

      const nextCars = cars.map(function (car) {
        const carId = normalizeText(car && (car.id || car.carId));
        return mergeCoreIntoPrepared(car, coreById.get(carId));
      });
      const next = {
        ...view,
        schemaVersion: TARGET_SCHEMA,
        cars: nextCars,
        counts: {
          all: nextCars.length,
          host: nextCars.filter(function (car) { return car.isHost === true; }).length,
          player: nextCars.filter(function (car) { return car.isPlayer === true; }).length
        },
        upgradedFromSchemaVersion: Number(view.schemaVersion || 0),
        schemaUpgradedAt: new Date().toISOString(),
        schemaUpgradeSource: "recruit-explicit-gate"
      };

      await getDb().collection("myCarViews").doc(id).set(next);
      preparedViewCache.set(id, next);
      console.log("✅ Recruit Prepared View one-time schema upgrade complete", id, nextCars.length);
      return next;
    })().finally(function () {
      migrationCache.delete(id);
    });

    migrationCache.set(id, task);
    return task;
  }

  async function readPreparedCar(carId) {
    const id = normalizeText(carId);
    if (!id) return null;
    if (preparedCarCache.has(id)) return preparedCarCache.get(id);

    let car = null;
    try {
      const snapshot = await getDb().collection("carDetailViews").doc(id).get();
      if (snapshot.exists) {
        const data = snapshot.data() || {};
        if (data.car && typeof data.car === "object") car = { ...data.car, id, preparedRead: true };
      }
    } catch (error) {
      console.warn("Recruit prepared car-detail lookup skipped:", id, error);
    }
    preparedCarCache.set(id, car);
    return car;
  }

  async function getPreparedCarsByIds(carIds) {
    const cars = await Promise.all(uniqueIds(carIds).map(readPreparedCar));
    return cars.filter(Boolean);
  }

  async function resolveOwnerIdentityIds(ownerId) {
    const normalizedOwnerId = normalizeText(ownerId);
    if (!normalizedOwnerId) return [];
    const viewerId = await resolveViewerId(normalizedOwnerId);
    let view = await readPreparedView(viewerId);
    if (view && needsSchemaUpgrade(view)) view = await upgradePreparedView(viewerId, view);
    return uniqueIds([
      normalizedOwnerId,
      viewerId,
      ...(view && Array.isArray(view.identityIds) ? view.identityIds : [])
    ]);
  }

  async function getHostCarsFromMyCarViews(viewerIds) {
    const requestedIds = uniqueIds(viewerIds);
    const viewerIds = uniqueIds(await Promise.all(requestedIds.map(function (id) { return resolveViewerId(id); })));
    const carsById = new Map();

    await Promise.all(viewerIds.map(async function (viewerId) {
      let view = await readPreparedView(viewerId);
      if (view && needsSchemaUpgrade(view)) view = await upgradePreparedView(viewerId, view);
      if (!view) return;
      view.cars.forEach(function (car) {
        if (!car || car.isHost !== true) return;
        const carId = normalizeText(car.id || car.carId);
        if (!carId) return;
        carsById.set(carId, { ...car, id: carId, preparedRead: true });
      });
    }));
    return Array.from(carsById.values());
  }

  async function getHostCarIdsFromMyCarViews(viewerIds) {
    return (await getHostCarsFromMyCarViews(viewerIds)).map(function (car) { return car.id; });
  }

  async function getRecruitCarsByOwner(ownerId) {
    const ownerIdentityIds = await resolveOwnerIdentityIds(ownerId);
    if (ownerIdentityIds.length === 0) return [];
    return getHostCarsFromMyCarViews(ownerIdentityIds);
  }

  window.JLYRecruitData = {
    getShareToken,
    getRecruitPageByToken,
    resolveViewerId,
    readPreparedView,
    needsSchemaUpgrade,
    upgradePreparedView,
    readPreparedCar,
    getPreparedCarsByIds,
    resolveOwnerIdentityIds,
    getHostCarsFromMyCarViews,
    getHostCarIdsFromMyCarViews,
    getRecruitCarsByOwner
  };
})();