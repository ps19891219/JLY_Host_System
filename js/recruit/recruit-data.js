console.log(
  "recruit-data.js 已成功載入！"
);

(function () {
  "use strict";

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

  function getProfileIdentityIds(profile) {
    const source = profile && typeof profile === "object" ? profile : {};
    return uniqueIds([
      source.id,
      source.playerId,
      source.profileId,
      source.personId,
      source.identityId,
      source.memberId,
      source.canonicalPersonId,
      source.canonicalProfileId,
      source.canonicalMemberId,
      source.mergedIntoPersonId,
      source.mergedIntoProfileId,
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

    const snapshot = await getDb()
      .collection("recruitPages")
      .doc(normalizedToken)
      .get();

    if (!snapshot.exists) return null;
    return { token: snapshot.id, ...snapshot.data() };
  }

  async function resolveOwnerIdentityIds(ownerId) {
    const normalizedOwnerId = normalizeText(ownerId);
    if (!normalizedOwnerId) return [];

    const db = getDb();
    const ids = new Set();
    const queue = [];
    const checked = new Set();
    const reverseFields = [
      "identityId", "personId", "profileId", "playerId", "memberId",
      "canonicalPersonId", "canonicalProfileId", "canonicalMemberId",
      "mergedIntoPersonId", "mergedIntoProfileId", "mergedIntoMemberId"
    ];

    function remember(value) {
      const normalized = normalizeText(value);
      if (!normalized || normalized.toLowerCase().startsWith("line:") || ids.has(normalized)) return;
      ids.add(normalized);
      queue.push(normalized);
    }

    function rememberProfile(snapshot) {
      if (!snapshot || !snapshot.exists) return;
      getProfileIdentityIds({ id: snapshot.id, ...(snapshot.data() || {}) }).forEach(remember);
    }

    remember(normalizedOwnerId);

    while (queue.length && checked.size < 80) {
      const id = queue.shift();
      if (!id || checked.has(id)) continue;
      checked.add(id);

      try {
        const aliasSnapshot = await db.collection("myCarViewAliases").doc(id).get();
        if (aliasSnapshot.exists) remember((aliasSnapshot.data() || {}).viewerId);
      } catch (error) {
        console.warn("Recruit owner alias lookup skipped:", id, error);
      }

      try {
        rememberProfile(await db.collection("players").doc(id).get());
      } catch (error) {
        console.warn("Recruit owner direct profile lookup skipped:", id, error);
      }

      for (const field of reverseFields) {
        try {
          const snapshot = await db.collection("players").where(field, "==", id).limit(10).get();
          snapshot.docs.forEach(rememberProfile);
        } catch (error) {
          console.warn("Recruit owner reverse profile lookup skipped:", field, id, error);
        }
      }

      try {
        const linkedSnapshot = await db.collection("players")
          .where("linkedPlayerIds", "array-contains", id).limit(10).get();
        linkedSnapshot.docs.forEach(rememberProfile);
      } catch (error) {
        console.warn("Recruit owner linkedPlayerIds lookup skipped:", id, error);
      }
    }

    return uniqueIds(Array.from(ids));
  }

  async function getHostCarsFromMyCarViews(viewerIds) {
    const db = getDb();
    const ids = uniqueIds(viewerIds);
    const carsById = new Map();

    await Promise.all(ids.map(async function (viewerId) {
      try {
        const snapshot = await db.collection("myCarViews").doc(viewerId).get();
        if (!snapshot.exists) return;

        const view = snapshot.data() || {};
        if (view.viewType !== "mycar_index" || !Array.isArray(view.cars)) return;

        view.cars.forEach(function (car) {
          if (!car || car.isHost !== true) return;
          const carId = normalizeText(car.id || car.carId);
          if (!carId) return;
          carsById.set(carId, { ...car, id: carId, preparedRead: true });
        });
      } catch (error) {
        console.warn("Recruit MyCar prepared-view lookup skipped:", viewerId, error);
      }
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
      Recruit list is a read model. The MyCar Prepared View already contains
      the compact card snapshots and canonical host/player projection, so the
      normal list path must return those snapshots directly. Never hydrate the
      IDs back from cars Core here. Core reads belong to detail/edit/mutation
      paths or an explicit repair/bootstrap operation only.
    */
    return getHostCarsFromMyCarViews(ownerIdentityIds);
  }

  window.JLYRecruitData = {
    getShareToken,
    getRecruitPageByToken,
    resolveOwnerIdentityIds,
    getHostCarsFromMyCarViews,
    getHostCarIdsFromMyCarViews,
    getRecruitCarsByOwner
  };
})();
