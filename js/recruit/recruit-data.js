console.log(
  "recruit-data.js 已成功載入！"
);

(function () {
  "use strict";

  const TARGET_SCHEMA = 6;
  const preparedViewCache = new Map();
  const preparedCarCache = new Map();
  const aliasCache = new Map();

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

  function getProfileIdentityIds(profile) {
    const source = profile && typeof profile === "object" ? profile : {};
    return uniqueIds([
      source.id, source.playerId, source.profileId, source.personId,
      source.identityId, source.memberId, source.canonicalPersonId,
      source.canonicalProfileId, source.canonicalMemberId,
      source.mergedIntoPersonId, source.mergedIntoProfileId,
      source.mergedIntoMemberId,
      ...(Array.isArray(source.linkedPlayerIds) ? source.linkedPlayerIds : [])
    ]);
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

  async function resolveViewerId(aliasId) {
    const normalizedAliasId = normalizeText(aliasId);
    if (!normalizedAliasId) return "";
    if (aliasCache.has(normalizedAliasId)) return aliasCache.get(normalizedAliasId);

    let viewerId = normalizedAliasId;
    try {
      const snapshot = await getDb().collection("myCarViewAliases").doc(normalizedAliasId).get();
      if (snapshot.exists) viewerId = normalizeText((snapshot.data() || {}).viewerId) || normalizedAliasId;
    } catch (error) {
      console.warn("Recruit prepared alias lookup skipped:", normalizedAliasId, error);
    }

    aliasCache.set(normalizedAliasId, viewerId);
    return viewerId;
  }

  function needsSchemaUpgrade(view) {
    if (!view) return false;
    if (Number(view.schemaVersion || 0) < TARGET_SCHEMA) return true;
    return (Array.isArray(view.cars) ? view.cars : []).some(function (car) {
      return car && car.isHost === true && !normalizeText(car.visibility);
    });
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
    return uniqueIds([
      normalizedOwnerId,
      viewerId,
      ...(view && Array.isArray(view.identityIds) ? view.identityIds : [])
    ]);
  }

  async function getHostCarsFromMyCarViews(viewerIds) {
    const requestedIds = uniqueIds(viewerIds);
    const resolvedViewerIds = uniqueIds(await Promise.all(requestedIds.map(function (id) { return resolveViewerId(id); })));
    const carsById = new Map();

    await Promise.all(resolvedViewerIds.map(async function (viewerId) {
      let view = await readPreparedView(viewerId);
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
    readPreparedCar,
    getPreparedCarsByIds,
    resolveOwnerIdentityIds,
    getHostCarsFromMyCarViews,
    getHostCarIdsFromMyCarViews,
    getRecruitCarsByOwner
  };
})();