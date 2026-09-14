(function () {
  "use strict";

  const REVISION = 3;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function unique(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean)));
  }

  function chunk(values, size) {
    const result = [];
    for (let index = 0; index < values.length; index += size) {
      result.push(values.slice(index, index + size));
    }
    return result;
  }

  async function refreshIdentity() {
    const identity = window.JLYIdentity;
    if (!identity) throw new Error("JLY Identity 尚未載入");

    const profileId = typeof identity.getCurrentPlayerProfileId === "function"
      ? text(identity.getCurrentPlayerProfileId())
      : text(localStorage.getItem("currentPlayerProfileId"));

    if (
      profileId &&
      window.db &&
      typeof identity.syncFromPlayerProfile === "function"
    ) {
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
      canonicalOwnerId: profileId || viewerId,
      identityIds: unique([viewerId, profileId, ...identityIds])
    };
  }

  async function fetchHostCars(identityIds) {
    const map = new Map();
    for (const ownerId of unique(identityIds)) {
      const snapshot = await window.db
        .collection("cars")
        .where("ownerId", "==", ownerId)
        .get();

      snapshot.docs.forEach(function (doc) {
        map.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
      });
    }
    return map;
  }

  async function fetchPlayerCars(identityIds) {
    const map = new Map();
    for (const ids of chunk(unique(identityIds), 10)) {
      if (!ids.length) continue;
      const snapshot = await window.db
        .collection("cars")
        .where("playerIds", "array-contains-any", ids)
        .get();

      snapshot.docs.forEach(function (doc) {
        map.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
      });
    }
    return map;
  }

  async function fetchExistingPreparedCars(view) {
    const ids = unique(
      Array.isArray(view?.cars)
        ? view.cars.map(car => car && (car.id || car.carId))
        : []
    );

    const map = new Map();
    for (const carId of ids) {
      const snapshot = await window.db.collection("cars").doc(carId).get();
      if (snapshot.exists) {
        map.set(snapshot.id, { id: snapshot.id, ...(snapshot.data() || {}) });
      }
    }
    return map;
  }

  async function migrateHostOwnerIds(hostMap, identity) {
    const canonicalOwnerId = text(identity?.canonicalOwnerId);
    const identitySet = new Set(unique(identity?.identityIds));

    if (!canonicalOwnerId || !hostMap || typeof hostMap.forEach !== "function") {
      return 0;
    }

    const updates = [];

    hostMap.forEach(function (car, carId) {
      const ownerId = text(car?.ownerId);
      if (!ownerId || ownerId === canonicalOwnerId || !identitySet.has(ownerId)) {
        return;
      }

      updates.push(
        window.db.collection("cars").doc(carId).update({
          ownerId: canonicalOwnerId,
          updatedAt: new Date().toISOString()
        }).then(function () {
          car.ownerId = canonicalOwnerId;
        })
      );
    });

    await Promise.all(updates);
    return updates.length;
  }

  async function loadAliasModule() {
    if (window.JLYMyCarViewAlias) return window.JLYMyCarViewAlias;

    await new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = "/js/data-view/mycar-view-alias.js?v=2";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return window.JLYMyCarViewAlias || null;
  }

  async function rebuildCurrentView() {
    if (!window.db) throw new Error("Firebase 尚未載入");
    if (typeof window.ensureMyCarViewModule !== "function") {
      throw new Error("MyCar View Runtime 尚未載入");
    }

    const identity = await refreshIdentity();
    const module = await window.ensureMyCarViewModule();
    const existingView = await module.read(identity.viewerId);

    const [hostMap, playerMap, preparedMap] = await Promise.all([
      fetchHostCars(identity.identityIds),
      fetchPlayerCars(identity.identityIds),
      fetchExistingPreparedCars(existingView)
    ]);

    const migratedOwnerCount = await migrateHostOwnerIds(hostMap, identity);

    const carMap = new Map();
    [preparedMap, hostMap, playerMap].forEach(function (source) {
      source.forEach(function (car, carId) {
        carMap.set(carId, car);
      });
    });

    const nextView = module.buildView({
      viewerId: identity.viewerId,
      identityIds: unique([
        ...identity.identityIds,
        identity.canonicalOwnerId
      ]),
      cars: Array.from(carMap.values())
    });

    nextView.identityResolutionRevision = REVISION;
    nextView.identityResolvedAt = new Date().toISOString();
    nextView.currentProfileId = identity.profileId || "";
    nextView.canonicalOwnerId = identity.canonicalOwnerId || "";
    nextView.migratedOwnerCount = migratedOwnerCount;

    await module.write(nextView);

    try {
      const alias = await loadAliasModule();
      if (alias && typeof alias.registerAliases === "function") {
        await alias.registerAliases(identity.viewerId, unique([
          ...identity.identityIds,
          identity.canonicalOwnerId
        ]));
      }
    } catch (error) {
      console.warn("MyCar Identity Alias 更新失敗：", error);
    }

    return nextView;
  }

  async function run() {
    try {
      const nextView = await rebuildCurrentView();

      console.log("✅ MyCar Identity Resolution 完成", {
        viewerId: nextView.viewerId,
        identityIds: nextView.identityIds,
        canonicalOwnerId: nextView.canonicalOwnerId,
        migratedOwnerCount: nextView.migratedOwnerCount,
        hostCount: nextView.counts?.host || 0,
        playerCount: nextView.counts?.player || 0
      });

      if (typeof window.resetMyCarPagination === "function") {
        window.resetMyCarPagination();
      }

      if (typeof window.renderMyCars === "function") {
        await window.renderMyCars({ restoreScroll: false });
      }
    } catch (error) {
      console.error("MyCar Identity Resolution 失敗：", error);
    }
  }

  window.JLYMyCarIdentityRuntime = {
    REVISION,
    refreshIdentity,
    rebuildCurrentView,
    run
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(run, 0);
    });
  } else {
    setTimeout(run, 0);
  }
})();
