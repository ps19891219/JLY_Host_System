console.log(
  "recruit-data.js 已成功載入！"
);

(function () {
  "use strict";

  const preparedViewCache = new Map();
  const aliasCache = new Map();

  function getDb() {
    if (!window.db) {
      throw new Error("Firebase 尚未初始化");
    }
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

    const snapshot = await getDb()
      .collection("recruitPages")
      .doc(normalizedToken)
      .get();

    if (!snapshot.exists) return null;
    return { token: snapshot.id, ...snapshot.data() };
  }

  async function resolveViewerId(aliasId) {
    const normalizedAliasId = normalizeText(aliasId);
    if (!normalizedAliasId) return "";
    if (aliasCache.has(normalizedAliasId)) return aliasCache.get(normalizedAliasId);

    let viewerId = normalizedAliasId;
    try {
      const snapshot = await getDb()
        .collection("myCarViewAliases")
        .doc(normalizedAliasId)
        .get();
      if (snapshot.exists) {
        viewerId = normalizeText((snapshot.data() || {}).viewerId) || normalizedAliasId;
      }
    } catch (error) {
      console.warn("Recruit prepared alias lookup skipped:", normalizedAliasId, error);
    }

    aliasCache.set(normalizedAliasId, viewerId);
    return viewerId;
  }

  async function readPreparedView(viewerId) {
    const id = normalizeText(viewerId);
    if (!id) return null;
    if (preparedViewCache.has(id)) return preparedViewCache.get(id);

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

  async function resolveOwnerIdentityIds(ownerId) {
    const normalizedOwnerId = normalizeText(ownerId);
    if (!normalizedOwnerId) return [];

    /*
      Identity aliases are already projected into myCarViewAliases and the
      Prepared View's identityIds. Recruit must not rediscover the same person
      by repeatedly querying every players identity field on page load.
    */
    const viewerId = await resolveViewerId(normalizedOwnerId);
    const view = await readPreparedView(viewerId);
    return uniqueIds([
      normalizedOwnerId,
      viewerId,
      ...(view && Array.isArray(view.identityIds) ? view.identityIds : [])
    ]);
  }

  async function getHostCarsFromMyCarViews(viewerIds) {
    const requestedIds = uniqueIds(viewerIds);
    const viewerIds = uniqueIds(await Promise.all(
      requestedIds.map(function (id) { return resolveViewerId(id); })
    ));
    const carsById = new Map();

    await Promise.all(viewerIds.map(async function (viewerId) {
      const view = await readPreparedView(viewerId);
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
    return (await getHostCarsFromMyCarViews(viewerIds)).map(function (car) {
      return car.id;
    });
  }

  async function getRecruitCarsByOwner(ownerId) {
    const ownerIdentityIds = await resolveOwnerIdentityIds(ownerId);
    if (ownerIdentityIds.length === 0) return [];

    /*
      Normal Recruit list rendering returns compact Prepared View snapshots
      directly. It never hydrates car IDs back from cars Core. Core reads are
      reserved for detail/edit/mutation or explicit repair/bootstrap flows.
    */
    return getHostCarsFromMyCarViews(ownerIdentityIds);
  }

  window.JLYRecruitData = {
    getShareToken,
    getRecruitPageByToken,
    resolveViewerId,
    readPreparedView,
    resolveOwnerIdentityIds,
    getHostCarsFromMyCarViews,
    getHostCarIdsFromMyCarViews,
    getRecruitCarsByOwner
  };
})();
