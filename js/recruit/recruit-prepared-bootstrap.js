console.log("recruit-prepared-bootstrap.js 已成功載入！");

(function () {
  "use strict";

  const data = window.JLYRecruitData;
  if (!data || typeof data.getRecruitCarsByOwner !== "function") return;

  const originalGetRecruitCarsByOwner = data.getRecruitCarsByOwner.bind(data);
  const bootstrapCache = new Map();

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function unique(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(function (id) {
      return id && !id.toLowerCase().startsWith("line:");
    })));
  }

  function isHostRole(car) {
    const role = text(car && car.myRole).toLowerCase();
    if (role === "host") return true;
    if (role === "player" || role === "favorite") return false;
    if (car && car.isPlayer === true && car.isHost !== true) return false;
    return true;
  }

  function compact(car) {
    const source = car || {};
    return {
      id: text(source.id || source.carId),
      scriptName: text(source.scriptName || source.title || source.name),
      gameDate: text(source.gameDate || source.date),
      gameTime: text(source.gameTime || source.time),
      status: text(source.status),
      planningStatus: text(source.planningStatus),
      visibility: text(source.visibility),
      studioName: text(source.studioName || source.studio),
      organizerName: text(source.organizerName || source.groupName),
      locationName: text(source.locationName),
      location: text(source.location || source.address || source.placeName),
      dmName: text(source.dmName),
      coverImageUrl: text(source.coverImageUrl),
      scriptCoverUrl: text(source.scriptCoverUrl),
      scriptImageUrl: text(source.scriptImageUrl),
      price: Number(source.price || source.amount || 0),
      totalPeople: Number(source.totalPeople || 0),
      maleSlots: Number(source.maleSlots || 0),
      femaleSlots: Number(source.femaleSlots || 0),
      flexibleSlots: Number(source.flexibleSlots || source.flexSlots || 0),
      players: Array.isArray(source.players) ? source.players.map(function (player) {
        return {
          playerId: text(player && (player.playerId || player.id || player.profileId)),
          position: text(player && player.position),
          status: text(player && player.status)
        };
      }) : [],
      tags: Array.isArray(source.tags) ? source.tags : [],
      scriptTags: Array.isArray(source.scriptTags) ? source.scriptTags : [],
      ownerId: text(source.ownerId),
      myRole: text(source.myRole).toLowerCase(),
      isHost: true,
      isPlayer: false,
      role: "host",
      ownerType: "self",
      updatedAt: source.updatedAt || null,
      createdAt: source.createdAt || null,
      preparedRead: true
    };
  }

  async function bootstrap(ownerId) {
    const seed = text(ownerId);
    if (!seed) return [];
    if (bootstrapCache.has(seed)) return bootstrapCache.get(seed);

    const task = (async function () {
      const db = window.db;
      if (!db) return [];

      const identityIds = typeof data.resolveOwnerIdentityIds === "function"
        ? await data.resolveOwnerIdentityIds(seed)
        : [seed];
      const ids = unique([seed].concat(identityIds || []));
      if (!ids.length) return [];

      // Explicit repair/bootstrap only: bounded exact ownerId queries, never a cars collection scan.
      const snapshots = await Promise.all(ids.map(function (id) {
        return db.collection("cars").where("ownerId", "==", id).get().catch(function (error) {
          console.warn("Recruit bounded owner bootstrap skipped:", id, error);
          return null;
        });
      }));

      const byId = new Map();
      snapshots.filter(Boolean).forEach(function (snapshot) {
        snapshot.docs.forEach(function (doc) {
          const car = { id: doc.id, ...(doc.data() || {}) };
          if (isHostRole(car)) byId.set(doc.id, car);
        });
      });
      const coreCars = Array.from(byId.values());
      if (!coreCars.length) return [];

      const preparedCars = coreCars.map(compact);
      const viewerId = typeof data.resolveViewerId === "function"
        ? (await data.resolveViewerId(seed)) || seed
        : seed;
      const now = new Date().toISOString();
      const view = {
        viewType: "mycar_index",
        schemaVersion: 6,
        viewerId: viewerId,
        identityIds: unique([viewerId].concat(ids)),
        cars: preparedCars,
        counts: { all: preparedCars.length, host: preparedCars.length, player: 0 },
        updatedAt: now,
        identityRepairSource: "recruit-bounded-owner-bootstrap",
        schemaUpgradeSource: "recruit-bounded-owner-bootstrap"
      };

      // Persist the recovered index when rules allow it. Even if persistence is denied,
      // this one repair load can still render from the bounded result instead of staying blank.
      try {
        await db.collection("myCarViews").doc(viewerId).set(view);
        await Promise.all(view.identityIds.map(function (aliasId) {
          return db.collection("myCarViewAliases").doc(aliasId).set({
            schemaVersion: 1,
            aliasId: aliasId,
            viewerId: viewerId,
            updatedAt: now,
            repairSource: "recruit-bounded-owner-bootstrap"
          }, { merge: false });
        }));
        console.log("✅ Recruit missing Prepared View bootstrapped", viewerId, preparedCars.length);
      } catch (error) {
        console.warn("Recruit Prepared View bootstrap persistence skipped:", error);
      }

      return coreCars;
    })();

    bootstrapCache.set(seed, task);
    return task;
  }

  data.getRecruitCarsByOwner = async function (ownerId) {
    const preparedCars = await originalGetRecruitCarsByOwner(ownerId);
    if (Array.isArray(preparedCars) && preparedCars.length) return preparedCars;
    return bootstrap(ownerId);
  };
})();
