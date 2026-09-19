console.log("mycar-view.js V6 已成功載入！");

(function () {
  "use strict";

  const COLLECTION = "myCarViews";
  const SCHEMA_VERSION = 6;
  const CANCELLED = new Set(["已取消", "取消", "cancelled", "canceled"]);

  function getDb() {
    if (!window.db) throw new Error("Firebase 尚未初始化");
    return window.db;
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function compactPlayer(player) {
    const source = player && typeof player === "object" ? player : {};
    return {
      playerId: text(source.playerId || source.id || source.profileId),
      position: text(source.position || source.roleChoice || source.role),
      status: text(source.status)
    };
  }

  function normalizeSeatType(value) {
    const normalized = text(value).toLowerCase();
    if (["male", "m", "男", "男位", "boy"].includes(normalized)) return "male";
    if (["female", "f", "女", "女位", "girl"].includes(normalized)) return "female";
    return "flexible";
  }

  function preserveSeatSummary(summary) {
    const source = summary && typeof summary === "object" ? summary : null;
    if (!source) return null;
    const normalized = {
      totalSeatCount: Math.max(0, Number(source.totalSeatCount || 0)),
      occupiedSeatCount: Math.max(0, Number(source.occupiedSeatCount || 0)),
      maleTotal: Math.max(0, Number(source.maleTotal || 0)),
      maleOccupied: Math.max(0, Number(source.maleOccupied || 0)),
      femaleTotal: Math.max(0, Number(source.femaleTotal || 0)),
      femaleOccupied: Math.max(0, Number(source.femaleOccupied || 0)),
      flexibleTotal: Math.max(0, Number(source.flexibleTotal || 0)),
      flexibleOccupied: Math.max(0, Number(source.flexibleOccupied || 0)),
      waitingCount: Math.max(0, Number(source.waitingCount || 0))
    };
    return normalized.totalSeatCount > 0 || normalized.maleTotal > 0 || normalized.femaleTotal > 0 || normalized.flexibleTotal > 0
      ? normalized
      : null;
  }

  function buildSeatSummary(car) {
    const source = car && typeof car === "object" ? car : {};
    const slots = Array.isArray(source.slots) ? source.slots : [];
    if (!slots.length) return preserveSeatSummary(source.seatSummary);

    const activePlayerIds = new Set(
      (Array.isArray(source.players) ? source.players : [])
        .filter(player => !CANCELLED.has(text(player && player.status)))
        .map(player => text(player && (player.playerId || player.id || player.profileId || player.applicationId)))
        .filter(Boolean)
    );

    const summary = {
      totalSeatCount: 0,
      occupiedSeatCount: 0,
      maleTotal: 0,
      maleOccupied: 0,
      femaleTotal: 0,
      femaleOccupied: 0,
      flexibleTotal: 0,
      flexibleOccupied: 0,
      waitingCount: 0
    };

    slots.forEach(slot => {
      const safeSlot = slot && typeof slot === "object" ? slot : {};
      const sectionType = normalizeSeatType(safeSlot.originalType || safeSlot.sectionType || safeSlot.slotType || safeSlot.type);
      summary.totalSeatCount += 1;
      if (sectionType === "male") summary.maleTotal += 1;
      else if (sectionType === "female") summary.femaleTotal += 1;
      else summary.flexibleTotal += 1;

      const playerId = text(safeSlot.playerId);
      const occupied = Boolean(playerId) && (activePlayerIds.size === 0 || activePlayerIds.has(playerId));
      if (!occupied) return;
      summary.occupiedSeatCount += 1;
      if (sectionType === "male") summary.maleOccupied += 1;
      else if (sectionType === "female") summary.femaleOccupied += 1;
      else summary.flexibleOccupied += 1;
    });

    summary.waitingCount = Math.max(activePlayerIds.size - summary.occupiedSeatCount, 0);
    return summary;
  }

  // Role and ownership are intentionally separate.
  // ownerId grants ownership/management compatibility. It is not, by itself,
  // proof that the creator chose the host role. Explicit creation role wins.
  function resolveViewerRole(source, identitySet, players) {
    const ownerId = text(source.ownerId);
    const ownerMatches = Boolean(ownerId) && identitySet.has(ownerId);
    const myRole = text(source.myRole).toLowerCase();
    const explicitRole = ["host", "player", "favorite"].includes(myRole) ? myRole : "";

    const membershipPlayer = players.some(player =>
      player && identitySet.has(text(player.playerId)) && !CANCELLED.has(text(player.status))
    );

    let isHost = false;
    let isPlayer = membershipPlayer;

    if (ownerMatches) {
      if (explicitRole === "host") {
        isHost = true;
        isPlayer = false;
      } else if (explicitRole === "player") {
        isHost = false;
        isPlayer = true;
      } else if (explicitRole === "favorite") {
        isHost = false;
      } else if (source.isPlayer === true && source.isHost !== true) {
        isHost = false;
        isPlayer = true;
      } else if (source.isHost === true) {
        isHost = true;
        isPlayer = false;
      } else {
        // Legacy cars created before explicit role fields existed keep their
        // historical owner=>host interpretation so old MyCar records do not vanish.
        isHost = true;
        isPlayer = false;
      }
    }

    return { ownerId, isHost, isPlayer };
  }

  function compactCar(car, viewerIdentityIds) {
    const source = car && typeof car === "object" ? car : {};
    const identitySet = new Set((Array.isArray(viewerIdentityIds) ? viewerIdentityIds : []).map(text).filter(Boolean));
    const players = (Array.isArray(source.players) ? source.players : []).map(compactPlayer);
    const role = resolveViewerRole(source, identitySet, players);

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
      seatSummary: buildSeatSummary(source),
      players,
      tags: Array.isArray(source.tags) ? source.tags : [],
      scriptTags: Array.isArray(source.scriptTags) ? source.scriptTags : [],
      ownerId: role.ownerId,
      myRole: text(source.myRole).toLowerCase(),
      isHost: role.isHost,
      isPlayer: role.isPlayer,
      role: role.isHost ? "host" : (role.isPlayer ? "player" : ""),
      ownerType: role.isHost ? "self" : "",
      updatedAt: source.updatedAt || null,
      createdAt: source.createdAt || null
    };
  }

  function getDateTimeValue(car) {
    const date = text(car && car.gameDate) || "9999-12-31";
    const time = text(car && car.gameTime) || "23:59";
    const value = new Date(`${date}T${time}`).getTime();
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

  function isEnded(car) {
    const status = text(car && car.status);
    if (status === "已結束" || status === "已取消") return true;
    if (!text(car && car.gameDate)) return false;
    return getDateTimeValue(car) < Date.now();
  }

  function isPlanning(car) {
    const status = text(car && car.status);
    return status === "規劃中" || text(car && car.planningStatus) === "unscheduled" || !text(car && car.gameDate);
  }

  function sortCars(cars) {
    return [...(Array.isArray(cars) ? cars : [])].sort((a, b) => {
      function group(car) {
        if (isEnded(car)) return 2;
        if (isPlanning(car)) return 1;
        return 0;
      }
      const aGroup = group(a);
      const bGroup = group(b);
      if (aGroup !== bGroup) return aGroup - bGroup;
      if (aGroup === 1) {
        return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
      }
      return getDateTimeValue(a) - getDateTimeValue(b);
    });
  }

  function buildView(options) {
    const settings = options || {};
    const viewerId = text(settings.viewerId);
    if (!viewerId) throw new Error("mycar_viewer_required");
    const identityIds = Array.from(new Set([
      viewerId,
      ...(Array.isArray(settings.identityIds) ? settings.identityIds : [])
    ].map(text).filter(Boolean)));

    const cars = sortCars((Array.isArray(settings.cars) ? settings.cars : [])
      .map(car => compactCar(car, identityIds))
      .filter(car => car.id && (car.isHost || car.isPlayer)));

    return {
      schemaVersion: SCHEMA_VERSION,
      viewType: "mycar_index",
      viewerId,
      identityIds,
      cars,
      counts: {
        all: cars.length,
        host: cars.filter(car => car.isHost).length,
        player: cars.filter(car => car.isPlayer).length
      },
      builtAt: new Date().toISOString()
    };
  }

  async function read(viewerId) {
    const id = text(viewerId);
    if (!id) throw new Error("mycar_viewer_required");
    const snapshot = await getDb().collection(COLLECTION).doc(id).get();
    return snapshot.exists ? (snapshot.data() || null) : null;
  }

  async function write(view) {
    const viewerId = text(view && view.viewerId);
    if (!viewerId) throw new Error("mycar_viewer_required");
    await getDb().collection(COLLECTION).doc(viewerId).set(view, { merge: false });
    return view;
  }

  function selectForUi(view, options) {
    const settings = options || {};
    const tab = text(settings.tab) || "all";
    const roleTab = text(settings.roleTab) || "all";
    const keyword = text(settings.keyword).toLowerCase();
    const pageSize = Math.max(1, Math.min(50, Number(settings.pageSize || 20)));
    const pageIndex = Math.max(0, Number(settings.pageIndex || 0));
    let cars = sortCars(view && Array.isArray(view.cars) ? view.cars : []);

    if (tab === "planning") cars = cars.filter(isPlanning);
    if (tab === "active") {
      cars = cars.filter(car => !isEnded(car) && !isPlanning(car));
      if (roleTab === "host") cars = cars.filter(car => car.isHost);
      if (roleTab === "player") cars = cars.filter(car => car.isPlayer && !car.isHost);
    }
    if (tab === "done") cars = cars.filter(isEnded);

    if (keyword) {
      cars = cars.filter(car => [
        car.scriptName, car.gameDate, car.gameTime, car.locationName, car.location,
        car.organizerName, car.studioName, car.dmName, ...(car.tags || []), ...(car.scriptTags || [])
      ].join(" ").toLowerCase().includes(keyword));
    }

    const start = pageIndex * pageSize;
    return { cars: cars.slice(start, start + pageSize), total: cars.length, hasMore: start + pageSize < cars.length };
  }

  function recalculateView(view, cars) {
    const nextCars = sortCars(Array.isArray(cars) ? cars : []);
    return {
      ...view,
      schemaVersion: SCHEMA_VERSION,
      viewType: "mycar_index",
      cars: nextCars,
      counts: {
        all: nextCars.length,
        host: nextCars.filter(car => car.isHost).length,
        player: nextCars.filter(car => car.isPlayer).length
      },
      builtAt: new Date().toISOString()
    };
  }

  function applyMutationToView(view, beforeCar, afterCar) {
    if (!view || typeof view !== "object") return null;
    const viewerId = text(view.viewerId);
    const identityIds = Array.from(new Set([
      viewerId,
      ...(Array.isArray(view.identityIds) ? view.identityIds : [])
    ].map(text).filter(Boolean)));
    const carId = text(
      (afterCar && (afterCar.id || afterCar.carId)) ||
      (beforeCar && (beforeCar.id || beforeCar.carId))
    );
    if (!carId) return view;

    const cars = (Array.isArray(view.cars) ? view.cars : []).filter(car => text(car && car.id) !== carId);
    if (afterCar) {
      const compact = compactCar(afterCar, identityIds);
      if (compact.id && (compact.isHost || compact.isPlayer)) cars.push(compact);
    }
    return recalculateView(view, cars);
  }

  async function applyViewerMutation(viewerId, beforeCar, afterCar) {
    const normalizedViewerId = text(viewerId);
    if (!normalizedViewerId) return { ok: false, skipped: "viewer_id_missing" };
    const current = await read(normalizedViewerId);
    if (!current) return { ok: true, skipped: "view_not_bootstrapped", viewerId: normalizedViewerId };
    const next = applyMutationToView(current, beforeCar, afterCar);
    await write(next);
    return { ok: true, viewerId: normalizedViewerId };
  }

  async function resolvePreparedViewerIds(identityIds) {
    const db = getDb();
    const viewerIds = new Set();
    const ids = Array.from(new Set(
      (Array.isArray(identityIds) ? identityIds : [])
        .map(text)
        .filter(Boolean)
    ));

    for (const identityId of ids) {
      // A legacy owner id may itself still own a Prepared View.
      const direct = await read(identityId);
      if (direct) viewerIds.add(identityId);

      // Canonical alias routing is the authoritative bridge from historical
      // identity ids to the current Prepared View document.
      try {
        const alias = await db
          .collection("myCarViewAliases")
          .doc(identityId)
          .get();

        if (alias.exists) {
          const routedViewerId = text((alias.data() || {}).viewerId);
          if (routedViewerId) viewerIds.add(routedViewerId);
        }
      } catch (error) {
        console.warn("MyCar alias route lookup skipped", identityId, error);
      }
    }

    return Array.from(viewerIds);
  }

  async function applyCarMutation(beforeCar, afterCar) {
    const ownerIds = Array.from(new Set([
      text(beforeCar && beforeCar.ownerId),
      text(afterCar && afterCar.ownerId)
    ].filter(Boolean)));

    const viewerIds = await resolvePreparedViewerIds(ownerIds);
    const results = [];

    // First car for a canonical identity: create the Prepared View at the
    // mutation boundary. Normal MyCar page load must never bootstrap by
    // scanning Core cars.
    if (!beforeCar && afterCar && viewerIds.length === 0 && ownerIds.length === 1) {
      const viewerId = ownerIds[0];
      const initial = buildView({
        viewerId,
        identityIds: [viewerId],
        cars: [afterCar]
      });
      await write(initial);
      return [{ ok: true, viewerId, bootstrapped: true }];
    }

    for (const viewerId of viewerIds) {
      results.push(await applyViewerMutation(viewerId, beforeCar, afterCar));
    }

    return results;
  }

  const api = {
    COLLECTION,
    SCHEMA_VERSION,
    compactCar,
    buildView,
    read,
    write,
    recalculateView,
    applyMutationToView,
    applyViewerMutation,
    applyCarMutation,
    selectForUi,
    isEnded,
    isPlanning,
    sortCars
  };

  window.JLYMyCarView = api;
  if (window.JLYViewCore) window.JLYViewCore.registerViewType("mycar", api);
})();
